import { NextResponse } from 'next/server';
import { db, persistDb } from '@/lib/serverDb';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const defaultBillSettings = {
  baseFontSize: 14,
  grandTotalSize: 26,
  itemSize: 14,
  metadataSize: 14,
  placeName: 'Vanchiyoor, Trivandrum',
  lineSpacing: 'relaxed',
  fontPreset: 'large', // 'normal' | 'large' | 'xl'
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const settings = (db as any).billSettings || defaultBillSettings;
  return NextResponse.json({ success: true, settings }, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const current = (db as any).billSettings || defaultBillSettings;
    const updated = {
      ...current,
      ...body,
      baseFontSize: Number(body.baseFontSize) || current.baseFontSize,
      grandTotalSize: Number(body.grandTotalSize) || current.grandTotalSize,
      itemSize: Number(body.itemSize) || current.itemSize,
      metadataSize: Number(body.metadataSize) || current.metadataSize,
      placeName: (body.placeName || current.placeName).trim(),
      lineSpacing: body.lineSpacing || current.lineSpacing,
      fontPreset: body.fontPreset || current.fontPreset,
    };

    (db as any).billSettings = updated;
    persistDb();

    return NextResponse.json({ success: true, settings: updated }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
