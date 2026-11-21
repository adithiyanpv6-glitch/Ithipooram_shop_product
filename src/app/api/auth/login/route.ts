import { NextRequest, NextResponse } from 'next/server';
import { db, isMasterPinSet, setMasterPin, verifyMasterPin, persistDb } from '@/lib/serverDb';
import { pushLiveUpdateToGoogleWorkspace } from '@/lib/googleWorkspaceSync';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  return NextResponse.json({
    isConfigured: isMasterPinSet(),
  }, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const inputPin = (body.password || body.pin || '').trim();

    if (!inputPin) {
      return NextResponse.json(
        { error: '4-digit Security PIN is required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    let user: any = null;

    // If master PIN is not yet configured, first-time user PIN entry sets the master PIN
    if (!isMasterPinSet()) {
      if (inputPin.length < 4) {
        return NextResponse.json(
          { error: 'Security PIN must be at least 4 digits.' },
          { status: 400, headers: corsHeaders }
        );
      }
      setMasterPin(inputPin);
      console.log('[Security Engine] Initial Master Security PIN registered and saved to master database.');
      user = {
        id: 'owner',
        username: 'admin',
        fullName: 'System Administrator',
        role: 'MAIN_ADMIN',
        station: 'POS Main Terminal',
      };
    } else if (verifyMasterPin(inputPin)) {
      // Validated against Master PIN (System Administrator)
      user = {
        id: 'owner',
        username: 'admin',
        fullName: 'System Administrator',
        role: 'MAIN_ADMIN',
        station: 'POS Main Terminal',
      };
    } else {
      // Check registered staff members in master database
      const matchedStaff = (db.staffUsers || []).find((s) => s.pin === inputPin);
      if (matchedStaff) {
        user = {
          id: matchedStaff.id,
          username: matchedStaff.username || matchedStaff.fullName,
          fullName: matchedStaff.fullName,
          role: matchedStaff.role || 'CASHIER',
          station: matchedStaff.station || 'Billing Counter POS 1',
        };
      } else {
        return NextResponse.json(
          { error: 'Incorrect Security PIN. Please try again.' },
          { status: 401, headers: corsHeaders }
        );
      }
    }

    const now = new Date();
    const sessionId = `SES-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

    // Record login session for staff tracking
    if (!db.loginSessions) db.loginSessions = [];
    db.loginSessions.unshift({
      sessionId,
      staffId: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      station: user.station,
      loginDate: now.toLocaleDateString('en-GB'),
      loginTime: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      clientIp: req.headers.get('x-forwarded-for') || '127.0.0.1',
      status: 'ACTIVE',
      lastActive: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    });

    if (!db.staffActivityLogs) db.staffActivityLogs = [];
    db.staffActivityLogs.unshift({
      id: `LOG-${Date.now().toString().slice(-6)}`,
      timestamp: now.toLocaleString('en-IN'),
      actionType: 'LOGIN_SUCCESS',
      usernameSnapshot: user.username,
      fullNameSnapshot: user.fullName,
      roleSnapshot: user.role,
      details: `${user.fullName} (${user.role}) logged in at ${user.station}`,
      success: true,
    });

    persistDb();

    pushLiveUpdateToGoogleWorkspace().catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      token: `jwt-master-${Date.now()}`,
      sessionId,
      user,
    }, { headers: corsHeaders });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: err.message || 'Server error during authentication' },
      { status: 500, headers: corsHeaders }
    );
  }
}
