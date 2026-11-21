import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { db, getIstDateString, normalizeToIsoDate, readDailyLedger, readAllDailyLedgers } from '@/lib/serverDb';
import { generateUnifiedMasterDatabaseXml } from '@/lib/masterExcelDatabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawDateQuery = searchParams.get('date') || 'today';
    const format = searchParams.get('format') || 'json';
    const reportType = searchParams.get('report') || 'all';

    const now = new Date();
    const todayIst = getIstDateString(now);
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayIst = getIstDateString(yesterdayDate);

    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const normalizeDateStr = (str: string) => {
      if (!str) return todayIst;
      return normalizeToIsoDate(str);
    };

    let filterMode: 'single' | 'range' | 'all' = 'single';
    let targetSingleDate = todayIst;
    let rangeStartDate = todayIst;
    let rangeEndDate = todayIst;
    let dateLabel = todayIst;

    const lowerQuery = rawDateQuery.trim().toLowerCase();
    if (lowerQuery === 'all' || lowerQuery === 'all_time' || lowerQuery === 'all time') {
      filterMode = 'all';
      dateLabel = 'All-Time-History';
    } else if (lowerQuery === '7days' || lowerQuery === 'week' || lowerQuery === 'last 7 days' || lowerQuery === 'last_7_days') {
      filterMode = 'range';
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      rangeStartDate = getIstDateString(d7);
      rangeEndDate = todayIst;
      dateLabel = `Last-7-Days_${rangeStartDate}_to_${rangeEndDate}`;
    } else if (lowerQuery === '30days' || lowerQuery === 'month' || lowerQuery === 'last 30 days' || lowerQuery === 'last_30_days' || lowerQuery === 'this month') {
      filterMode = 'range';
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      rangeStartDate = getIstDateString(d30);
      rangeEndDate = todayIst;
      dateLabel = `Last-30-Days_${rangeStartDate}_to_${rangeEndDate}`;
    } else if (startDateParam && endDateParam) {
      filterMode = 'range';
      rangeStartDate = normalizeDateStr(startDateParam);
      rangeEndDate = normalizeDateStr(endDateParam);
      dateLabel = `${rangeStartDate}_to_${rangeEndDate}`;
    } else {
      filterMode = 'single';
      targetSingleDate = normalizeDateStr(rawDateQuery);
      if (!targetSingleDate) targetSingleDate = todayIst;
      dateLabel = targetSingleDate;
    }

    // 1. COMBINE IMMUTABLE DISK DAILY LEDGERS, HISTORICAL SALES, AND ACTIVE PAID ORDERS
    const allDiskSales = readAllDailyLedgers();
    const knownSalesCodes = new Set<string>();
    const allUnifiedSales: any[] = [];

    // Prioritize immutable disk daily ledgers & historical sales
    for (const s of [...allDiskSales, ...(db.historicalSales || [])]) {
      const code = s.orderCode || s.invoiceNumber || s.id;
      if (code && !knownSalesCodes.has(code)) {
        knownSalesCodes.add(code);
        allUnifiedSales.push({
          id: s.id,
          invoiceNumber: s.invoiceNumber || code,
          orderCode: s.orderCode || code,
          tableCode: s.tableCode || 'COUNTER',
          roomName: s.roomName || 'Dining Area',
          grandTotalPaise: s.grandTotalPaise || 0,
          paymentMode: s.paymentMode || 'CASH',
          settledAt: s.settledAt || new Date().toISOString(),
          cashier: s.cashier || 'Cashier Desk',
          items: s.items || [],
          itemsSummary: s.itemsSummary || '',
        });
      }
    }

    for (const o of (db.orders || [])) {
      if (o.paymentStatus === 'PAID') {
        const code = o.customerCode || o.id;
        if (!knownSalesCodes.has(code)) {
          knownSalesCodes.add(code);
          const tableObj = (db.tables || []).find((t) => t.tableCode === o.tableCode);
          allUnifiedSales.push({
            id: o.id,
            invoiceNumber: (o as any).invoiceNumber || `INV-${o.customerCode.replace('#', '')}`,
            orderCode: o.customerCode,
            tableCode: o.tableCode,
            roomName: tableObj?.roomName || 'Dining Area',
            grandTotalPaise: o.grandTotalPaise,
            paymentMode: o.paymentMode || 'CASH',
            settledAt: o.paidAt || o.createdAt,
            cashier: o.cashierName || 'Cashier Desk',
            items: o.items || [],
            itemsSummary: (o.items || []).map((i: any) => `${i.itemName} X ${i.quantity}`).join(', '),
          });
        }
      }
    }

    // If single day is requested, also check if direct readDailyLedger has items not yet in allUnifiedSales
    if (filterMode === 'single') {
      const directSingleSales = readDailyLedger(targetSingleDate);
      for (const d of directSingleSales) {
        const code = d.orderCode || d.invoiceNumber || d.id;
        if (code && !knownSalesCodes.has(code)) {
          knownSalesCodes.add(code);
          allUnifiedSales.push({
            id: d.id,
            invoiceNumber: d.invoiceNumber || code,
            orderCode: d.orderCode || code,
            tableCode: d.tableCode || 'COUNTER',
            roomName: d.roomName || 'Dining Area',
            grandTotalPaise: d.grandTotalPaise || 0,
            paymentMode: d.paymentMode || 'CASH',
            settledAt: d.settledAt || `${targetSingleDate}T12:00:00.000Z`,
            cashier: d.cashier || 'Cashier Desk',
            items: d.items || [],
            itemsSummary: d.itemsSummary || '',
          });
        }
      }
    }

    // 2. FILTER UNIFIED SALES ACCORDING TO TARGET DATE / RANGE
    const combinedSales = allUnifiedSales.filter((s) => {
      const orderDate = normalizeToIsoDate(s.settledAt);
      if (!orderDate) return false;
      if (filterMode === 'all') return true;
      if (filterMode === 'single') return orderDate === targetSingleDate;
      if (filterMode === 'range') return orderDate >= rangeStartDate && orderDate <= rangeEndDate;
      return false;
    });

    // Compute list of all dates on disk/memory that have recorded sales for calendar highlighting
    const ledgerDir = path.join(process.cwd(), 'data', 'daily_ledgers');
    const recordedDatesSet = new Set<string>();
    if (fs.existsSync(ledgerDir)) {
      try {
        fs.readdirSync(ledgerDir).forEach((f) => {
          if (f.endsWith('.json')) {
            recordedDatesSet.add(f.replace('.json', ''));
          }
        });
      } catch {}
    }
    allUnifiedSales.forEach((s) => {
      const d = normalizeToIsoDate(s.settledAt);
      if (d) recordedDatesSet.add(d);
    });
    const recordedDates = Array.from(recordedDatesSet).sort();

    // Report 1: Total Sales of the Day
    let grossSalesPaise = combinedSales.reduce((sum, s) => sum + (s.grandTotalPaise || 0), 0);
    let totalOrdersCount = combinedSales.length;
    let cashPaise = 0;
    let upiPaise = 0;
    let cardPaise = 0;

    combinedSales.forEach((s) => {
      const amt = s.grandTotalPaise || 0;
      const mode = (s.paymentMode || 'UPI').toUpperCase();
      if (mode === 'CASH') cashPaise += amt;
      else if (mode === 'CARD') cardPaise += amt;
      else upiPaise += amt;
    });

    const aovPaise = totalOrdersCount > 0 ? Math.round(grossSalesPaise / totalOrdersCount) : 0;
    const cgstPaise = Math.round(grossSalesPaise * 0.025);
    const sgstPaise = Math.round(grossSalesPaise * 0.025);

    const totalSalesReport = {
      date: dateLabel,
      grossSalesRupees: (grossSalesPaise / 100),
      totalBillsSettled: totalOrdersCount,
      cashRupees: (cashPaise / 100),
      upiRupees: (upiPaise / 100),
      cardRupees: (cardPaise / 100),
      aovRupees: (aovPaise / 100),
      cgstRupees: (cgstPaise / 100),
      sgstRupees: (sgstPaise / 100),
    };

    // Report 2: Menu of the Day with Remaining Stock Data
    const itemSalesMap: Record<string, { name: string; malayalamName?: string; category: string; priceRupees: number; soldQty: number; revenueRupees: number; currentStock: number | string }> = {};

    // Seed from active menu categories
    (db.menuCategories || []).forEach((cat) => {
      (cat.items || []).forEach((dish) => {
        itemSalesMap[dish.name] = {
          name: dish.name,
          malayalamName: dish.malayalamName || '',
          category: cat.name || dish.category || 'Kerala Specials',
          priceRupees: Math.round(dish.pricePaise / 100),
          soldQty: 0,
          revenueRupees: 0,
          currentStock: dish.currentStock !== undefined && dish.currentStock !== null ? dish.currentStock : 'Unlimited',
        };
      });
    });

    // Calculate actual sold quantities from all combined sales
    combinedSales.forEach((s) => {
      (s.items || []).forEach((it: any) => {
        const dishName = it.itemName || it.name || 'Dish';
        const dishPrice = it.pricePaise ? Math.round(it.pricePaise / 100) : (it.rate || 0);
        const qty = it.quantity || it.qty || 1;
        const totalLineRupees = it.lineTotalPaise ? Math.round(it.lineTotalPaise / 100) : (it.total || dishPrice * qty);

        if (!itemSalesMap[dishName]) {
          itemSalesMap[dishName] = {
            name: dishName,
            malayalamName: it.itemMalayalamName || it.malayalamName || '',
            category: 'Kerala Specials',
            priceRupees: dishPrice,
            soldQty: 0,
            revenueRupees: 0,
            currentStock: 15,
          };
        }
        itemSalesMap[dishName].soldQty += qty;
        itemSalesMap[dishName].revenueRupees += totalLineRupees;
      });
    });

    const menuRemainingStockReport = Object.values(itemSalesMap);

    // Report 3: Daily Table-wise & Room-wise Order and Revenue
    const tableMap: Record<string, { tableCode: string; displayName: string; roomName: string; ordersCount: number; totalRevenueRupees: number }> = {};
    const roomRevenueMap: Record<string, { roomName: string; tablesCount: number; ordersCount: number; totalRevenueRupees: number }> = {};

    (db.tables || []).forEach((t) => {
      const room = t.roomName || 'Dining Area';
      tableMap[t.tableCode] = {
        tableCode: t.tableCode,
        displayName: t.displayName || `Table ${t.tableCode}`,
        roomName: room,
        ordersCount: 0,
        totalRevenueRupees: 0,
      };
      if (!roomRevenueMap[room]) {
        roomRevenueMap[room] = { roomName: room, tablesCount: 0, ordersCount: 0, totalRevenueRupees: 0 };
      }
      roomRevenueMap[room].tablesCount += 1;
    });

    combinedSales.forEach((s) => {
      const code = (s.tableCode || 'T1').toUpperCase();
      const tableObj = (db.tables || []).find((t) => t.tableCode.toUpperCase() === code);
      const room = tableObj?.roomName || s.roomName || 'Dining Area';

      if (!tableMap[code]) {
        tableMap[code] = {
          tableCode: code,
          displayName: `Table ${code}`,
          roomName: room,
          ordersCount: 0,
          totalRevenueRupees: 0,
        };
      }
      tableMap[code].ordersCount += 1;
      tableMap[code].totalRevenueRupees += Math.round((s.grandTotalPaise || 0) / 100);

      if (!roomRevenueMap[room]) {
        roomRevenueMap[room] = { roomName: room, tablesCount: 1, ordersCount: 0, totalRevenueRupees: 0 };
      }
      roomRevenueMap[room].ordersCount += 1;
      roomRevenueMap[room].totalRevenueRupees += Math.round((s.grandTotalPaise || 0) / 100);
    });

    const tablewiseReport = Object.values(tableMap);
    const roomwiseReport = Object.values(roomRevenueMap);

    // Report 4: Staff Login Audit
    const staffLoginAuditReport = (db.loginSessions || []).map((s) => ({
      sessionId: s.sessionId,
      staffName: s.fullName || s.username,
      role: s.role,
      station: s.station,
      loginDate: s.loginDate,
      loginTime: s.loginTime,
      status: s.status,
    }));

    // If empty, supply active staff records
    const fallbackStaffAudit = staffLoginAuditReport.length > 0 ? staffLoginAuditReport : (db.staffUsers || []).map((u) => ({
      sessionId: `ses-${u.id}`,
      staffName: u.fullName || u.username,
      role: u.role,
      station: u.station,
      loginDate: dateLabel,
      loginTime: '08:00 AM',
      status: 'ACTIVE',
    }));

    // Report 5: Billing Authorization & Print Audit (Who authorized and printed each bill)
    const billingAuthorizations = combinedSales.map((s, idx) => ({
      billNumber: s.invoiceNumber || s.orderCode || `INV-${idx + 1001}`,
      tableCode: s.tableCode || 'T1',
      grandTotalRupees: Math.round((s.grandTotalPaise || 0) / 100),
      paymentMode: s.paymentMode || 'UPI',
      authorizedByStaffName: s.cashier || 'Cashier Desk',
      printedAt: s.settledAt || new Date().toISOString(),
      status: 'PRINTED & AUTHORIZED',
    }));

    if (format === 'excel') {
      const filename = `IthiPooram_MasterDatabase_${dateLabel}.xls`;
      const excelXml = generateUnifiedMasterDatabaseXml(
        targetSingleDate || dateLabel,
        combinedSales,
        db.tables,
        db.staffUsers
      );

      return new NextResponse(excelXml, {
        headers: {
          'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          ...corsHeaders,
        },
      });
    }

    // Default JSON response containing all 5 reports + recordedDates for calendar
    return NextResponse.json(
      {
        success: true,
        date: dateLabel,
        folderName: `IthiPooram_Reports_${dateLabel}`,
        recordedDates,
        salesData: combinedSales,
        reports: {
          totalSales: totalSalesReport,
          menuAndRemainingStock: menuRemainingStockReport,
          tablewiseRevenue: tablewiseReport,
          roomwiseRevenue: roomwiseReport,
          staffLoginAudit: fallbackStaffAudit,
          billingAuthorization: billingAuthorizations,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to generate daily reports: ' + err.message }, { status: 500, headers: corsHeaders });
  }
}
