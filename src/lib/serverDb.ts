import fs from 'fs';
import path from 'path';
// Central Restaurant Database Engine for Ithi Pooram
// Provides unified cross-app state for Billing POS, Kitchen Display, Customer Ordering, and Admin Analytics.

import { INITIAL_MENU_CATEGORIES } from './mockData';

export interface RestaurantTable {
  id: string;
  tableCode: string;
  displayName: string;
  capacity: number;
  roomName?: string; // e.g. 'Living Room', 'AC Room', 'Dining Area', 'Family Hall', 'Garden'
  status: 'AVAILABLE' | 'ACTIVE_ORDER' | 'BILL_PENDING' | 'CLOSED';
  unpaidCount: number;
  unpaidTotalPaise: number;
}

export interface OrderItem {
  id: string;
  itemId: string;
  itemName: string;
  itemMalayalamName?: string;
  quantity: number;
  pricePaise: number;
  lineTotalPaise: number;
  station: 'MAIN_KITCHEN' | 'SEAFOOD_FRY' | 'BEVERAGE_COUNTER';
  notes?: string;
}

export interface RestaurantOrder {
  id: string;
  customerCode: string; // e.g. TQ1-01
  tableCode: string;
  tableName: string;
  deviceSessionId?: string; // Links this order to the specific customer phone session
  roundCount?: number; // 1 = initial order, 2+ = add-on dishes added
  items: OrderItem[];
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  grandTotalPaise: number;
  fulfillmentStatus: 'PENDING_CONFIRMATION' | 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED';
  paymentMode?: 'CASH' | 'UPI' | 'CARD' | 'SPLIT_PAYMENT';
  paymentRef?: string;
  cashierName?: string;
  createdAt: string;
  updatedAt?: string;
  paidAt?: string;
}

export interface KitchenTicket {
  id: string;
  orderId: string;
  customerCode: string;
  tableCode: string;
  tableName: string;
  roomName?: string; // e.g. 'Living Room', 'AC Room', 'Dining Area', 'Garden', 'Family Hall'
  station: 'MAIN_KITCHEN' | 'SEAFOOD_FRY' | 'BEVERAGE_COUNTER';
  stationLabel: string;
  status: 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED';
  createdAtMs: number;
  acceptedAtMs?: number;
  deliveredAtMs?: number;
  tableNotes?: string;
  items: Array<{ id: string; name: string; malayalamName?: string; qty: number; notes?: string }>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actionType: string;
  module: 'AUTH' | 'BILLING' | 'ORDER' | 'KITCHEN' | 'MENU' | 'TABLE_QR';
  usernameSnapshot: string;
  orderCode?: string;
  tableCode?: string;
  invoiceNumber?: string;
  reason?: string;
  success: boolean;
}

export interface MenuItemDb {
  id: string;
  name: string;
  malayalamName?: string;
  description?: string;
  pricePaise: number;
  dietary?: 'VEG' | 'NON_VEG' | 'SEAFOOD';
  isAvailable: boolean;
  currentStock?: number | null;
  station?: string;
  category?: string;
}

export interface MenuCategoryDb {
  id: string;
  name: string;
  malayalamName?: string;
  items: MenuItemDb[];
}

export interface StaffUserRecord {
  id: string;
  fullName: string;
  username: string;
  pin: string;
  role: 'MAIN_ADMIN' | 'MANAGER' | 'CASHIER' | 'KITCHEN_STAFF' | 'MENU_EDITOR';
  station: string;
  isActive: boolean;
  registeredAt: string;
  totalLogins: number;
  notes?: string;
}

export interface StaffLoginSession {
  sessionId: string;
  staffId: string;
  fullName: string;
  username: string;
  role: string;
  station: string;
  loginDate: string;
  loginTime: string;
  clientIp: string;
  status: 'ACTIVE' | 'LOGGED_OUT';
  lastActive: string;
}

export interface StaffActivityLog {
  id: string;
  timestamp: string;
  actionType: 'STAFF_REGISTRATION' | 'LOGIN_SUCCESS' | 'LOGOUT' | 'LOGIN_FAILED' | 'STATUS_UPDATE';
  usernameSnapshot: string;
  fullNameSnapshot: string;
  roleSnapshot: string;
  details: string;
  success: boolean;
}

// Global singleton to persist state in Node.js server environment across route calls
declare global {
  var __ITHIPOORAM_DB__: {
    tables: RestaurantTable[];
    orders: RestaurantOrder[];
    kitchenTickets: KitchenTicket[];
    auditLogs: AuditLogEntry[];
    menuCategories: MenuCategoryDb[];
    masterPin?: string;
    staffUsers: StaffUserRecord[];
    loginSessions: StaffLoginSession[];
    staffActivityLogs: StaffActivityLog[];
    dailyMenuHistory?: any[];
    currentBusinessDate?: string;
    dailyOrderSequence?: number;
    dailyInvoiceSequence?: number;
    historicalSales: Array<{
      id?: string;
      invoiceNumber: string;
      orderCode: string;
      tableCode: string;
      roomName?: string;
      grandTotalPaise: number;
      paymentMode: string;
      settledAt: string;
      cashier: string;
      items?: any[];
      itemsSummary?: string;
    }>;
  } | undefined;
}

const DEFAULT_TABLES: RestaurantTable[] = [];

export function generateStaffId(name: string, orderNumber: number): string {
  const lettersOnly = (name || '').trim().replace(/[^a-zA-Z]/g, '').toLowerCase();
  const prefix = lettersOnly.length >= 3 
    ? lettersOnly.substring(0, 3) 
    : (lettersOnly + 'stf').substring(0, 3);
  const orderStr = String(orderNumber).padStart(3, '0');
  return `ithi_${prefix}_${orderStr}`;
}

const DEFAULT_STAFF_DATABASE: StaffUserRecord[] = [];

const INITIAL_SESSIONS: StaffLoginSession[] = [];

const INITIAL_STAFF_ACTIVITY: StaffActivityLog[] = [];

if (!global.__ITHIPOORAM_DB__) {
  global.__ITHIPOORAM_DB__ = {
    tables: [],
    orders: [],
    kitchenTickets: [],
    auditLogs: [
      {
        id: 'aud-init-1',
        timestamp: new Date().toISOString(),
        actionType: 'SYSTEM_BOOT',
        module: 'AUTH',
        usernameSnapshot: 'System',
        reason: 'Restaurant core database engine initialized.',
        success: true,
      }
    ],
    menuCategories: [],
    staffUsers: [...DEFAULT_STAFF_DATABASE],
    loginSessions: [...INITIAL_SESSIONS],
    staffActivityLogs: [...INITIAL_STAFF_ACTIVITY],
    historicalSales: [],
  };
} else {
  // Ensure staffUsers, loginSessions, and staffActivityLogs exist
  if (!global.__ITHIPOORAM_DB__.staffUsers) {
    global.__ITHIPOORAM_DB__.staffUsers = [];
  }
  if (!global.__ITHIPOORAM_DB__.loginSessions) {
    global.__ITHIPOORAM_DB__.loginSessions = [];
  }
  if (!global.__ITHIPOORAM_DB__.staffActivityLogs) {
    global.__ITHIPOORAM_DB__.staffActivityLogs = [];
  }

  // Clear any legacy mock staff/sessions so database is completely fresh
  if (global.__ITHIPOORAM_DB__.staffUsers?.some((s) => s.id?.startsWith('IP-STF-') || s.username === 'gokul' || s.username === 'admin')) {
    global.__ITHIPOORAM_DB__.staffUsers = [];
    global.__ITHIPOORAM_DB__.loginSessions = [];
    global.__ITHIPOORAM_DB__.staffActivityLogs = [];
  }

  // Clear any legacy/test tables so tables only appear when explicitly added by shop owner
  if (global.__ITHIPOORAM_DB__.tables?.some((t) => t.id === 't1' || t.tableCode === 'T1A' || t.tableCode === 'T2B' || t.id === 't-t1a-ac' || t.displayName?.includes('Verandah'))) {
    global.__ITHIPOORAM_DB__.tables = [];
  }
  // Clear any legacy/test menu so dishes only appear when explicitly added by admin
  if (global.__ITHIPOORAM_DB__.menuCategories?.some((c) => c.id === 'cat-1' || c.name === 'Kerala Specials' || c.items?.some((it) => it.id === 'm1' || it.name === 'Idli' || it.name === 'Chicken 65'))) {
    global.__ITHIPOORAM_DB__.menuCategories = [];
  }
}


const DB_FILE_PATH = path.join(process.cwd(), 'data', 'restaurant_store.json');
const BACKUP_FILE_PATH = path.join(process.cwd(), 'data', 'restaurant_store.bak');
const LEDGER_DIR = path.join(process.cwd(), 'data', 'daily_ledgers');

// Helper to get local date in Indian Standard Time (IST - Asia/Kolkata: YYYY-MM-DD)
export function getIstDateString(d: Date | string = new Date()): string {
  try {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Returns formatted Day of Week and Date in Indian Standard Time (IST).
 * E.g., dayName: "Friday", dateStr: "2026-11-20", formattedDate: "20 November 2026"
 */
export function getIstDayAndDateString(d: Date | string = new Date()): {
  dayName: string;
  dateStr: string;
  formattedDate: string;
  headerLabel: string;
} {
  try {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    const dayName = dateObj.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' });
    const dateStr = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const formattedDate = dateObj.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
    return {
      dayName,
      dateStr,
      formattedDate,
      headerLabel: `📅 ${dayName} — ${formattedDate} (${dateStr})`
    };
  } catch {
    const dateStr = getIstDateString(d);
    return {
      dayName: 'Day',
      dateStr,
      formattedDate: dateStr,
      headerLabel: `📅 ${dateStr}`
    };
  }
}

/**
 * Robust universal date normalizer. Converts any input (today, yesterday, YYYY-MM-DD,
 * DD/MM/YYYY, DD-MM-YYYY, DD-MMM-YYYY, ISO strings) to standard YYYY-MM-DD in IST.
 */
export function normalizeToIsoDate(input: string | Date | null | undefined): string {
  if (!input) return getIstDateString();
  if (input instanceof Date) return getIstDateString(input);
  const s = String(input).trim();
  if (!s || s.toLowerCase() === 'today') return getIstDateString();
  if (s.toLowerCase() === 'yesterday') return getIstDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));

  // If already standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Handles DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, DD-MMM-YYYY
  const parts = s.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const [y, m, d] = parts;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (parts[2].length === 4) {
      // DD-MM-YYYY or DD-Mon-YYYY
      const [d, mRaw, y] = parts;
      const monthMap: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      };
      const mLower = mRaw.toLowerCase().slice(0, 3);
      const m = monthMap[mLower] || mRaw.padStart(2, '0');
      return `${y}-${m}-${d.padStart(2, '0')}`;
    }
  }

  try {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return getIstDateString(parsed);
    }
  } catch {}

  return s;
}

// Append immutable settlement record to permanent date-partitioned disk ledger
export function appendToDailyLedger(entry: {
  id?: string;
  invoiceNumber: string;
  orderCode: string;
  tableCode: string;
  roomName?: string;
  grandTotalPaise: number;
  paymentMode: string;
  settledAt: string;
  cashier: string;
  items?: any[];
  itemsSummary?: string;
}) {
  try {
    if (!fs.existsSync(LEDGER_DIR)) {
      fs.mkdirSync(LEDGER_DIR, { recursive: true });
    }
    const targetDate = getIstDateString(entry.settledAt || new Date());
    const ledgerFile = path.join(LEDGER_DIR, `${targetDate}.json`);
    let list: any[] = [];
    if (fs.existsSync(ledgerFile)) {
      try {
        const raw = fs.readFileSync(ledgerFile, 'utf8');
        list = JSON.parse(raw);
        if (!Array.isArray(list)) list = [];
      } catch {}
    }
    const existingIdx = list.findIndex(
      (item) => item.invoiceNumber === entry.invoiceNumber || (item.orderCode && item.orderCode === entry.orderCode)
    );
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...entry };
    } else {
      list.push(entry);
    }
    const tmpLedger = `${ledgerFile}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
    fs.writeFileSync(tmpLedger, JSON.stringify(list, null, 2), 'utf8');
    try {
      fs.renameSync(tmpLedger, ledgerFile);
    } catch {
      try { fs.writeFileSync(ledgerFile, JSON.stringify(list, null, 2), 'utf8'); } catch {}
    }

    // Keep memory historicalSales in perfect sync
    if (!Array.isArray(db.historicalSales)) db.historicalSales = [];
    const histIdx = db.historicalSales.findIndex(
      (h) => h.invoiceNumber === entry.invoiceNumber || (h.orderCode && h.orderCode === entry.orderCode)
    );
    if (histIdx >= 0) {
      db.historicalSales[histIdx] = { ...db.historicalSales[histIdx], ...entry };
    } else {
      db.historicalSales.unshift(entry);
    }
  } catch (err) {
    console.error('[Daily Ledger] Failed to append entry:', err);
  }
}

// Read all immutable settlements across all recorded history
export function readAllDailyLedgers(): any[] {
  try {
    if (!fs.existsSync(LEDGER_DIR)) return [];
    const files = fs.readdirSync(LEDGER_DIR).filter((f) => f.endsWith('.json')).sort().reverse();
    const all: any[] = [];
    const seen = new Set<string>();
    for (const file of files) {
      try {
        let raw = fs.readFileSync(path.join(LEDGER_DIR, file), 'utf8');
        if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            const key = item.invoiceNumber || item.orderCode || item.id;
            if (key && !seen.has(key)) {
              seen.add(key);
              all.push(item);
            }
          }
        }
      } catch {}
    }
    return all;
  } catch (err) {
    console.warn('[Daily Ledger] Error reading all ledgers:', err);
    return [];
  }
}

// Read all immutable settlements for any given IST date
export function readDailyLedger(targetDate: string): any[] {
  try {
    const normDate = normalizeToIsoDate(targetDate);
    const ledgerFile = path.join(LEDGER_DIR, `${normDate}.json`);
    if (fs.existsSync(ledgerFile)) {
      let raw = fs.readFileSync(ledgerFile, 'utf8');
      if (raw.charCodeAt(0) === 0xFEFF) {
        raw = raw.slice(1);
      }
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }

    // Fallback: search in-memory historicalSales for matching IST date
    const matched = (db.historicalSales || []).filter((s) => {
      return normalizeToIsoDate(s.settledAt) === normDate;
    });
    if (matched.length > 0) return matched;
  } catch (err) {
    console.warn('[Daily Ledger] Error reading ledger for', targetDate, err);
  }
  return [];
}

export function persistDb() {
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = JSON.stringify(db, null, 2);
    const tmpFile = `${DB_FILE_PATH}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
    fs.writeFileSync(tmpFile, content, 'utf8');
    // Save backup if DB has active tables or historical sales
    if (db.tables && db.tables.length > 0) {
      try {
        fs.copyFileSync(tmpFile, BACKUP_FILE_PATH);
      } catch {}
    }

    // Atomic replace on Windows with retry loop
    let renamed = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.renameSync(tmpFile, DB_FILE_PATH);
        renamed = true;
        break;
      } catch {
        const start = Date.now();
        while (Date.now() - start < 15) {}
      }
    }
    if (!renamed) {
      try { fs.writeFileSync(DB_FILE_PATH, content, 'utf8'); } catch {}
    }
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
  } catch (err) {
    console.error('[Database Engine] Failed to persist state to disk:', err);
  }
}

export function loadDbFromDisk() {
  try {
    let sourcePath = DB_FILE_PATH;
    if (!fs.existsSync(sourcePath) && fs.existsSync(BACKUP_FILE_PATH)) {
      sourcePath = BACKUP_FILE_PATH;
    }
    if (fs.existsSync(sourcePath)) {
      let raw = fs.readFileSync(sourcePath, 'utf8');
      if (raw.charCodeAt(0) === 0xFEFF) {
        raw = raw.slice(1); // Strip Windows PowerShell UTF-8 BOM
      }
      const loaded = JSON.parse(raw);
      if (loaded && Array.isArray(loaded.tables)) {
        // Strip any legacy/test tables and dishes so shop handover starts 100% clean
        db.tables = loaded.tables.filter((t: any) => !['T1A', 'T1B', 'T2A', 'T2B'].includes(t.tableCode) && !t.id?.includes('t1a') && !t.displayName?.includes('Verandah'));
        db.orders = [];
        db.kitchenTickets = [];
        db.menuCategories = (loaded.menuCategories || []).filter((c: any) => c.name !== 'Kerala Specials' && !c.items?.some((it: any) => it.name === 'Idli' || it.name === 'Chicken 65'));
        db.masterPin = loaded.masterPin || '8181';
        db.staffUsers = Array.isArray(loaded.staffUsers) ? loaded.staffUsers : [];
        db.loginSessions = [];
        db.staffActivityLogs = [];
        db.historicalSales = loaded.historicalSales || [];
        db.currentBusinessDate = loaded.currentBusinessDate;
        db.dailyOrderSequence = 0;
        db.dailyInvoiceSequence = 0;
        console.log('[Database Engine] Successfully restored restaurant database from disk:', sourcePath);
      }
    }

    // Always synchronize and merge historicalSales with immutable daily ledgers on disk
    const allDiskLedgers = readAllDailyLedgers();
    const existingCodes = new Set((db.historicalSales || []).map((s) => s.invoiceNumber || s.orderCode || s.id));
    for (const dItem of allDiskLedgers) {
      const code = dItem.invoiceNumber || dItem.orderCode || dItem.id;
      if (code && !existingCodes.has(code)) {
        existingCodes.add(code);
        db.historicalSales.push(dItem);
      }
    }
    if (db.historicalSales.length > 0) {
      console.log(`[Database Engine] Synchronized ${db.historicalSales.length} historical sales from permanent daily ledgers.`);
    }
  } catch (err) {
    console.warn('[Database Engine] Could not load from disk, initialized empty:', err);
    if (fs.existsSync(BACKUP_FILE_PATH)) {
      try {
        let bRaw = fs.readFileSync(BACKUP_FILE_PATH, 'utf8');
        if (bRaw.charCodeAt(0) === 0xFEFF) {
          bRaw = bRaw.slice(1);
        }
        const bLoaded = JSON.parse(bRaw);
        if (bLoaded && Array.isArray(bLoaded.tables)) {
          db.tables = bLoaded.tables;
          db.orders = bLoaded.orders || [];
          db.menuCategories = bLoaded.menuCategories || [];
          db.masterPin = bLoaded.masterPin || '';
          db.historicalSales = bLoaded.historicalSales || [];
          console.log('[Database Engine] Recovered database state from backup file:', BACKUP_FILE_PATH);
        }
      } catch {}
    }
  }
}

export function checkAndPerformDailyReset() {
  const todayStr = getIstDateString(); // ALWAYS USE IST!
  if (!db.currentBusinessDate) {
    db.currentBusinessDate = todayStr;
    db.dailyOrderSequence = 0;
    db.dailyInvoiceSequence = 0;
    persistDb();
  } else if (db.currentBusinessDate !== todayStr) {
    console.log(`[Day Reset] Advancing business date from ${db.currentBusinessDate} to ${todayStr}`);
    
    // Automatically archive paid orders to daily ledger before day rollover
    const paidOrders = (db.orders || []).filter((o) => o.paymentStatus === 'PAID');
    for (const po of paidOrders) {
      appendToDailyLedger({
        invoiceNumber: (po as any).invoiceNumber || `INV-${po.customerCode.replace('#', '')}`,
        orderCode: po.customerCode,
        tableCode: po.tableCode,
        roomName: (db.tables || []).find((t) => t.tableCode === po.tableCode)?.roomName || 'Dining Area',
        grandTotalPaise: po.grandTotalPaise,
        paymentMode: po.paymentMode || 'CASH',
        settledAt: po.paidAt || po.createdAt || new Date().toISOString(),
        cashier: po.cashierName || 'Cashier',
        items: po.items || [],
        itemsSummary: (po.items || []).map((i: any) => `${i.itemName} X ${i.quantity}`).join(', '),
      });
    }

    db.currentBusinessDate = todayStr;
    db.dailyOrderSequence = 0;
    db.dailyInvoiceSequence = 0;
    db.kitchenTickets = [];
    db.orders = [];
    
    // PERMANENT TABLE REGISTRATION: Tables & rooms are permanent fixtures and NEVER wiped.
    // Only daily operational states (running balances and order occupancy) reset for the new business day.
    db.tables.forEach(t => {
      t.status = 'AVAILABLE';
      t.unpaidCount = 0;
      t.unpaidTotalPaise = 0;
      t.roomName = t.roomName || 'Dining Area';
    });
    persistDb();
  }
}

export const db = global.__ITHIPOORAM_DB__;
loadDbFromDisk();
checkAndPerformDailyReset();

export function getMasterPin(): string {
  return (db.masterPin || '').trim();
}

export function isMasterPinSet(): boolean {
  return Boolean(db.masterPin && db.masterPin.trim().length >= 4);
}

export function setMasterPin(newPin: string): boolean {
  const clean = (newPin || '').trim();
  if (clean.length < 4) return false;
  db.masterPin = clean;
  persistDb();
  return true;
}

export function verifyMasterPin(inputPin: string): boolean {
  const clean = (inputPin || '').trim();
  if (!clean) return false;
  const current = getMasterPin();
  if (!current) return false;
  return clean === current;
}

// Helper to recalculate table unpaid totals
export function refreshTableSummaries() {
  // Recalculate unpaid totals and table occupancy status case-insensitively
  // NOTE: In a real-world restaurant, tables are registered permanently by the shopkeeper.
  // We do NOT auto-inject ghost tables for arbitrary or test order tableCodes.
  for (const table of db.tables) {
    table.roomName = table.roomName || 'Dining Area';
    const tableOrders = db.orders.filter(
      (o) => (o.tableCode || '').toUpperCase() === (table.tableCode || '').toUpperCase() && o.paymentStatus === 'UNPAID'
    );
    table.unpaidCount = tableOrders.length;
    table.unpaidTotalPaise = tableOrders.reduce((sum, o) => sum + (o.grandTotalPaise || 0), 0);

    if (table.unpaidCount > 0) {
      const hasReady = tableOrders.some((o) => o.fulfillmentStatus === 'READY' || o.fulfillmentStatus === 'SERVED');
      table.status = hasReady ? 'BILL_PENDING' : 'ACTIVE_ORDER';
    } else {
      table.status = 'AVAILABLE';
    }
  }
  persistDb();
}


/**
 * Helper to get current date parts in Indian Standard Time (IST)
 */
export function getIstDateTime(): {
  datePrefix: string; // YYYYMMDD, e.g. "20261115"
  dateStr: string;    // DD/MM/YYYY, e.g. "15/11/2026"
  timeStr: string;    // hh:mm AM/PM, e.g. "12:55 PM"
  isoString: string;
} {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const parts = istFormatter.formatToParts(now);
  const getVal = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const yyyy = getVal('year');
  const mm = getVal('month');
  const dd = getVal('day');
  const hour = getVal('hour');
  const minute = getVal('minute');
  const dayPeriod = (getVal('dayPeriod') || '').toUpperCase();

  const datePrefix = `${yyyy}${mm}${dd}`;
  const dateStr = `${dd}/${mm}/${yyyy}`;
  const timeStr = `${hour}:${minute} ${dayPeriod}`.trim();

  return {
    datePrefix,
    dateStr,
    timeStr,
    isoString: now.toISOString(),
  };
}

/**
 * Generates the synchronized sequential invoice number for today:
 * Format: YYYYMMDD-001, YYYYMMDD-002, etc.
 * Resets each day at midnight IST.
 */
export function generateDailySequentialInvoiceNumber(): {
  invoiceNumber: string;
  dateStr: string;
  timeStr: string;
} {
  checkAndPerformDailyReset();
  const { datePrefix, dateStr, timeStr } = getIstDateTime();

  let maxSeq = db.dailyInvoiceSequence || 0;
  for (const h of db.historicalSales || []) {
    if (h.invoiceNumber && h.invoiceNumber.startsWith(`${datePrefix}-`)) {
      const parts = h.invoiceNumber.split('-');
      if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  db.dailyInvoiceSequence = nextSeq;
  persistDb();

  const invoiceNumber = `${datePrefix}-${String(nextSeq).padStart(3, '0')}`;
  return { invoiceNumber, dateStr, timeStr };
}

/**
 * Formats a clean 58mm thermal receipt text strictly adhering to requirements:
 * 1. Brand name calligraphy heading: ഇത്തിപ്പൂരം / ITHI POORAM
 * 2. ONLY the place name under that: Vanchiyoor, Trivandrum (No GSTIN, no extra lines)
 * 3. Daily synced invoice number (YYYYMMDD-001)
 * 4. Date and Time
 * 5. Table name
 * 6. Cashier name
 * 7. Items (name, qty, rate, total)
 * 8. NO TAXES (Zero GST, no tax breakdown)
 * 9. Grand Total
 * 10. Payment Type
 * 11. Footer: Malayalam & English thank you (നന്ദി! വീണ്ടും വരിക / Thank You! Visit Again)
 */
export function formatIthiPooramThermalReceipt({
  invoiceNumber,
  dateStr,
  timeStr,
  tableName,
  cashierName,
  items,
  grandTotalPaise,
  paymentMode,
}: {
  invoiceNumber: string;
  dateStr: string;
  timeStr: string;
  tableName: string;
  cashierName: string;
  items: Array<{ name: string; qty: number; pricePaise: number; lineTotalPaise: number }>;
  grandTotalPaise: number;
  paymentMode: string;
}): string {
  const grandTotal = (grandTotalPaise / 100).toFixed(2);

  const formattedItems = items.map((i) => {
    const rawName = (i.name || 'Dish').trim();
    const name = rawName.length > 16 ? rawName.substring(0, 16) : rawName.padEnd(16);
    const qty = String(i.qty).padStart(3);
    const rate = (i.pricePaise / 100).toFixed(0).padStart(5);
    const tot = (i.lineTotalPaise / 100).toFixed(0).padStart(5);
    return `${name} ${qty} ${rate} ${tot}`;
  }).join('\n');

  return [
    '================================',
    '          ഇത്തിപ്പൂരം',
    '          ITHI POORAM',
    '     Vanchiyoor, Trivandrum',
    '================================',
    `Inv: ${invoiceNumber}`,
    `Date: ${dateStr}  Time: ${timeStr}`,
    `Table: ${tableName}`,
    `Cashier: ${cashierName}`,
    '--------------------------------',
    'ITEM             QTY  RATE TOTAL',
    '--------------------------------',
    formattedItems,
    '--------------------------------',
    `GRAND TOTAL:           ₹${grandTotal.padStart(8)}`,
    `Payment: [${(paymentMode || 'CASH').toUpperCase()}]`,
    '================================',
    '      നന്ദി! വീണ്ടും വരിക',
    '     Thank You! Visit Again',
    '================================',
  ].join('\n');
}
