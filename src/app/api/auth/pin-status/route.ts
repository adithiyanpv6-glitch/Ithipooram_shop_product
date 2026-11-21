import { NextRequest, NextResponse } from 'next/server';
import { isMasterPinSet, setMasterPin, verifyMasterPin, getMasterPin } from '@/lib/serverDb';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const isSet = isMasterPinSet();
  return NextResponse.json(
    { 
      isConfigured: isSet,
      message: isSet ? 'Master PIN is configured.' : 'First-time setup required: Please register your 4-digit security PIN.'
    }, 
    { headers: corsHeaders }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, currentPin, newPin } = body;

    // Check if system has a master PIN configured
    const isConfigured = isMasterPinSet();

    if (!isConfigured) {
      // First-time setup
      const cleanNewPin = (newPin || body.pin || '').trim();
      if (!cleanNewPin || cleanNewPin.length < 4) {
        return NextResponse.json(
          { error: 'Please enter a valid 4-digit security PIN.' },
          { status: 400, headers: corsHeaders }
        );
      }
      setMasterPin(cleanNewPin);
      return NextResponse.json(
        { success: true, message: 'Master Security PIN registered successfully into the master database!' },
        { headers: corsHeaders }
      );
    }

    if (action === 'verify') {
      const pinToVerify = (currentPin || body.pin || '').trim();
      if (!verifyMasterPin(pinToVerify)) {
        return NextResponse.json(
          { success: false, error: 'Incorrect Security PIN.' },
          { status: 401, headers: corsHeaders }
        );
      }
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // Change existing PIN
    const cleanCurrentPin = (currentPin || '').trim();
    const cleanNewPin = (newPin || '').trim();

    if (!verifyMasterPin(cleanCurrentPin)) {
      return NextResponse.json(
        { error: 'Current PIN is incorrect.' },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!cleanNewPin || cleanNewPin.length < 4) {
      return NextResponse.json(
        { error: 'New PIN must be at least 4 digits.' },
        { status: 400, headers: corsHeaders }
      );
    }

    setMasterPin(cleanNewPin);
    return NextResponse.json(
      { success: true, message: 'Master Security PIN updated successfully in master database!' },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500, headers: corsHeaders });
  }
}
