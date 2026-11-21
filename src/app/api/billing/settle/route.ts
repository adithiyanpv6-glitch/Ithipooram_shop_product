import { NextResponse } from 'next/server';
import { 
  db, 
  refreshTableSummaries, 
  persistDb, 
  generateDailySequentialInvoiceNumber, 
  formatIthiPooramThermalReceipt,
  verifyMasterPin,
  appendToDailyLedger
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
    const body = await request.json();
    const { orderId, paymentMode, pin, cashierPin, referenceNumber, cashierName } = body;

    const enteredPin = (cashierPin || pin || '').trim();
    if (!enteredPin) {
      return NextResponse.json({ error: 'Cashier PIN / password is required to authorize settlement.' }, { status: 400, headers: corsHeaders });
    }

    // Authenticate cashier against master staff database (db.staffUsers)
    const allStaff = db.staffUsers || [];
    let authenticated = false;
    let verifiedCashierName = cashierName || 'Counter Cashier';

    if (cashierName && allStaff.length > 0) {
      const matched = allStaff.find(
        (s) => (s.fullName || '').toLowerCase() === cashierName.toLowerCase() || (s.username || '').toLowerCase() === cashierName.toLowerCase()
      );
      if (matched && matched.pin === enteredPin) {
        authenticated = true;
        verifiedCashierName = matched.fullName || matched.username;
      }
    }

    // Match any registered staff member by PIN
    if (!authenticated && allStaff.length > 0) {
      const pinMatched = allStaff.find((s) => s.pin === enteredPin);
      if (pinMatched) {
        authenticated = true;
        verifiedCashierName = pinMatched.fullName || pinMatched.username;
      }
    }

    // Master database Security PIN verification
    if (verifyMasterPin(enteredPin)) {
      authenticated = true;
      verifiedCashierName = 'System Administrator';
    }

    if (!authenticated) {
      return NextResponse.json(
        { error: 'Authentication failed: Incorrect Security PIN. Please enter your valid Master PIN.' },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400, headers: corsHeaders });
    }

    const order = db.orders.find((o) => o.id === orderId || o.customerCode === orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order ticket not found' }, { status: 404, headers: corsHeaders });
    }

    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ error: 'This ticket has already been settled' }, { status: 400, headers: corsHeaders });
    }

    const { invoiceNumber, dateStr, timeStr } = generateDailySequentialInvoiceNumber();

    const tableObj = (db.tables || []).find((t) => (t.tableCode || '').toUpperCase() === (order.tableCode || '').toUpperCase());
    const roomName = tableObj?.roomName || 'Dining Area';
    const tableName = order.tableName || tableObj?.displayName || order.tableCode;

    const settledTimestamp = new Date().toISOString();
    order.paymentStatus = 'PAID';
    order.fulfillmentStatus = 'SERVED';
    order.paymentMode = paymentMode || 'UPI';
    order.paymentRef = referenceNumber || '';
    order.cashierName = verifiedCashierName;
    order.paidAt = settledTimestamp;
    (order as any).invoiceNumber = invoiceNumber;

    const receiptItems = (order.items || []).map((i: any) => ({
      name: i.itemNameSnapshot || i.itemName || i.name || 'Dish',
      qty: i.quantity || 1,
      pricePaise: i.itemPriceSnapshotPaise || i.pricePaise || 0,
      lineTotalPaise: i.lineTotalPaise || ((i.pricePaise || 0) * (i.quantity || 1)),
    }));

    const historicalRecord = {
      id: `hist-${Date.now()}`,
      invoiceNumber,
      orderCode: order.customerCode,
      tableCode: order.tableCode,
      roomName,
      grandTotalPaise: order.grandTotalPaise,
      paymentMode: order.paymentMode || 'UPI',
      settledAt: settledTimestamp,
      cashier: order.cashierName || 'Cashier',
      items: order.items || [],
      itemsSummary: (order.items || []).map((i: any) => `${i.itemName} X ${i.quantity}`).join(', '),
    };

    // Record into historical sales for CSV reporting
    db.historicalSales.unshift(historicalRecord);

    // Save to permanent immutable disk daily ledger
    appendToDailyLedger(historicalRecord);

    // Synchronize Kitchen Display System (KDS): Mark all tickets for this order as SERVED
    if (Array.isArray(db.kitchenTickets)) {
      for (const kt of db.kitchenTickets) {
        if (kt.orderId === order.id || (order.customerCode && kt.customerCode?.startsWith(order.customerCode))) {
          kt.status = 'SERVED';
          kt.deliveredAtMs = Date.now();
        }
      }
    }

    // Refresh tables
    refreshTableSummaries();
    persistDb();

    // Stream settled bill and live sync to Google Drive & Master Database
    setTimeout(() => {
      pushSettledBillToGoogleDrive({
        invoiceNumber,
        orderCode: order.customerCode,
        tableCode: order.tableCode,
        tableName,
        roomName,
        paymentMode: order.paymentMode || 'UPI',
        grandTotalPaise: order.grandTotalPaise,
        cashier: order.cashierName || 'Cashier',
        itemsSummary: historicalRecord.itemsSummary,
        timestamp: settledTimestamp,
      }).catch((e) => console.warn('[Google Drive Sync] settle stream error:', e));

      pushLiveUpdateToGoogleWorkspace().catch((e) => console.warn('[Google Workspace Sync] settle sync error:', e));
    }, 0);

    // Record audit log
    db.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      timestamp: settledTimestamp,
      actionType: 'BILL_SETTLED',
      module: 'BILLING',
      usernameSnapshot: order.cashierName || 'Cashier',
      orderCode: order.customerCode,
      tableCode: order.tableCode,
      invoiceNumber,
      reason: `Settled check via ${order.paymentMode} for ${(order.grandTotalPaise / 100).toFixed(2)} INR`,
      success: true,
    });
    persistDb();

    const thermalReceipt = formatIthiPooramThermalReceipt({
      invoiceNumber,
      dateStr,
      timeStr,
      tableName,
      cashierName: order.cashierName || 'Cashier',
      items: receiptItems,
      grandTotalPaise: order.grandTotalPaise,
      paymentMode: order.paymentMode || 'UPI',
    });

    // Auto-send structured JSON payload to SEZNIK Bluetooth printer wirelessly in background
    let btPrintStatus = 'SUCCESS';
    try {
      const printerPayload = JSON.stringify({
        invoiceNumber,
        dateStr,
        timeStr,
        tableName,
        cashierName: order.cashierName || 'Cashier',
        paymentMode: order.paymentMode || 'UPI',
        grandTotal: (order.grandTotalPaise / 100).toFixed(2),
        items: receiptItems.map((it: any) => ({
          name: it.name,
          qty: it.qty,
          rate: (it.pricePaise / 100).toFixed(2),
          total: (it.lineTotalPaise / 100).toFixed(2),
        })),
      });

      printToSeznikBluetoothPrinter(printerPayload, 'SEZNIK')
        .then((res) => {
          if (res.success) {
            console.log(`[Table Settle] Receipt printed wirelessly on SEZNIK printer for ${invoiceNumber}`);
          }
        })
        .catch((e) => console.warn(`[Table Settle] Non-blocking print notice: ${e.message}`));
    } catch (e: any) {
      btPrintStatus = 'PRINTER_ERROR';
    }

    return NextResponse.json(
      {
        success: true,
        invoiceNumber,
        btPrintStatus,
        invoice: {
          id: `inv-${Date.now()}`,
          invoiceNumber,
          customerCode: order.customerCode,
          tableCode: tableName,
          roomName,
          dateStr,
          timeStr,
          cashierName: order.cashierName,
          items: receiptItems.map((it: any) => ({
            name: it.name,
            qty: it.qty,
            rate: Math.round(it.pricePaise / 100),
            total: Math.round(it.lineTotalPaise / 100),
          })),
          grandTotalPaise: order.grandTotalPaise,
          paymentMode: order.paymentMode,
          paidAt: order.paidAt,
          thermalReceipt,
        },
        thermalReceipt,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
