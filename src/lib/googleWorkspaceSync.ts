// ============================================================================
// ITHI POORAM (ഇത്തിപ്പൂരം) — GOOGLE WORKSPACE LIVE DATABASE ENGINE
// Admin: ithipoorampos@gmail.com
// Linked Sheet: https://docs.google.com/spreadsheets/d/1sk_qbGAP74h26oYiDkMin815GbKikMJf6cqdK4thT4Y/edit
// Continuously synchronizes Staff, Sessions, and Table Orders directly into
// Google Sheets / Google Workspace without creating multiple files.
// ============================================================================

import { db, refreshTableSummaries } from './serverDb';
import { getGoogleWorkspaceConfig } from '@/config/googleWorkspace';

function escapeCsvCell(val: any): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * 1. Sheet: Staff Register (CSV format for Google Sheets)
 */
export function getStaffRegisterCsv(): string {
  const staff = db.staffUsers || [];
  const header = ['#', 'Staff ID', 'Employee Name', 'Access PIN / Password', 'Role', 'Registration Date & Time'];
  const rows = [header.map(escapeCsvCell).join(',')];

  if (staff.length === 0) {
    rows.push(['-', 'No staff registered yet', 'Fresh database ready', '-', '-', '-'].map(escapeCsvCell).join(','));
  } else {
    staff.forEach((stf, idx) => {
      rows.push([
        idx + 1,
        stf.id,
        stf.fullName,
        stf.pin,
        stf.role,
        stf.registeredAt || 'Today',
      ].map(escapeCsvCell).join(','));
    });
  }

  return rows.join('\r\n');
}

/**
 * 2. Sheet: Live Login Sessions (CSV format for Google Sheets)
 */
export function getLoginSessionsCsv(): string {
  const sessions = db.loginSessions || [];
  const header = ['#', 'Session ID', 'Staff ID', 'Employee Name', 'Role', 'Login Date & Time', 'Session Status', 'Last Active Time'];
  const rows = [header.map(escapeCsvCell).join(',')];

  if (sessions.length === 0) {
    rows.push(['-', 'No active sessions recorded yet', '-', '-', '-', '-', 'CLEAN', '-'].map(escapeCsvCell).join(','));
  } else {
    sessions.forEach((ses, idx) => {
      rows.push([
        idx + 1,
        ses.sessionId,
        ses.staffId,
        ses.fullName,
        ses.role,
        `${ses.loginDate} ${ses.loginTime}`,
        ses.status === 'ACTIVE' ? 'ACTIVE (Online)' : 'LOGGED OUT',
        ses.lastActive || ses.loginTime,
      ].map(escapeCsvCell).join(','));
    });
  }

  return rows.join('\r\n');
}

/**
 * 3. Sheet: Activity Logs (CSV format for Google Sheets)
 */
export function getActivityLogsCsv(): string {
  const logs = db.staffActivityLogs || [];
  const staff = db.staffUsers || [];
  const header = ['#', 'Log ID', 'Date & Time', 'Action / Event', 'Staff ID', 'Employee Name', 'Role', 'Status'];
  const rows = [header.map(escapeCsvCell).join(',')];

  if (logs.length === 0) {
    rows.push(['-', 'No activity recorded yet', '-', '-', '-', '-', '-', '-'].map(escapeCsvCell).join(','));
  } else {
    logs.forEach((log, idx) => {
      const matched = staff.find((s) => s.fullName === log.fullNameSnapshot || s.username === log.usernameSnapshot);
      rows.push([
        idx + 1,
        log.id,
        log.timestamp,
        log.actionType,
        matched ? matched.id : '-',
        log.fullNameSnapshot,
        log.roleSnapshot,
        log.success ? 'SUCCESS' : 'FAILED',
      ].map(escapeCsvCell).join(','));
    });
  }

  return rows.join('\r\n');
}

/**
 * 4. Sheet: Master Table Registry (CSV format for Google Sheets)
 */
export function getTablesCsv(): string {
  refreshTableSummaries();
  const tables = db.tables || [];
  const header = ['#', 'Table Code', 'Display Name', 'Room / Section', 'Capacity (Seats)', 'Unpaid Orders', 'Unpaid Amount (INR)', 'Status'];
  const rows = [header.map(escapeCsvCell).join(',')];

  if (tables.length === 0) {
    rows.push(['-', 'No tables added yet', 'Fresh database ready', '-', '-', '0', '0.00', 'AVAILABLE'].map(escapeCsvCell).join(','));
  } else {
    tables.forEach((t, idx) => {
      rows.push([
        idx + 1,
        t.tableCode,
        t.displayName,
        (t as any).roomName || 'Dining Area',
        t.capacity || 4,
        t.unpaidCount || 0,
        ((t.unpaidTotalPaise || 0) / 100).toFixed(2),
        t.status || 'AVAILABLE',
      ].map(escapeCsvCell).join(','));
    });
  }

  return rows.join('\r\n');
}

/**
 * 5. Sheet: Live Table Orders (CSV format for Google Sheets)
 */
export function getOrdersCsv(): string {
  const orders = db.orders || [];
  const header = ['Order ID', 'Table Code', 'Table Name', 'Time', 'Items Summary', 'Total Amount (INR)', 'Kitchen Status', 'Payment Status'];
  const rows = [header.map(escapeCsvCell).join(',')];

  if (orders.length === 0) {
    rows.push(['-', 'No customer orders placed yet', 'Fresh database ready', '-', '-', '0.00', '-', '-'].map(escapeCsvCell).join(','));
  } else {
    orders.forEach((o) => {
      const itemsSummary = (o.items || []).map((it) => `${it.quantity}x ${it.itemName}`).join('; ');
      rows.push([
        o.customerCode || o.id,
        o.tableCode,
        o.tableName,
        o.createdAt ? new Date(o.createdAt).toLocaleTimeString('en-IN') : 'Recent',
        itemsSummary,
        ((o.grandTotalPaise || 0) / 100).toFixed(2),
        o.fulfillmentStatus,
        o.paymentStatus,
      ].map(escapeCsvCell).join(','));
    });
  }

  return rows.join('\r\n');
}

/**
 * Full JSON snapshot of all databases for live Google Sheets push
 */
export function getFullGoogleWorkspacePayload() {
  refreshTableSummaries();
  const config = getGoogleWorkspaceConfig();
  return {
    adminEmail: config.adminEmail,
    restaurant: config.restaurantName,
    location: config.restaurantLocation,
    updatedAt: new Date().toISOString(),
    staff: (db.staffUsers || []).map((s, idx) => ({
      index: idx + 1,
      staffId: s.id,
      name: s.fullName,
      pin: s.pin,
      role: s.role,
      registeredAt: s.registeredAt || 'Today',
    })),
    sessions: (db.loginSessions || []).map((ses, idx) => ({
      index: idx + 1,
      sessionId: ses.sessionId,
      staffId: ses.staffId,
      name: ses.fullName,
      role: ses.role,
      loginDateTime: `${ses.loginDate} ${ses.loginTime}`,
      status: ses.status,
      lastActive: ses.lastActive || ses.loginTime,
    })),
    activityLogs: (db.staffActivityLogs || []).map((log, idx) => {
      const matched = (db.staffUsers || []).find((s) => s.fullName === log.fullNameSnapshot || s.username === log.usernameSnapshot);
      return {
        index: idx + 1,
        logId: log.id,
        timestamp: log.timestamp,
        action: log.actionType,
        staffId: matched ? matched.id : '-',
        name: log.fullNameSnapshot,
        role: log.roleSnapshot,
        status: log.success ? 'SUCCESS' : 'FAILED',
      };
    }),
    tables: (db.tables || []).map((t, idx) => ({
      index: idx + 1,
      tableCode: t.tableCode,
      displayName: t.displayName,
      room: (t as any).roomName || 'Dining Area',
      capacity: t.capacity || 4,
      unpaidOrders: t.unpaidCount || 0,
      unpaidAmountPaise: t.unpaidTotalPaise || 0,
      status: t.status,
    })),
    orders: (db.orders || []).map((o) => ({
      orderId: o.customerCode || o.id,
      tableCode: o.tableCode,
      tableName: o.tableName,
      time: o.createdAt,
      items: (o.items || []).map((it) => `${it.quantity}x ${it.itemName}`).join('; '),
      totalPaise: o.grandTotalPaise || 0,
      fulfillmentStatus: o.fulfillmentStatus,
      paymentStatus: o.paymentStatus,
    })),
  };
}

/**
 * Pushes live update to Google Workspace (Google Apps Script Webhook) if URL is configured
 */
export async function pushLiveUpdateToGoogleWorkspace(): Promise<{ success: boolean; message: string }> {
  try {
    const config = getGoogleWorkspaceConfig();
    const webhookUrl = config.webhookUrl;
    if (!webhookUrl) {
      return {
        success: true,
        message: 'Google Sheets sync configured for ' + config.adminEmail + '. Add Web App webhook URL to stream directly.',
      };
    }

    const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const allTodaySales = (db.historicalSales || []).filter(
      (s) => (s.settledAt ? new Date(s.settledAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : todayIst) === todayIst
    );

    // 1. Enrich menu categories with active sold counts and live revenue
    const enrichedMenuCategories = (db.menuCategories || []).map((cat) => ({
      ...cat,
      items: (cat.items || []).map((it) => {
        let sold = 0;
        allTodaySales.forEach((s) => {
          (s.items || []).forEach((si: any) => {
            if ((si.itemId && si.itemId === it.id) || (si.itemName && si.itemName.trim().toLowerCase() === it.name.trim().toLowerCase())) {
              sold += Number(si.quantity || si.qty || 1);
            }
          });
        });
        (db.orders || []).forEach((o) => {
          (o.items || []).forEach((oi) => {
            if ((oi.itemId && oi.itemId === it.id) || (oi.itemName && oi.itemName.trim().toLowerCase() === it.name.trim().toLowerCase())) {
              sold += Number(oi.quantity || 1);
            }
          });
        });
        const unitPriceInr = (it.pricePaise || 0) / 100;
        return {
          ...it,
          soldQuantity: sold,
          price: unitPriceInr,
          totalRevenueInr: sold * unitPriceInr,
        };
      }),
    }));

    // Preserve history: Include dishes that were sold today even if deleted from active menu!
    const existingDishNames = new Set(
      enrichedMenuCategories.flatMap((c) => (c.items || []).map((i) => i.name.trim().toLowerCase()))
    );
    const archivedItems: any[] = [];
    allTodaySales.forEach((s) => {
      (s.items || []).forEach((si: any) => {
        const dName = (si.itemName || si.name || '').trim();
        const lower = dName.toLowerCase();
        if (dName && !existingDishNames.has(lower)) {
          existingDishNames.add(lower);
          const price = (si.pricePaise || 0) / 100;
          const qty = Number(si.quantity || si.qty || 1);
          archivedItems.push({
            id: si.itemId || `archived-${archivedItems.length + 1}`,
            name: dName,
            malayalamName: si.itemMalayalamName || '',
            price,
            soldQuantity: qty,
            totalRevenueInr: qty * price,
            currentStock: 0,
            isAvailable: false,
          });
        }
      });
    });
    if (archivedItems.length > 0) {
      enrichedMenuCategories.push({
        id: 'cat-archived',
        name: 'Daily Delicacies',
        items: archivedItems,
      } as any);
    }

    // 2. Enrich tables with both All-Time Sales Data and Today's Live Stats
    const allHistorical = db.historicalSales || [];
    const enrichedTables = (db.tables || []).map((t) => {
      const tCode = (t.tableCode || '').trim().toUpperCase();
      const tName = (t.displayName || '').trim().toUpperCase();

      const tableAllSales = allHistorical.filter((s: any) => {
        const sc = (s.tableCode || '').trim().toUpperCase();
        const sn = (s.tableName || '').trim().toUpperCase();
        return (sc && (sc === tCode || sc === tName)) || (sn && (sn === tCode || sn === tName));
      });

      const tableTodaySales = allTodaySales.filter((s: any) => {
        const sc = (s.tableCode || '').trim().toUpperCase();
        const sn = (s.tableName || '').trim().toUpperCase();
        return (sc && (sc === tCode || sc === tName)) || (sn && (sn === tCode || sn === tName));
      });

      const tableActiveOrders = (db.orders || []).filter((o) => {
        const oc = (o.tableCode || '').trim().toUpperCase();
        const on = (o.tableName || '').trim().toUpperCase();
        return ((oc && (oc === tCode || oc === tName)) || (on && (on === tCode || on === tName))) && o.paymentStatus === 'UNPAID';
      });

      const allTimeCount = tableAllSales.length;
      const allTimePaise = tableAllSales.reduce((sum, s) => sum + (s.grandTotalPaise || 0), 0);
      const allTimeInr = allTimePaise / 100;

      const totalOrdersToday = tableTodaySales.length + tableActiveOrders.length;
      const settledPaise = tableTodaySales.reduce((sum, s) => sum + (s.grandTotalPaise || 0), 0);
      const activePaise = tableActiveOrders.reduce((sum, o) => sum + (o.grandTotalPaise || 0), 0);
      const totalAmountTodayInr = (settledPaise + activePaise) / 100;

      const latestTime = tableActiveOrders[0]?.createdAt || tableTodaySales[0]?.settledAt || tableAllSales[0]?.settledAt || '';

      return {
        ...t,
        roomName: t.roomName || 'Dining Area',
        allTimeOrdersCount: allTimeCount,
        allTimeRevenueInr: allTimeInr,
        todayOrdersCount: totalOrdersToday,
        totalAmountToday: totalAmountTodayInr,
        currentStatus: tableActiveOrders.length > 0 
          ? (tableActiveOrders.some(o => o.fulfillmentStatus === 'READY' || o.fulfillmentStatus === 'SERVED') ? 'BILL_PENDING' : 'OCCUPIED') 
          : 'AVAILABLE',
        lastOrderTime: latestTime ? new Date(latestTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'None',
      };
    });

    const payload = {
      action: 'FULL_SYNC',
      tables: enrichedTables,
      menuCategories: enrichedMenuCategories,
      staffUsers: db.staffUsers || [],
      historicalSales: (db.historicalSales || []).slice(0, 150).map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        orderCode: s.orderCode,
        tableCode: s.tableCode,
        roomName: s.roomName || 'Dining Area',
        grandTotalPaise: s.grandTotalPaise,
        paymentMode: s.paymentMode,
        settledAt: s.settledAt,
        cashier: s.cashier,
        itemsSummary: s.itemsSummary || (s.items || []).map((i: any) => `${i.itemName || i.name} x ${i.quantity || i.qty || 1}`).join(', '),
      })),
      orders: db.orders || [],
      updatedAt: new Date().toISOString(),
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      return { success: true, message: `Google Sheet under ${config.adminEmail} updated in real-time!` };
    } else {
      return { success: false, message: `Webhook responded with status ${res.status}` };
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Error pushing to Google Workspace' };
  }
}

/**
 * Pushes a new customer/waiter order to Google Sheet in real-time
 */
export async function pushOrderToGoogleDrive(order: any) {
  try {
    const config = getGoogleWorkspaceConfig();
    const webhookUrl = config.webhookUrl;
    if (!webhookUrl) return;

    const itemsSummary = (order.items || []).map((it: any) => `${it.quantity || it.qty || 1}x ${it.itemName || it.name}`).join('; ');
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        action: 'NEW_ORDER',
        order: {
          customerCode: order.customerCode || order.id,
          tableCode: order.tableCode,
          tableName: order.tableName,
          roomName: order.roomName || 'Dining Area',
          itemsSummary,
          grandTotalPaise: order.grandTotalPaise || order.subtotalPaise || 0,
          fulfillmentStatus: order.fulfillmentStatus || 'NEW',
          paymentStatus: order.paymentStatus || 'UNPAID',
        },
      }),
    });
  } catch (e) {
    console.warn('[Google Drive Sync] Could not push new order:', e);
  }
}

/**
 * Pushes settled POS bill to Google Sheet Billing_Settlement and Sales_Ledger in real-time
 */
export async function pushSettledBillToGoogleDrive(sale: any) {
  try {
    const config = getGoogleWorkspaceConfig();
    const webhookUrl = config.webhookUrl;
    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        action: 'BILL_SETTLED',
        sale: {
          invoiceNumber: sale.invoiceNumber,
          orderCode: sale.orderCode,
          tableCode: sale.tableCode,
          tableName: sale.tableName || sale.tableCode || 'Table',
          roomName: sale.roomName || 'Dining Area',
          paymentMode: sale.paymentMode || 'UPI',
          grandTotalPaise: sale.grandTotalPaise,
          cashier: sale.cashier || 'Cashier',
          itemsSummary: sale.itemsSummary || (sale.items || []).map((i: any) => `${i.itemName || i.name || 'Dish'} x ${i.quantity || i.qty || 1}`).join(', '),
          timestamp: sale.timestamp || new Date().toISOString(),
        },
      }),
    });
  } catch (e) {
    console.warn('[Google Drive Sync] Could not push settled bill:', e);
  }
}
