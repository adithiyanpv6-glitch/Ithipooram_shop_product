import { NextResponse } from 'next/server';
import { printToSeznikBluetoothPrinter } from '@/lib/serverPrinter';

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
    const { receiptText, receiptData, rawText, text, printerName } = body;

    let payloadToPrint = '';
    if (receiptData && typeof receiptData === 'object') {
      payloadToPrint = JSON.stringify(receiptData);
    } else if (receiptText && typeof receiptText === 'string') {
      payloadToPrint = receiptText.trim();
    } else if (rawText && typeof rawText === 'string') {
      payloadToPrint = rawText.trim();
    } else if (text && typeof text === 'string') {
      payloadToPrint = text.trim();
    }

    if (!payloadToPrint) {
      return NextResponse.json(
        { success: false, error: 'receiptText or receiptData is required for printing' },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await printToSeznikBluetoothPrinter(payloadToPrint, printerName || 'B-41');

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Printer request failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}
