import { NextResponse } from 'next/server';
import {
  db,
  persistDb,
  generateDailySequentialInvoiceNumber,
  formatIthiPooramThermalReceipt,
  appendToDailyLedger,
  verifyMasterPin,
} from '@/lib/serverDb';
import { printToSeznikBluetoothPrinter } from '@/lib/serverPrinter';
import { pushSettledBillToGoogleDrive, pushLiveUpdateToGoogleWorkspace } from '@/lib/googleWorkspaceSync';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { items, paymentMode, orderType, tableCode, tableName, cashierName, cashierId, authType, pin, cashierPin } = body;

    const enteredPin = (cashierPin || pin || '').trim();
    const allStaff = db.staffUsers || [];
    let verifiedCashierName = cashierName || 'System Administrator';

    if (enteredPin) {
      const isAdminSelected = authType === 'ADMIN' || 
        cashierId === 'ADMIN' || 
        cashierName === 'System Administrator' || 
        cashierName === 'Administrator' || 
        cashierName === 'Main Administrator';

      if (isAdminSelected) {
        if (verifyMasterPin(enteredPin)) {
          verifiedCashierName = 'System Administrator';
        } else {
          return NextResponse.json(
            { error: 'Invalid Master Security PIN. Only the administrator Master PIN can authorize admin settlement.' },
            { status: 401, headers: corsHeaders }
          );
        }
      } else {
        const matched = allStaff.find(
          (s) => (cashierId && s.id === cashierId) || 
                 (s.fullName || '').toLowerCase() === (cashierName || '').toLowerCase() || 
                 (s.username || '').toLowerCase() === (cashierName || '').toLowerCase()
        );

        if (matched) {
          if (matched.pin === enteredPin) {
            verifiedCashierName = matched.fullName || matched.username;
          } else {
            return NextResponse.json(
              { error: `Invalid PIN for ${matched.fullName || matched.username}. Each staff member must enter their own registered 4-digit PIN.` },
              { status: 401, headers: corsHeaders }
            );
          }
        } else if (verifyMasterPin(enteredPin)) {
          verifiedCashierName = 'System Administrator';
        } else {
          return NextResponse.json(
            { error: 'Authentication failed: Incorrect PIN.' },
            { status: 401, headers: corsHeaders }
          );
        }
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one dish to print bill.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Filter valid items
    const validItems = items.filter((i: any) => (Number(i.qty || i.quantity || 0)) > 0);
    if (validItems.length === 0) {
      return NextResponse.json(
        { error: 'Please select item quantity greater than 0.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { invoiceNumber, dateStr, timeStr } = generateDailySequentialInvoiceNumber();

    const isTakeaway = String(orderType || '').toUpperCase() === 'TAKEAWAY';
    const displayTableName = isTakeaway 
      ? 'Takeaway' 
      : (tableName || (tableCode ? `Table ${tableCode}` : 'Dine-In'));
    const displayTableCode = isTakeaway ? 'TAKEAWAY' : (tableCode || 'DINE_IN');
    const displayCashier = verifiedCashierName;

    const receiptItems = validItems.map((i: any) => {
      const qty = Math.max(1, Number(i.qty || i.quantity || 1));
      const pricePaise = Number(i.pricePaise || (Number(i.priceInr || i.price || 0) * 100) || 0);
      const lineTotalPaise = pricePaise * qty;
      return {
        name: (i.name || 'Dish').trim(),
        qty,
        pricePaise,
        lineTotalPaise,
      };
    });

    const grandTotalPaise = receiptItems.reduce((acc, it) => acc + it.lineTotalPaise, 0);
    const chosenPaymentMode = (paymentMode || 'CASH').toUpperCase();
    const settledTimestamp = new Date().toISOString();

    const historicalRecord = {
      id: `hist-quick-${Date.now()}`,
      invoiceNumber,
      orderCode: `DIR-${invoiceNumber}`,
      tableCode: displayTableCode,
      roomName: isTakeaway ? 'Takeaway Desk' : 'Dining Area',
      grandTotalPaise,
      paymentMode: chosenPaymentMode,
      settledAt: settledTimestamp,
      cashier: displayCashier,
      items: receiptItems.map((it) => ({
        itemName: it.name,
        quantity: it.qty,
        pricePaise: it.pricePaise,
        lineTotalPaise: it.lineTotalPaise,
      })),
      itemsSummary: receiptItems.map((i) => `${i.name} X ${i.qty}`).join(', '),
    };

    // Save into historical sales and ledger for reporting & graphs
    if (!Array.isArray(db.historicalSales)) {
      db.historicalSales = [];
    }
    db.historicalSales.unshift(historicalRecord);
    appendToDailyLedger(historicalRecord);

    // Update stock if tracked
    if (Array.isArray(db.menuCategories)) {
      for (const item of validItems) {
        const qty = Number(item.qty || 1);
        for (const cat of db.menuCategories) {
          if (!Array.isArray(cat.items)) continue;
          for (const it of cat.items) {
            const matchId = it.id && item.id && it.id === item.id;
            const matchName = it.name && it.name.trim().toLowerCase() === (item.name || '').trim().toLowerCase();
            if (matchId || matchName) {
              if (typeof it.currentStock === 'number') {
                it.currentStock = Math.max(0, it.currentStock - qty);
                if (it.currentStock === 0) {
                  it.isAvailable = false;
                }
              }
              break;
            }
          }
        }
      }
    }

    // Record audit log
    if (!Array.isArray(db.auditLogs)) {
      db.auditLogs = [];
    }
    db.auditLogs.unshift({
      id: `aud-quick-${Date.now()}`,
      timestamp: settledTimestamp,
      actionType: 'DIRECT_BILL_PRINTED',
      module: 'BILLING',
      usernameSnapshot: 'POS Counter',
      tableCode: 'COUNTER',
      invoiceNumber,
      reason: `Direct Quick Bill printed via ${chosenPaymentMode} for ${(grandTotalPaise / 100).toFixed(2)} INR`,
      success: true,
    });

    persistDb();

    // Stream settled bill and live sync to Google Drive & Master Database
    setTimeout(() => {
      pushSettledBillToGoogleDrive({
        invoiceNumber,
        orderCode: `DIR-${invoiceNumber}`,
        tableCode: displayTableCode,
        tableName: displayTableName,
        roomName: isTakeaway ? 'Takeaway Desk' : 'Dining Area',
        paymentMode: chosenPaymentMode,
        grandTotalPaise,
        cashier: displayCashier,
        itemsSummary: historicalRecord.itemsSummary,
        timestamp: new Date().toISOString(),
      }).catch((e) => console.warn('[Google Drive Sync] quick-bill stream error:', e));

      pushLiveUpdateToGoogleWorkspace().catch((e) => console.warn('[Google Workspace Sync] quick-bill sync error:', e));
    }, 0);

    // Format thermal receipt text
    const thermalReceipt = formatIthiPooramThermalReceipt({
      invoiceNumber,
      dateStr,
      timeStr,
      tableName: displayTableName,
      cashierName: displayCashier,
      items: receiptItems,
      grandTotalPaise,
      paymentMode: chosenPaymentMode,
    });

    // Auto-send structured JSON payload to SEZNIK Bluetooth printer asynchronously in background so POS never freezes
    let btPrintStatus = 'SUCCESS';
    let btError: string | undefined;
    try {
      const printerPayload = JSON.stringify({
        invoiceNumber,
        dateStr,
        timeStr,
        tableName: displayTableName,
        cashierName: displayCashier,
        paymentMode: chosenPaymentMode,
        grandTotal: (grandTotalPaise / 100).toFixed(2),
        items: receiptItems.map((it) => ({
          name: it.name,
          qty: it.qty,
          rate: (it.pricePaise / 100).toFixed(2),
          total: (it.lineTotalPaise / 100).toFixed(2),
        })),
      });

      printToSeznikBluetoothPrinter(printerPayload, 'SEZNIK')
        .then((res) => {
          if (res.success) {
            console.log(`[Quick Bill] Receipt printed wirelessly on SEZNIK printer for ${invoiceNumber}`);
          }
        })
        .catch((e) => console.warn(`[Quick Bill] Non-blocking print notice: ${e.message}`));
    } catch (e: any) {
      btPrintStatus = 'PRINTER_ERROR';
      btError = e.message;
    }

    return NextResponse.json(
      {
        success: true,
        invoiceNumber,
        dateStr,
        timeStr,
        tableName: displayTableName,
        cashierName: displayCashier,
        orderType: isTakeaway ? 'TAKEAWAY' : 'DINE_IN',
        thermalReceipt,
        grandTotalPaise,
        items: receiptItems,
        btPrintStatus,
        btError,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Direct bill print error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to print bill' },
      { status: 500, headers: corsHeaders }
    );
  }
}
