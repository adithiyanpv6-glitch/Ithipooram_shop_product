import { NextResponse } from 'next/server';
import { reconnectBluetoothPrinter } from '@/lib/serverPrinter';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const result = await reconnectBluetoothPrinter();
  return NextResponse.json(result, { headers: corsHeaders });
}

export async function POST() {
  const result = await reconnectBluetoothPrinter();
  return NextResponse.json(result, { headers: corsHeaders });
}
