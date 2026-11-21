import { NextResponse } from 'next/server';
import { db, persistDb } from '@/lib/serverDb';

export async function GET() {
  try {
    return NextResponse.json({
      staff: db.staffUsers || [],
      sessions: db.loginSessions || [],
      logs: db.staffActivityLogs || [],
      activeCount: (db.loginSessions || []).filter((s) => s.status === 'ACTIVE').length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('id') || searchParams.get('staffId');

    if (staffId) {
      const initialCount = (db.staffUsers || []).length;
      db.staffUsers = (db.staffUsers || []).filter(
        (s) => s.id !== staffId && s.username !== staffId
      );
      db.loginSessions = (db.loginSessions || []).filter((s) => s.staffId !== staffId);
      persistDb();
      return NextResponse.json({
        success: true,
        message: `Staff member removed successfully (${initialCount - db.staffUsers.length} deleted).`,
      });
    }

    db.staffUsers = [];
    db.loginSessions = [];
    db.staffActivityLogs = [];
    persistDb();
    return NextResponse.json({ success: true, message: 'All staff, session, and activity data reset cleanly.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
