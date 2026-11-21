import { NextResponse } from 'next/server';
import { db, refreshTableSummaries, persistDb } from '@/lib/serverDb';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  refreshTableSummaries();
  return NextResponse.json(db.tables, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (Array.isArray(body.tables)) {
      if (body.forceWipe && body.tables.length === 0) {
        // Only for explicit factory reset
        db.tables = [];
      } else {
        // ALWAYS preserve and merge existing tables & rooms. Never wipe existing tables.
        for (const t of body.tables) {
          if (!t.tableCode) continue;
          const code = t.tableCode.toUpperCase();
          const targetRoom = (t.roomName || 'Dining Area').trim();
          
          // Match by both tableCode AND roomName so rooms never conflict or overwrite each other
          const existing = db.tables.find(
            (ex) => ex.tableCode.toUpperCase() === code && (ex.roomName || 'Dining Area').toLowerCase() === targetRoom.toLowerCase()
          );

          if (existing) {
            if (t.displayName) existing.displayName = t.displayName;
            if (t.capacity) existing.capacity = t.capacity;
            existing.roomName = targetRoom;
          } else {
            db.tables.push({
              id: t.id || `t-${code.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              tableCode: code,
              displayName: t.displayName || `${targetRoom} - Table ${code}`,
              roomName: targetRoom,
              capacity: t.capacity || 4,
              status: 'AVAILABLE',
              unpaidCount: 0,
              unpaidTotalPaise: 0,
            });
          }
        }
      }
    }
    refreshTableSummaries();
    persistDb();

    return NextResponse.json({ success: true, tables: db.tables }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tableCode = searchParams.get('tableCode');
    if (!tableCode) {
      return NextResponse.json({ error: 'tableCode is required' }, { status: 400, headers: corsHeaders });
    }

    const targetTable = db.tables.find((t) => t.tableCode.toUpperCase() === tableCode.toUpperCase());
    if (targetTable && targetTable.unpaidCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete Table ${tableCode.toUpperCase()} because it has active unpaid dining orders. Please settle or cancel pending orders first.` },
        { status: 400, headers: corsHeaders }
      );
    }

    db.tables = db.tables.filter((t) => t.tableCode.toUpperCase() !== tableCode.toUpperCase());
    refreshTableSummaries();
    persistDb();

    return NextResponse.json({ success: true, tables: db.tables }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
