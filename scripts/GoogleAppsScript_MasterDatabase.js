/**
 * ============================================================================
 * ITHI POORAM (ഇത്തിപ്പൂരം) — GOOGLE SHEETS MASTER DATABASE SYNC SCRIPT
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/1sk_qbGAP74h26oYiDkMin815GbKikMJf6cqdK4thT4Y/edit
 * Google Account: ithipoorampos@gmail.com
 *
 * EXACT 5 SHEETS REQUIRED:
 * 1. "Sales_Ledger"       -> Chronological customer orders grouped by day with bold Date & Day headers
 * 2. "Menu_Stock"         -> Active menu & stock live sync (Sold Qty, Remaining Stock, Revenue, Status)
 * 3. "Tables_Master"      -> Room & table-wise orders count, total amount today, current status & last order
 * 4. "Billing_Settlement" -> Billing invoices settlement ledger with staff cashier signature
 * 5. "Staff_Registry"     -> Staff registration, authentication, 4-digit PINs & roles
 * ============================================================================
 */

const SHEET_NAMES = {
  SALES: 'Sales_Ledger',
  MENU: 'Menu_Stock',
  TABLES: 'Tables_Master',
  BILLING: 'Billing_Settlement',
  STAFF: 'Staff_Registry'
};

const THEME = {
  HEADER_BG: '#0F172A',         // Slate 900
  HEADER_TEXT: '#FFFFFF',       // Crisp white
  DAY_HEADER_BG: '#1E293B',     // Slate 800
  DAY_HEADER_TEXT: '#F8FAFC',   // Off white
  SUBTOTAL_BG: '#F1F5F9',       // Slate 100
  ACCENT_BG: '#F8FAFC',         // Subtle row highlight
  BORDER_COLOR: '#CBD5E1',      // Clean border
};

/**
 * Custom Menu added to Google Sheets on open
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🍲 Ithi Pooram POS')
    .addItem('⚡ Initialize / Rebuild All 5 Sheets', 'initializeDatabase')
    .addItem('📊 Refresh Today Sales Summary', 'refreshTodaySalesSummary')
    .addToUi();
}

/**
 * 1. INITIALIZE ALL 5 SHEETS WITH EXACT RESTAURANT COLUMNS & FORMATTING
 */
function initializeDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Sales_Ledger: Detailed orders grouped by day
  let salesSheet = getOrCreateSheet(ss, SHEET_NAMES.SALES);
  setupSheetHeaders(salesSheet, [
    'Sl No',
    'Order Time',
    'Invoice / Token No',
    'Room / Section',
    'Table Name / Code',
    'Ordered Items Summary',
    'Payment Mode',
    'Grand Total (₹)',
    'Authorized & Printed By (Staff Cashier)'
  ], [60, 110, 160, 140, 140, 320, 120, 130, 220]);

  // 2. Menu_Stock: Live sync of sold quantity, stock, and revenue
  let menuSheet = getOrCreateSheet(ss, SHEET_NAMES.MENU);
  setupSheetHeaders(menuSheet, [
    'Sl No',
    'Category',
    'Item Name (English)',
    'Item Name (Malayalam)',
    'Price (₹)',
    'Sold Qty Today',
    'Remaining Stock / Status',
    'Total Revenue (₹)',
    'Last Synced'
  ], [60, 140, 200, 180, 100, 120, 160, 130, 160]);

  // 3. Tables_Master: Table registry, room assignment, active order counts & daily amounts
  let tablesSheet = getOrCreateSheet(ss, SHEET_NAMES.TABLES);
  setupSheetHeaders(tablesSheet, [
    'Sl No',
    'Room / Section',
    'Table Code',
    'Display Name',
    'Seat Capacity',
    'All-Time Orders Count',
    'All-Time Total Revenue (₹)',
    'Current Status',
    'Last Order Recorded'
  ], [60, 140, 110, 140, 110, 150, 160, 120, 160]);

  // 4. Billing_Settlement: Invoices settled at POS counter
  let billingSheet = getOrCreateSheet(ss, SHEET_NAMES.BILLING);
  setupSheetHeaders(billingSheet, [
    'Sl No',
    'Invoice Number',
    'Order / Token Code',
    'Settled Date & Time',
    'Room / Section',
    'Table Name / Code',
    'Ordered Items Summary',
    'Grand Total (₹)',
    'Payment Mode',
    'Authorized & Printed By (Staff Cashier)',
    'Settlement Status'
  ], [60, 140, 150, 160, 140, 140, 320, 130, 120, 220, 130]);

  // 5. Staff_Registry: Master staff and PIN registry
  let staffSheet = getOrCreateSheet(ss, SHEET_NAMES.STAFF);
  setupSheetHeaders(staffSheet, [
    'Sl No',
    'Staff ID',
    'Employee Full Name',
    'Designated Role',
    '4-Digit PIN / Auth Key',
    'Assigned Station Desk',
    'Authorization Level',
    'Status',
    'Registration Date'
  ], [60, 130, 180, 140, 120, 160, 120, 100, 140]);

  // Remove default empty 'Sheet1' if present
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  // Set order of sheets (1 to 5)
  setSheetIndex(ss, SHEET_NAMES.SALES, 1);
  setSheetIndex(ss, SHEET_NAMES.MENU, 2);
  setSheetIndex(ss, SHEET_NAMES.TABLES, 3);
  setSheetIndex(ss, SHEET_NAMES.BILLING, 4);
  setSheetIndex(ss, SHEET_NAMES.STAFF, 5);

  return 'All 5 Sheets Initialized Successfully!';
}

/**
 * Helper to get or create a sheet
 */
function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

/**
 * Helper to position sheet order
 */
function setSheetIndex(ss, sheetName, index) {
  const sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(index);
  }
}

/**
 * Helper to setup header row and column widths
 */
function setupSheetHeaders(sheet, headers, widths) {
  sheet.setFrozenRows(1);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setFontColor(THEME.HEADER_TEXT);
  headerRange.setBackground(THEME.HEADER_BG);
  headerRange.setFontSize(10);
  headerRange.setFontFamily('Segoe UI');
  headerRange.setVerticalAlignment('middle');
  sheet.setRowHeight(1, 34);

  // Set column widths
  if (widths && widths.length) {
    for (let i = 0; i < widths.length; i++) {
      sheet.setColumnWidth(i + 1, widths[i]);
    }
  }
}

/**
 * Helper to safely clear sheet data rows while preserving headers
 */
function clearSheetData(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn() || 9;
  if (lastRow > 1) {
    const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
    try { range.breakApart(); } catch (e) {}
    range.clearContent();
    range.clearFormat();
  }
}

/**
 * IST Date & Day helper
 */
function getIstDayAndDate(dateObjOrString) {
  const d = dateObjOrString ? new Date(dateObjOrString) : new Date();
  const dateStr = Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd');
  const dayName = Utilities.formatDate(d, 'Asia/Kolkata', 'EEEE');
  const formattedDate = Utilities.formatDate(d, 'Asia/Kolkata', 'dd MMMM yyyy');
  const timeStr = Utilities.formatDate(d, 'Asia/Kolkata', 'hh:mm a');
  const headerLabel = '📅 ' + dayName + ' — ' + formattedDate + ' (' + dateStr + ')';

  return { dateStr: dateStr, dayName: dayName, formattedDate: formattedDate, timeStr: timeStr, headerLabel: headerLabel };
}

/**
 * WEBHOOK LISTENER: Handles live streaming updates from Ithi Pooram POS Terminal
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || 'FULL_SYNC';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ensure all 5 sheets exist before processing
    initializeDatabase();

    if (action === 'BILL_SETTLED' || action === 'SETTLE_BILL') {
      handleBillSettled(ss, payload.sale || payload);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Bill settled logged to Billing_Settlement & Sales_Ledger',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'FULL_SYNC') {
      handleFullSync(ss, payload);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Full POS database synchronized successfully across all 5 sheets',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'NEW_ORDER') {
      handleNewOrder(ss, payload.order || payload);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Table order updated in Tables_Master',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Unknown action processed gracefully',
      receivedAction: action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GET ENDPOINT: Health check and real-time status probe
 */
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets().map(s => s.getName());
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ONLINE',
    restaurant: 'ITHI POORAM (ഇത്തിപ്പൂരം)',
    spreadsheetId: ss.getId(),
    adminEmail: 'ithipoorampos@gmail.com',
    sheetsPresent: sheets,
    configuredSheets: SHEET_NAMES,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 4. LOG SETTLED INVOICE TO BILLING_SETTLEMENT & SALES_LEDGER
 */
function handleBillSettled(ss, sale) {
  if (!sale) return;

  const billingSheet = ss.getSheetByName(SHEET_NAMES.BILLING);
  const salesSheet = ss.getSheetByName(SHEET_NAMES.SALES);
  const tablesSheet = ss.getSheetByName(SHEET_NAMES.TABLES);

  const ist = getIstDayAndDate(sale.timestamp || sale.settledAt);
  const dateTimeStr = ist.dateStr + ' ' + ist.timeStr;

  const invoiceNo = sale.invoiceNumber || ('INV-' + Date.now().toString().slice(-6));
  const orderCode = sale.orderCode || '-';
  const roomName = sale.roomName || 'Dining Area';
  const tableName = sale.tableName || sale.tableCode || 'Counter';
  const grandTotalInr = Number((sale.grandTotalPaise ? sale.grandTotalPaise / 100 : (sale.grandTotal || sale.amount || 0)));
  const paymentMode = (sale.paymentMode || 'UPI').toUpperCase();
  const cashier = sale.cashier || 'Counter Cashier';
  const itemsSummary = sale.itemsSummary || 'Order Items';

  // 1. Append to Billing_Settlement (Sheet 4)
  let billingLastRow = billingSheet.getLastRow();
  let hasBillingTodayHeader = false;

  if (billingLastRow > 1) {
    const existingValues = billingSheet.getRange(2, 1, billingLastRow - 1, 1).getValues();
    for (let i = 0; i < existingValues.length; i++) {
      const cellVal = String(existingValues[i][0]);
      if (cellVal.indexOf(ist.dateStr) !== -1 || cellVal.indexOf(ist.dayName) !== -1) {
        hasBillingTodayHeader = true;
        break;
      }
    }
  }

  if (!hasBillingTodayHeader) {
    billingSheet.appendRow([
      ist.headerLabel, '', '', '', '', '', '', '', '', '', ''
    ]);
    const headerRowIdx = billingSheet.getLastRow();
    billingSheet.getRange(headerRowIdx, 1, 1, 11).merge()
      .setBackground(THEME.DAY_HEADER_BG)
      .setFontColor(THEME.DAY_HEADER_TEXT)
      .setFontWeight('bold')
      .setFontSize(11)
      .setFontFamily('Segoe UI')
      .setVerticalAlignment('middle');
    billingSheet.setRowHeight(headerRowIdx, 30);
  }

  billingLastRow = billingSheet.getLastRow();
  const nextBillingSl = Math.max(1, billingLastRow);
  billingSheet.appendRow([
    nextBillingSl,
    invoiceNo,
    orderCode,
    dateTimeStr,
    roomName,
    tableName,
    itemsSummary,
    grandTotalInr,
    paymentMode,
    cashier,
    'SETTLED'
  ]);
  const appendedBillingRow = billingSheet.getLastRow();
  billingSheet.getRange(appendedBillingRow, 8).setNumberFormat('₹#,##0.00');
  billingSheet.getRange(appendedBillingRow, 1, 1, 11).setFontFamily('Segoe UI').setFontSize(9).setVerticalAlignment('middle');
  billingSheet.setRowHeight(appendedBillingRow, 24);

  // 2. Append to Sales_Ledger (Sheet 1) with Bold Date & Day Header
  let salesLastRow = salesSheet.getLastRow();
  let hasTodayHeader = false;

  if (salesLastRow > 1) {
    const existingValues = salesSheet.getRange(2, 1, salesLastRow - 1, 1).getValues();
    for (let i = 0; i < existingValues.length; i++) {
      const cellVal = String(existingValues[i][0]);
      if (cellVal.indexOf(ist.dateStr) !== -1 || cellVal.indexOf(ist.dayName) !== -1) {
        hasTodayHeader = true;
        break;
      }
    }
  }

  // If today's bold header doesn't exist yet, insert it first
  if (!hasTodayHeader) {
    salesSheet.appendRow([
      ist.headerLabel, '', '', '', '', '', '', '', ''
    ]);
    const headerRowIdx = salesSheet.getLastRow();
    salesSheet.getRange(headerRowIdx, 1, 1, 9).merge()
      .setBackground(THEME.DAY_HEADER_BG)
      .setFontColor(THEME.DAY_HEADER_TEXT)
      .setFontWeight('bold')
      .setFontSize(11)
      .setFontFamily('Segoe UI')
      .setVerticalAlignment('middle');
    salesSheet.setRowHeight(headerRowIdx, 30);
  }

  // Append order row
  salesLastRow = salesSheet.getLastRow();
  const nextSalesSl = Math.max(1, salesLastRow);
  salesSheet.appendRow([
    nextSalesSl,
    ist.timeStr,
    invoiceNo,
    roomName,
    tableName,
    itemsSummary,
    paymentMode,
    grandTotalInr,
    cashier
  ]);
  const appendedSalesRow = salesSheet.getLastRow();
  salesSheet.getRange(appendedSalesRow, 8).setNumberFormat('₹#,##0.00');
  salesSheet.getRange(appendedSalesRow, 1, 1, 9).setFontFamily('Segoe UI').setFontSize(9).setVerticalAlignment('middle');
  salesSheet.setRowHeight(appendedSalesRow, 24);

  // 3. Update Tables_Master (Sheet 3) with All-Time Revenue and Order Counts
  if (tablesSheet && (sale.tableCode || sale.tableName)) {
    const tblLastRow = tablesSheet.getLastRow();
    if (tblLastRow > 1) {
      const tableData = tablesSheet.getRange(2, 2, tblLastRow - 1, 3).getValues(); // Room, Code, Name
      const targetCode = String(sale.tableCode || '').trim().toUpperCase();
      const targetName = String(sale.tableName || '').trim().toUpperCase();
      for (let t = 0; t < tableData.length; t++) {
        const rowCode = String(tableData[t][1] || '').trim().toUpperCase();
        const rowName = String(tableData[t][2] || '').trim().toUpperCase();
        if ((targetCode && (rowCode === targetCode || rowName === targetCode)) || 
            (targetName && (rowCode === targetName || rowName === targetName))) {
          const rowNum = t + 2;
          const curCount = Number(tablesSheet.getRange(rowNum, 6).getValue() || 0);
          const curAmt = Number(tablesSheet.getRange(rowNum, 7).getValue() || 0);
          tablesSheet.getRange(rowNum, 6).setValue(curCount + 1);
          tablesSheet.getRange(rowNum, 7).setValue(curAmt + grandTotalInr);
          tablesSheet.getRange(rowNum, 8).setValue('AVAILABLE');
          tablesSheet.getRange(rowNum, 9).setValue(ist.timeStr);
          break;
        }
      }
    }
  }
}

/**
 * 2. FULL POS SYNC HANDLER: High performance batch populator for all 5 sheets
 */
function handleFullSync(ss, payload) {
  const syncIst = getIstDayAndDate();
  const syncTime = syncIst.dateStr + ' ' + syncIst.timeStr;

  // --- 1. Detailed Sales_Ledger Sync Grouped By Date (Fast Batch Processing) ---
  if (Array.isArray(payload.historicalSales) && payload.historicalSales.length > 0) {
    const salesSheet = ss.getSheetByName(SHEET_NAMES.SALES);
    clearSheetData(salesSheet);

    const dateGroups = {};
    payload.historicalSales.forEach(function(sale) {
      const ist = getIstDayAndDate(sale.settledAt || sale.timestamp);
      if (!dateGroups[ist.dateStr]) {
        dateGroups[ist.dateStr] = {
          headerLabel: ist.headerLabel,
          dayName: ist.dayName,
          dateStr: ist.dateStr,
          sales: []
        };
      }
      dateGroups[ist.dateStr].sales.push(sale);
    });

    const sortedDates = Object.keys(dateGroups).sort();
    const batchRows = [];
    const headerRowIndices = [];
    const subtotalRowIndices = [];
    let slNo = 1;

    sortedDates.forEach(function(dKey) {
      const group = dateGroups[dKey];
      // Track index of Day Date Header row (1-based index relative to sheet row 2)
      headerRowIndices.push(batchRows.length + 2);
      batchRows.push([group.headerLabel, '', '', '', '', '', '', '', '']);

      let dayTotal = 0;
      group.sales.forEach(function(sale) {
        const saleIst = getIstDayAndDate(sale.settledAt || sale.timestamp);
        const amt = Number((sale.grandTotalPaise ? sale.grandTotalPaise / 100 : (sale.grandTotal || 0)));
        dayTotal += amt;

        batchRows.push([
          slNo++,
          saleIst.timeStr,
          sale.invoiceNumber || '-',
          sale.roomName || 'Dining Area',
          sale.tableName || sale.tableCode || 'Counter',
          sale.itemsSummary || 'Order details',
          (sale.paymentMode || 'UPI').toUpperCase(),
          amt,
          sale.cashier || 'Cashier'
        ]);
      });

      // Track index of Day Subtotal row
      subtotalRowIndices.push(batchRows.length + 2);
      batchRows.push([
        '',
        'DAY TOTAL (' + dKey + ')',
        '',
        '',
        '',
        'Total Orders: ' + group.sales.length,
        '',
        dayTotal,
        ''
      ]);
    });

    if (batchRows.length > 0) {
      const rng = salesSheet.getRange(2, 1, batchRows.length, 9);
      rng.setValues(batchRows);
      salesSheet.getRange(2, 8, batchRows.length, 1).setNumberFormat('₹#,##0.00');
      rng.setFontFamily('Segoe UI').setFontSize(9).setVerticalAlignment('middle');

      // Style Day Headers (Merged, Slate 800)
      headerRowIndices.forEach(function(rIdx) {
        salesSheet.getRange(rIdx, 1, 1, 9).merge()
          .setBackground(THEME.DAY_HEADER_BG)
          .setFontColor(THEME.DAY_HEADER_TEXT)
          .setFontWeight('bold')
          .setFontSize(11);
        salesSheet.setRowHeight(rIdx, 30);
      });

      // Style Subtotals (Slate 100)
      subtotalRowIndices.forEach(function(rIdx) {
        salesSheet.getRange(rIdx, 1, 1, 9)
          .setBackground(THEME.SUBTOTAL_BG)
          .setFontWeight('bold');
        salesSheet.setRowHeight(rIdx, 26);
      });
    }
  }

  // --- 2. Menu_Stock Live Sync with Date & Day Bold Header ---
  if (Array.isArray(payload.menuCategories) && payload.menuCategories.length > 0) {
    const menuSheet = ss.getSheetByName(SHEET_NAMES.MENU);
    clearSheetData(menuSheet);

    const rows = [];
    rows.push([syncIst.headerLabel, '', '', '', '', '', '', '', '']);

    let menuSl = 1;
    payload.menuCategories.forEach(function(cat) {
      const catName = cat.name || 'General';
      if (Array.isArray(cat.items)) {
        cat.items.forEach(function(it) {
          const price = Number(it.price || (it.pricePaise ? it.pricePaise / 100 : 0));
          const sold = Number(it.soldQuantity || 0);
          const revenue = Number(it.totalRevenueInr !== undefined ? it.totalRevenueInr : (price * sold));
          const stock = typeof it.currentStock === 'number' 
            ? (it.currentStock + ' in stock') 
            : (it.isAvailable ? 'AVAILABLE' : 'OUT OF STOCK');

          rows.push([
            menuSl++,
            catName,
            it.name || it.itemName || 'Dish',
            it.malayalamName || '',
            price,
            sold,
            stock,
            revenue,
            syncTime
          ]);
        });
      }
    });

    if (rows.length > 0) {
      const rng = menuSheet.getRange(2, 1, rows.length, 9);
      rng.setValues(rows);
      menuSheet.getRange(2, 5, rows.length, 1).setNumberFormat('₹#,##0.00');
      menuSheet.getRange(2, 8, rows.length, 1).setNumberFormat('₹#,##0.00');
      rng.setFontFamily('Segoe UI').setFontSize(9).setVerticalAlignment('middle');

      menuSheet.getRange(2, 1, 1, 9).merge()
        .setBackground(THEME.DAY_HEADER_BG)
        .setFontColor(THEME.DAY_HEADER_TEXT)
        .setFontWeight('bold')
        .setFontSize(11)
        .setFontFamily('Segoe UI')
        .setVerticalAlignment('middle');
      menuSheet.setRowHeight(2, 30);
    }
  }

  // --- 3. Tables_Master Live Sync (All-Time Cumulative Revenue & Orders Data) ---
  if (Array.isArray(payload.tables) && payload.tables.length > 0) {
    const tablesSheet = ss.getSheetByName(SHEET_NAMES.TABLES);
    clearSheetData(tablesSheet);

    const rows = payload.tables.map(function(t, idx) {
      const allTimeRevenue = Number(t.allTimeRevenueInr !== undefined ? t.allTimeRevenueInr : (t.totalAmountToday !== undefined ? t.totalAmountToday : (t.unpaidTotalPaise ? t.unpaidTotalPaise / 100 : 0)));
      const allTimeOrders = Number(t.allTimeOrdersCount !== undefined ? t.allTimeOrdersCount : (t.todayOrdersCount !== undefined ? t.todayOrdersCount : (t.unpaidCount || 0)));
      const status = t.currentStatus || t.status || 'AVAILABLE';

      return [
        idx + 1,
        t.roomName || t.room || 'Dining Area',
        t.tableCode || ('T-' + (idx + 1)),
        t.displayName || ('Table ' + (idx + 1)),
        t.capacity || 4,
        allTimeOrders,
        allTimeRevenue,
        status,
        t.lastOrderTime || 'None'
      ];
    });

    if (rows.length > 0) {
      const rng = tablesSheet.getRange(2, 1, rows.length, 9);
      rng.setValues(rows);
      tablesSheet.getRange(2, 7, rows.length, 1).setNumberFormat('₹#,##0.00');
      rng.setFontFamily('Segoe UI').setFontSize(9).setVerticalAlignment('middle');
    }
  }

  // --- 4. Billing_Settlement Sync Grouped by Date & Day (With Ordered Items Summary) ---
  if (Array.isArray(payload.historicalSales) && payload.historicalSales.length > 0) {
    const billingSheet = ss.getSheetByName(SHEET_NAMES.BILLING);
    clearSheetData(billingSheet);

    const dateGroups = {};
    payload.historicalSales.forEach(function(sale) {
      const ist = getIstDayAndDate(sale.settledAt || sale.timestamp);
      if (!dateGroups[ist.dateStr]) {
        dateGroups[ist.dateStr] = {
          headerLabel: ist.headerLabel,
          dayName: ist.dayName,
          dateStr: ist.dateStr,
          sales: []
        };
      }
      dateGroups[ist.dateStr].sales.push(sale);
    });

    const sortedDates = Object.keys(dateGroups).sort();
    const batchRows = [];
    const headerRowIndices = [];
    const subtotalRowIndices = [];
    let bSl = 1;

    sortedDates.forEach(function(dKey) {
      const group = dateGroups[dKey];
      headerRowIndices.push(batchRows.length + 2);
      batchRows.push([group.headerLabel, '', '', '', '', '', '', '', '', '', '']);

      let dayTotal = 0;
      group.sales.forEach(function(s) {
        const sIst = getIstDayAndDate(s.settledAt || s.timestamp);
        const amt = Number((s.grandTotalPaise ? s.grandTotalPaise / 100 : (s.grandTotal || 0)));
        dayTotal += amt;

        batchRows.push([
          bSl++,
          s.invoiceNumber || '-',
          s.orderCode || '-',
          sIst.dateStr + ' ' + sIst.timeStr,
          s.roomName || 'Dining Area',
          s.tableName || s.tableCode || 'Counter',
          s.itemsSummary || 'Order details',
          amt,
          (s.paymentMode || 'UPI').toUpperCase(),
          s.cashier || 'Cashier',
          'SETTLED'
        ]);
      });

      subtotalRowIndices.push(batchRows.length + 2);
      batchRows.push([
        '',
        'DAY TOTAL (' + dKey + ')',
        '',
        '',
        '',
        '',
        'Total Bills: ' + group.sales.length,
        dayTotal,
        '',
        '',
        ''
      ]);
    });

    if (batchRows.length > 0) {
      const rng = billingSheet.getRange(2, 1, batchRows.length, 11);
      rng.setValues(batchRows);
      billingSheet.getRange(2, 8, batchRows.length, 1).setNumberFormat('₹#,##0.00');
      rng.setFontFamily('Segoe UI').setFontSize(9).setVerticalAlignment('middle');

      headerRowIndices.forEach(function(rIdx) {
        billingSheet.getRange(rIdx, 1, 1, 11).merge()
          .setBackground(THEME.DAY_HEADER_BG)
          .setFontColor(THEME.DAY_HEADER_TEXT)
          .setFontWeight('bold')
          .setFontSize(11)
          .setFontFamily('Segoe UI')
          .setVerticalAlignment('middle');
        billingSheet.setRowHeight(rIdx, 30);
      });

      subtotalRowIndices.forEach(function(rIdx) {
        billingSheet.getRange(rIdx, 1, 1, 11)
          .setBackground(THEME.SUBTOTAL_BG)
          .setFontWeight('bold');
        billingSheet.setRowHeight(rIdx, 26);
      });
    }
  }

  // --- 5. Staff_Registry Sync ---
  if (Array.isArray(payload.staffUsers) && payload.staffUsers.length > 0) {
    const staffSheet = ss.getSheetByName(SHEET_NAMES.STAFF);
    clearSheetData(staffSheet);

    const rows = payload.staffUsers.map(function(s, idx) {
      const staffId = s.id || ('ithi_staff_' + String(idx + 1).padStart(3, '0'));
      const role = s.role || 'CASHIER';
      const pin = s.pin || '••••';
      const status = s.status || (s.isActive !== false ? 'ACTIVE' : 'INACTIVE');
      const regDate = s.registeredAt || syncTime;

      return [
        idx + 1,
        staffId,
        s.fullName || s.username || 'Staff Member',
        role,
        pin,
        s.station || 'Counter POS Desk',
        role === 'MAIN_ADMIN' ? 'SUPER_ADMIN' : 'TERMINAL_OPERATOR',
        status,
        regDate
      ];
    });

    if (rows.length > 0) {
      const rng = staffSheet.getRange(2, 1, rows.length, 9);
      rng.setValues(rows);
      rng.setFontFamily('Segoe UI').setFontSize(9).setVerticalAlignment('middle');
    }
  }
}

/**
 * 3. NEW TABLE ORDER HANDLER
 */
function handleNewOrder(ss, order) {
  if (!order || !order.tableCode) return;
  const tablesSheet = ss.getSheetByName(SHEET_NAMES.TABLES);
  const lastRow = tablesSheet.getLastRow();
  if (lastRow <= 1) return;

  const codes = tablesSheet.getRange(2, 3, lastRow - 1, 1).getValues();
  for (let i = 0; i < codes.length; i++) {
    if (String(codes[i][0]).trim().toUpperCase() === String(order.tableCode).trim().toUpperCase()) {
      const r = i + 2;
      const curCount = Number(tablesSheet.getRange(r, 6).getValue() || 0);
      const curAmt = Number(tablesSheet.getRange(r, 7).getValue() || 0);
      const addedAmt = Number((order.grandTotalPaise ? order.grandTotalPaise / 100 : 0));

      tablesSheet.getRange(r, 6).setValue(curCount + 1);
      tablesSheet.getRange(r, 7).setValue(curAmt + addedAmt);
      tablesSheet.getRange(r, 8).setValue('OCCUPIED');
      tablesSheet.getRange(r, 9).setValue(Utilities.formatDate(new Date(), 'Asia/Kolkata', 'hh:mm a'));
      break;
    }
  }
}

/**
 * Menu Action: Refresh Today's Sales
 */
function refreshTodaySalesSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ist = getIstDayAndDate();
  SpreadsheetApp.getUi().alert('Sales Summary checked for ' + ist.headerLabel);
}
