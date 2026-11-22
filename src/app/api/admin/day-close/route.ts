import { NextResponse } from 'next/server';
import { db, refreshTableSummaries, persistDb, getIstDateString, readDailyLedger, appendToDailyLedger, verifyMasterPin } from '@/lib/serverDb';
import { generateUnifiedMasterDatabaseXml } from '@/lib/masterExcelDatabase';
import fs from 'fs';
import path from 'path';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    let adminPin = '';
    try {
      const body = await request.json();
      adminPin = body.adminPin || body.pin || '';
    } catch {}

    // Strict Security: Master Security PIN required to close business day
    if (!adminPin || !verifyMasterPin(adminPin)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Valid 4-digit Master Security PIN is required to close shift.' },
        { status: 403, headers: corsHeaders }
      );
    }

    const todayStr = db.currentBusinessDate || getIstDateString();
    
    // Combine paid orders from memory, historical sales, and permanent disk daily ledger
    const ledgerSales = readDailyLedger(todayStr);
    const dayHistorical = (db.historicalSales || []).filter((s) => getIstDateString(s.settledAt) === todayStr);
    const todayOrders = (db.orders || []).filter((o) => {
      const d = getIstDateString(o.paidAt || o.createdAt || '');
      return d === todayStr && o.paymentStatus === 'PAID';
    });

    const knownCodes = new Set<string>();
    const combinedPaid: Array<{
      orderCode: string;
      tableCode: string;
      paymentMode: string;
      grandTotalPaise: number;
      items: any[];
    }> = [];

    for (const item of [...ledgerSales, ...dayHistorical]) {
      const code = item.orderCode || item.invoiceNumber;
      if (code && !knownCodes.has(code)) {
        knownCodes.add(code);
        combinedPaid.push({
          orderCode: item.orderCode || item.invoiceNumber,
          tableCode: item.tableCode || 'T1A',
          paymentMode: item.paymentMode || 'CASH',
          grandTotalPaise: item.grandTotalPaise || 0,
          items: item.items || [],
        });
      }
    }

    for (const o of todayOrders) {
      if (!knownCodes.has(o.customerCode)) {
        knownCodes.add(o.customerCode);
        combinedPaid.push({
          orderCode: o.customerCode,
          tableCode: o.tableCode,
          paymentMode: o.paymentMode || 'CASH',
          grandTotalPaise: o.grandTotalPaise || 0,
          items: o.items || [],
        });
      }
    }

    const totalSalesPaise = combinedPaid.reduce((sum, o) => sum + o.grandTotalPaise, 0);
    const cashPaise = combinedPaid
      .filter((o) => (o.paymentMode || '').toUpperCase() === 'CASH')
      .reduce((sum, o) => sum + o.grandTotalPaise, 0);
    const upiPaise = combinedPaid
      .filter((o) => (o.paymentMode || '').toUpperCase() === 'UPI')
      .reduce((sum, o) => sum + o.grandTotalPaise, 0);

    // Item movement summary
    const itemMap: Record<string, { name: string; qty: number; totalPaise: number }> = {};
    for (const o of combinedPaid) {
      for (const it of o.items) {
        const name = it.itemName || it.name || 'Dish';
        const qty = it.quantity || it.qty || 1;
        const total = it.lineTotalPaise || (it.pricePaise ? it.pricePaise * qty : 0);
        if (!itemMap[name]) {
          itemMap[name] = { name, qty: 0, totalPaise: 0 };
        }
        itemMap[name].qty += qty;
        itemMap[name].totalPaise += total;
      }
    }

    const itemSummary = Object.values(itemMap);

    const excelFileName = `Daily_Report_${todayStr}.xls`;
    const xlsContent = generateUnifiedMasterDatabaseXml(todayStr, combinedPaid, db.tables, db.staffUsers);

    // Local Master Excel Report Archival to Laptop Disk
    try {
      const targetDir = path.join(process.cwd(), 'reports_archive');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(path.join(targetDir, excelFileName), xlsContent, 'utf8');
    } catch (fsErr) {
      console.warn('File save skipped in serverless environment:', fsErr);
    }

    // Reset Table States for tomorrow morning
    for (const t of db.tables) {
      t.status = 'AVAILABLE';
      t.unpaidCount = 0;
      t.unpaidTotalPaise = 0;
    }

    // Safely archive any remaining unsettled orders to the permanent ledger before wiping live queue
    const remainingUnpaid = (db.orders || []).filter((o) => o.paymentStatus !== 'PAID');
    for (const uo of remainingUnpaid) {
      appendToDailyLedger({
        invoiceNumber: `VOID-${uo.customerCode}`,
        orderCode: uo.customerCode,
        tableCode: uo.tableCode,
        roomName: (db.tables || []).find((t) => t.tableCode === uo.tableCode)?.roomName || 'Dining Area',
        grandTotalPaise: uo.grandTotalPaise || 0,
        paymentMode: 'VOID_AT_DAY_CLOSE',
        settledAt: new Date().toISOString(),
        cashier: 'System Day Close',
        items: uo.items || [],
        itemsSummary: (uo.items || []).map((i: any) => `${i.itemName} X ${i.quantity}`).join(', '),
      });
    }

    // Refresh Kitchen Display (KDS) & active orders for tomorrow morning - completely fresh queue
    db.kitchenTickets = [];
    db.orders = [];

    // PERMANENT MENU & ZERO DAILY PENDING STOCK AT DAY CLOSE:
    // Menu item names, categories, and prices are permanently preserved.
    // Any remaining or pending stocks are automatically reset to zero at day's end,
    // ready for the shopkeeper to input fresh daily stock in the morning.
    if (Array.isArray(db.menuCategories)) {
      for (const cat of db.menuCategories) {
        if (!Array.isArray(cat.items)) continue;
        for (const item of cat.items) {
          item.currentStock = 0;
          item.isAvailable = false;
        }
      }
    }

    db.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actionType: 'DAY_CLOSED_Z_REPORT',
      module: 'BILLING',
      usernameSnapshot: 'Cashier / Admin',
      reason: `Business day closed. Generated ${excelFileName} with ${(totalSalesPaise / 100).toFixed(2)} INR total.`,
      success: true,
    });

    persistDb();

    return NextResponse.json({
      success: true,
      message: `Day ${todayStr} closed successfully. Excel ready.`,
      summary: {
        date: todayStr,
        totalOrders: combinedPaid.length,
        totalSalesPaise,
        cashPaise,
        upiPaise,
        excelFileName,
        excelContent: xlsContent, // Returned so client triggers instant download
      },
    }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to close day' }, { status: 500, headers: corsHeaders });
  }
}
