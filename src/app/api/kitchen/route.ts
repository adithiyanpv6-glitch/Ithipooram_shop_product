import { NextResponse } from 'next/server';
import { db, refreshTableSummaries, persistDb, getIstDateString } from '@/lib/serverDb';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const station = searchParams.get('station');

  // Filter KDS tickets to today's date in IST only - refreshes each day cleanly
  const todayIst = getIstDateString();
  let result = (db.kitchenTickets || []).filter((k) => {
    const ticketDate = getIstDateString(new Date(k.createdAtMs || Date.now()));
    return ticketDate === todayIst;
  }).map((k) => {
    if (!k.roomName) {
      const table = (db.tables || []).find((t) => (t.tableCode || '').toUpperCase() === (k.tableCode || '').toUpperCase());
      k.roomName = table?.roomName || 'Dining Area';
    }
    return k;
  });

  if (station && station !== 'ALL') {
    result = result.filter((k) => k.station === station);
  }

  return NextResponse.json({ tickets: result, timestamp: Date.now() }, { headers: corsHeaders });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { ticketId, status } = body;

    const ticket = db.kitchenTickets.find((k) => k.id === ticketId);
    if (!ticket) {
      return NextResponse.json({ error: 'Kitchen ticket not found' }, { status: 404, headers: corsHeaders });
    }

    ticket.status = status;
    if (status === 'ACCEPTED') {
      ticket.acceptedAtMs = Date.now();
    } else if (status === 'SERVED') {
      ticket.deliveredAtMs = Date.now();
    }

    // Update parent order fulfillment status
    const parentOrder = db.orders.find((o) => o.id === ticket.orderId);
    if (parentOrder) {
      parentOrder.updatedAt = new Date().toISOString();
      const allTickets = db.kitchenTickets.filter((k) => k.orderId === ticket.orderId);
      const allServed = allTickets.every((k) => k.status === 'SERVED');
      const allReady = allTickets.every((k) => k.status === 'READY' || k.status === 'SERVED');
      const anyCooking = allTickets.some((k) => k.status === 'PREPARING' || k.status === 'ACCEPTED');

      if (allServed) {
        parentOrder.fulfillmentStatus = 'SERVED';
      } else if (allReady) {
        parentOrder.fulfillmentStatus = 'READY';
      } else if (anyCooking || status === 'ACCEPTED') {
        parentOrder.fulfillmentStatus = 'PREPARING';
      }
    }

    refreshTableSummaries();
    persistDb();

    db.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actionType: 'KITCHEN_STATUS_CHANGE',
      module: 'KITCHEN',
      usernameSnapshot: 'Chef Station',
      orderCode: ticket.customerCode,
      tableCode: ticket.tableCode,
      reason: `Station ${ticket.stationLabel} marked ticket as ${status}`,
      success: true,
    });

    return NextResponse.json({ success: true, ticket }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'CLEAR_SERVED';

    if (action === 'CLEAR_ALL') {
      db.kitchenTickets = [];
    } else {
      // CLEAR_SERVED: Remove all served tickets
      db.kitchenTickets = (db.kitchenTickets || []).filter((k) => k.status !== 'SERVED');
    }

    persistDb();
    return NextResponse.json({ success: true, tickets: db.kitchenTickets }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
