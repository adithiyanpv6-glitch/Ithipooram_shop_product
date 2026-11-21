// ============================================================================
// ITHI POORAM (ഇത്തിപ്പൂരം) — GOOGLE WORKSPACE & GOOGLE SHEETS CONFIGURATION
// Linked Spreadsheet: https://docs.google.com/spreadsheets/d/1sk_qbGAP74h26oYiDkMin815GbKikMJf6cqdK4thT4Y/edit
// Admin Account: ithipoorampos@gmail.com
// Supports runtime updating and disk persistence
// ============================================================================

import fs from 'fs';
import path from 'path';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'data', 'google_workspace_config.json');

const DEFAULT_CONFIG = {
  adminEmail: 'ithipoorampos@gmail.com',
  spreadsheetId: '1sk_qbGAP74h26oYiDkMin815GbKikMJf6cqdK4thT4Y',
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1sk_qbGAP74h26oYiDkMin815GbKikMJf6cqdK4thT4Y/edit?usp=sharing',
  restaurantName: 'ITHI POORAM (ഇത്തിപ്പൂരം)',
  restaurantLocation: 'Vanchiyoor, Trivandrum',
  sheets: {
    sales: 'Sales_Ledger',
    menu: 'Menu_Stock',
    tables: 'Tables_Master',
    billing: 'Billing_Settlement',
    staff: 'Staff_Registry',
  },
  webhookUrl: process.env.GOOGLE_WORKSPACE_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbyOWefQz6VFbo9qJe1xrxQJONe8rqCWnhGuBwIfRKJwc3-izravBVOL9NmqUJVKHUiegA/exec',
};

export function getGoogleWorkspaceConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {}
  return DEFAULT_CONFIG;
}

export function saveGoogleWorkspaceConfig(updates: Partial<typeof DEFAULT_CONFIG>) {
  try {
    const current = getGoogleWorkspaceConfig();
    const merged = { ...current, ...updates };
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  } catch (e) {
    console.error('Failed to save google workspace config:', e);
    return DEFAULT_CONFIG;
  }
}

export const GOOGLE_WORKSPACE_CONFIG = getGoogleWorkspaceConfig();
