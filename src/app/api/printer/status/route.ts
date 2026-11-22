import { NextResponse } from 'next/server';
import { getLivePrinterStatus } from '@/lib/serverPrinter';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const status = getLivePrinterStatus();
  return NextResponse.json(status, { headers: corsHeaders });
}
