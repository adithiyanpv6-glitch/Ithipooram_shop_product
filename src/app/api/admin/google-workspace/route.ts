import { NextResponse } from 'next/server';
import { getGoogleWorkspaceConfig, saveGoogleWorkspaceConfig } from '@/config/googleWorkspace';
import { verifyMasterPin } from '@/lib/serverDb';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const config = getGoogleWorkspaceConfig();
  return NextResponse.json({ success: true, config }, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminEmail, spreadsheetId, spreadsheetUrl, webhookUrl, pin } = body;

    if (pin && !verifyMasterPin(pin)) {
      return NextResponse.json({ error: 'Invalid Master Security PIN' }, { status: 401, headers: corsHeaders });
    }

    const updates: any = {};
    if (adminEmail !== undefined) updates.adminEmail = String(adminEmail).trim();
    if (spreadsheetId !== undefined) updates.spreadsheetId = String(spreadsheetId).trim();
    if (spreadsheetUrl !== undefined) updates.spreadsheetUrl = String(spreadsheetUrl).trim();
    if (webhookUrl !== undefined) updates.webhookUrl = String(webhookUrl).trim();

    const saved = saveGoogleWorkspaceConfig(updates);
    return NextResponse.json({ success: true, config: saved }, { headers: corsHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to update config' }, { status: 500, headers: corsHeaders });
  }
}
