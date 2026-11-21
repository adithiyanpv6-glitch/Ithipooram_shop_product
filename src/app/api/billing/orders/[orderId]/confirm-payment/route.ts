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

export async function POST(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const orderId = params.orderId || body.orderId;
    const { paymentMode, cashierPin, pin, referenceNumber, cashierName, cashierId, authType } = body;

    const enteredPin = (cashierPin || pin || '').trim();
    if (!enteredPin) {
      return NextResponse.json({ error: 'Cashier PIN / password is required to authorize settlement.' }, { status: 400, headers: corsHeaders });
    }

    // Authenticate cashier against master staff database (db.staffUsers)
    const allStaff = db.staffUsers || [];
    let authenticated = false;
    let verifiedCashierName = cashierName || 'Counter Cashier';

    const isAdminSelected = authType === 'ADMIN' || 
      cashierId === 'ADMIN' || 
      cashierName === 'System Administrator' || 
      cashierName === 'Administrator';

    if (isAdminSelected) {
      // 1. Strict Administrator Master PIN check — cannot use staff PINs
      if (verifyMasterPin(enteredPin)) {
        authenticated = true;
        verifiedCashierName = 'System Administrator';
      } else {
        return NextResponse.json(
          { error: 'Invalid Master Security PIN. Only the administrator Master PIN can authorize admin settlement.' },
          { status: 401, headers: corsHeaders }
        );
      }
    } else {
      // 2. Strict Staff Member PIN check — cannot use Master PIN or other staff's PIN
      const matched = allStaff.find(
        (s) => (cashierId && s.id === cashierId) || 
               (s.fullName || '').toLowerCase() === (cashierName || '').toLowerCase() || 
               (s.username || '').toLowerCase() === (cashierName || '').toLowerCase()
      );

      if (matched) {
        if (matched.pin === enteredPin) {
          authenticated = true;
          verifiedCashierName = matched.fullName || matched.username;
        } else {
          return NextResponse.json(
            { error: `Invalid PIN for ${matched.fullName || matched.username}. Each staff member must enter their own registered 4-digit PIN.` },
            { status: 401, headers: corsHeaders }
          );
        }
      } else {
        // Fallback if staff not found by name: check if entered PIN matches any registered staff
        const pinMatched = allStaff.find((s) => s.pin === enteredPin);
        if (pinMatched) {
          authenticated = true;
          verifiedCashierName = pinMatched.fullName || pinMatched.username;
        } else if (verifyMasterPin(enteredPin)) {
          authenticated = true;
          verifiedCashierName = 'System Administrator';
        }
      }
    }

    if (!authenticated) {
      return NextResponse.json(
        { error: 'Authentication failed: Incorrect Security PIN. Please enter your valid PIN.' },
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

    // Resolve room name and table display name from registered tables
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

    // Items formatted for receipt and historical sales
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

    // Record into historical sales for CSV & Room-wise reporting
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

    // Refresh tables and persist to disk
    refreshTableSummaries();
    persistDb();

    // Live background streaming sync to Google Drive & Master Database
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
      }).catch((e) => console.warn('[Google Drive Sync] confirm-payment stream error:', e));

      pushLiveUpdateToGoogleWorkspace().catch((e) => console.warn('[Google Workspace Sync] confirm-payment sync error:', e));
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

    // Generate exact requested 58mm thermal receipt layout:
    // 1. Calligraphy Brand Heading
    // 2. Only place under that (Vanchiyoor, Trivandrum)
    // 3. Synced daily sequential invoice number (YYYYMMDD-001)
    // 4. Date & Time
    // 5. Table Name
    // 6. Cashier Name
    // 7. Items (name, qty, rate, total)
    // 8. No GST / No Taxes
    // 9. Grand Total
    // 10. Payment Type
    // 11. Malayalam & English Thank You
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

    return NextResponse.json(
      {
        success: true,
        message: 'Payment confirmed and invoice created.',
        order,
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
          printStatus: 'CONFIRMED',
          thermalReceipt,
        },
        printerStatus: 'READY_TO_PRINT',
        thermalReceipt,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
