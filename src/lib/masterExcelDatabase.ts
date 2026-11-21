// ============================================================================
// ITHI POORAM (ഇത്തിപ്പൂരം) — UNIFIED MASTER EXCEL DATABASE ENGINE
// Exactly 5 Standard Pages (Worksheets) Required for Restaurant Operations:
// 1. "Sales Report of the Day" (Date, Gross Sales, Cash, UPI, Card, AOV, Order items breakdown)
// 2. "Menu Update of Each Day" (Item Name, Malayalam, Category, Price, Sold Qty, Remaining Stock, Revenue)
// 3. "Table-Wise Orders & Storage" (Room Name, Table Code, Name, Seating, Today Orders Count, Total Amount, Order List)
// 4. "Billing Settlement & Cashier" (Invoice No, Order Code, Date & Time, Room, Table, Grand Total, Payment Mode, Authorized & Printed By Staff)
// 5. "Staff Authorization & Authentication" (Staff ID ithi_xxx_001, Full Name, Role, PIN, Station, Level, Status, Registered Date)
//
// Compatible natively with Microsoft Excel (.xls), Google Sheets, LibreOffice, Numbers
// ============================================================================

import { db, getIstDateString, getIstDayAndDateString, readDailyLedger, readAllDailyLedgers, RestaurantTable, StaffUserRecord } from './serverDb';

function escapeXml(unsafe: any): string {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const COMMON_STYLES = `
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>

  <!-- Banner Headers -->
  <Style ss:ID="BannerSales">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="13" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="BannerMenu">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#B45309"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="13" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#D97706" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="BannerTables">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#047857"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="13" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#059669" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="BannerBilling">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#4338CA"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="13" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#4F46E5" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="BannerStaff">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#782312"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="13" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#9E341D" ss:Pattern="Solid"/>
  </Style>

  <!-- Sub Title -->
  <Style ss:ID="SubTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#FDE68A" ss:Italic="1"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>

  <!-- Section Header -->
  <Style ss:ID="SectionHeader">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#0F172A" ss:Bold="1"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>

  <!-- Column Headers -->
  <Style ss:ID="ColHeaderSales">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="ColHeaderMenu">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#92400E"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#B45309" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="ColHeaderTables">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#047857"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#047857" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="ColHeaderBilling">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#3730A3"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#4338CA" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="ColHeaderStaff">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#782312"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#9E341D" ss:Pattern="Solid"/>
  </Style>

  <!-- Data Cells -->
  <Style ss:ID="DataCellLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#0F172A"/>
  </Style>

  <Style ss:ID="DataCellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#0F172A"/>
  </Style>

  <Style ss:ID="DataCellCode">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Consolas" ss:Size="9.5" ss:Color="#0F172A" ss:Bold="1"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="DataCellMoney">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Consolas" ss:Size="9.5" ss:Color="#047857" ss:Bold="1"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>

  <Style ss:ID="DataCellMoneyTotal">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#0F172A"/>
   </Borders>
   <Font ss:FontName="Consolas" ss:Size="11" ss:Color="#0F172A" ss:Bold="1"/>
   <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>

  <Style ss:ID="DataCellPin">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Consolas" ss:Size="10" ss:Color="#9E341D" ss:Bold="1"/>
   <Interior ss:Color="#FFFBEB" ss:Pattern="Solid"/>
  </Style>

  <Style ss:ID="EmptyRow">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#94A3B8" ss:Italic="1"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>

  <!-- Prominent Day & Date Section Header for Daily Starts -->
  <Style ss:ID="DayDateHeader">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0F172A"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#0F172A" ss:Bold="1"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
  </Style>

  <!-- Day Subtotal Summary Row -->
  <Style ss:ID="DayDateSubtotal">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="9.5" ss:Color="#0F172A" ss:Bold="1"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
`;

/**
 * Generates the unified master multi-sheet Excel spreadsheet (.xls)
 * Exactly 5 sheets as specified:
 * 1. Sales Report of the Day
 * 2. Menu Update of Each Day
 * 3. Registered Table-Wise Orders & Storage with Amount
 * 4. Billing Settlement Page (Invoice Details with Who Prints Every Bill)
 * 5. Staff Registration, Authorization & Authentication Page
 */
export function generateUnifiedMasterDatabaseXml(
  targetDateStr?: string,
  customSales?: any[],
  customTables?: RestaurantTable[],
  customStaff?: StaffUserRecord[]
): string {
  const businessDate = targetDateStr || db.currentBusinessDate || getIstDateString();
  const nowStr = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  // 1. Gather all sales
  let salesList: any[] = [];
  if (Array.isArray(customSales) && customSales.length > 0) {
    salesList = customSales;
  } else {
    // If specific date requested
    if (targetDateStr && targetDateStr !== 'all' && targetDateStr !== 'all_time' && targetDateStr !== 'all-time') {
      const fromLedger = readDailyLedger(targetDateStr);
      const fromHistorical = (db.historicalSales || []).filter(
        (s) => getIstDateString(s.settledAt) === targetDateStr
      );
      const seen = new Set<string>();
      for (const item of [...fromLedger, ...fromHistorical]) {
        const key = item.invoiceNumber || item.orderCode || item.id;
        if (key && !seen.has(key)) {
          seen.add(key);
          salesList.push(item);
        }
      }
    } else {
      // All dates
      const fromAllLedgers = readAllDailyLedgers();
      const seen = new Set<string>();
      for (const item of [...fromAllLedgers, ...(db.historicalSales || [])]) {
        const key = item.invoiceNumber || item.orderCode || item.id;
        if (key && !seen.has(key)) {
          seen.add(key);
          salesList.push(item);
        }
      }
    }
  }

  // 2. Gather tables
  const tableList: RestaurantTable[] = Array.isArray(customTables) && customTables.length > 0 
    ? customTables 
    : (db.tables || []);

  // 3. Gather staff
  const staffList: StaffUserRecord[] = Array.isArray(customStaff) && customStaff.length > 0
    ? customStaff
    : (db.staffUsers || []);

  // 4. Gather menu items (include active categories + any sold dishes that may have been deleted)
  const menuCategories = db.menuCategories || [];
  const allDishes: any[] = [];
  const seenDishNames = new Set<string>();
  for (const cat of menuCategories) {
    if (Array.isArray(cat.items)) {
      for (const it of cat.items) {
        allDishes.push({ ...it, categoryName: cat.name });
        seenDishNames.add((it.name || '').trim().toLowerCase());
      }
    }
  }

  // Preserve history: Include dishes that were sold even if deleted from current menu!
  salesList.forEach((s) => {
    if (Array.isArray(s.items)) {
      s.items.forEach((it: any) => {
        const dName = (it.itemName || it.name || '').trim();
        const lowerName = dName.toLowerCase();
        if (dName && !seenDishNames.has(lowerName)) {
          seenDishNames.add(lowerName);
          allDishes.push({
            id: it.itemId || `dish-archived-${allDishes.length + 1}`,
            name: dName,
            malayalamName: it.itemMalayalamName || '',
            categoryName: 'Daily Delicacies',
            pricePaise: it.pricePaise || 0,
            isAvailable: false,
            currentStock: 0,
          });
        }
      });
    }
  });

  // Calculate Sales KPIs across all gathered records
  const totalBills = salesList.length;
  const grossSalesRupees = salesList.reduce((acc, s) => acc + (s.grandTotalPaise || 0), 0) / 100;
  const cashRupees = salesList.filter((s) => (s.paymentMode || '').toUpperCase() === 'CASH')
    .reduce((acc, s) => acc + (s.grandTotalPaise || 0), 0) / 100;
  const upiRupees = salesList.filter((s) => (s.paymentMode || '').toUpperCase() === 'UPI')
    .reduce((acc, s) => acc + (s.grandTotalPaise || 0), 0) / 100;
  const cardRupees = salesList.filter((s) => (s.paymentMode || '').toUpperCase() === 'CARD')
    .reduce((acc, s) => acc + (s.grandTotalPaise || 0), 0) / 100;
  const aovRupees = totalBills > 0 ? grossSalesRupees / totalBills : 0;

  // Group sales by IST Date (newest date first)
  const salesByDate: Record<string, any[]> = {};
  salesList.forEach((s) => {
    const dStr = getIstDateString(s.settledAt || s.paidAt || s.timestamp || new Date());
    if (!salesByDate[dStr]) salesByDate[dStr] = [];
    salesByDate[dStr].push(s);
  });
  const sortedDates = Object.keys(salesByDate).sort().reverse();

  // ==========================================================================
  // SHEET 1: Sales report of the day (With Bold Date & Day Section Rows)
  // ==========================================================================
  let sheet1RowsXml = '';
  if (salesList.length === 0) {
    sheet1RowsXml = `
    <Row ss:Height="24">
      <Cell ss:MergeAcross="7" ss:StyleID="EmptyRow">
        <Data ss:Type="String">No settled customer orders recorded yet for business date ${escapeXml(businessDate)}.</Data>
      </Cell>
    </Row>`;
  } else {
    let globalIndex = 1;
    sortedDates.forEach((dStr) => {
      const daySales = salesByDate[dStr] || [];
      const dayInfo = getIstDayAndDateString(dStr);
      const dayGross = daySales.reduce((acc, s) => acc + (s.grandTotalPaise || 0), 0) / 100;
      const dayCash = daySales.filter((s) => (s.paymentMode || '').toUpperCase() === 'CASH')
        .reduce((acc, s) => acc + (s.grandTotalPaise || 0), 0) / 100;
      const dayUpi = daySales.filter((s) => (s.paymentMode || '').toUpperCase() === 'UPI')
        .reduce((acc, s) => acc + (s.grandTotalPaise || 0), 0) / 100;

      // Bold Date & Day Header Row for easy identification
      sheet1RowsXml += `
    <Row ss:Height="28">
      <Cell ss:MergeAcross="7" ss:StyleID="DayDateHeader">
        <Data ss:Type="String">${escapeXml(dayInfo.headerLabel)}</Data>
      </Cell>
    </Row>`;

      daySales.forEach((s) => {
        const invNo = s.invoiceNumber || `INV-${dStr.replace(/-/g, '')}-${String(globalIndex).padStart(3, '0')}`;
        const timePart = s.settledAt ? new Date(s.settledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '12:00 PM';
        const amt = ((s.grandTotalPaise || 0) / 100).toFixed(2);
        sheet1RowsXml += `
    <Row ss:Height="22">
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="Number">${globalIndex++}</Data></Cell>
      <Cell ss:StyleID="DataCellCode"><Data ss:Type="String">${escapeXml(invNo)}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml(timePart)}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml(s.tableCode || 'COUNTER')}</Data></Cell>
      <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${escapeXml(s.itemsSummary || 'Kerala Meals')}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml((s.paymentMode || 'CASH').toUpperCase())}</Data></Cell>
      <Cell ss:StyleID="DataCellMoney"><Data ss:Type="Number">${amt}</Data></Cell>
      <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${escapeXml(s.cashier || 'Cashier')}</Data></Cell>
    </Row>`;
      });

      // Day Subtotal Row
      sheet1RowsXml += `
    <Row ss:Height="24">
      <Cell ss:MergeAcross="5" ss:StyleID="DayDateSubtotal">
        <Data ss:Type="String">Day Subtotal (${escapeXml(dayInfo.dayName)} - ${dStr}): ${daySales.length} Orders Settled</Data>
      </Cell>
      <Cell ss:StyleID="DataCellMoneyTotal"><Data ss:Type="Number">${dayGross.toFixed(2)}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">Cash: ₹${dayCash.toFixed(0)} | UPI: ₹${dayUpi.toFixed(0)}</Data></Cell>
    </Row>
    <Row ss:Height="6"/>`;
    });
  }

  const sheet1Xml = `
  <Worksheet ss:Name="Sales Report">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="35"/>
      <Column ss:Width="130"/>
      <Column ss:Width="80"/>
      <Column ss:Width="80"/>
      <Column ss:Width="260"/>
      <Column ss:Width="95"/>
      <Column ss:Width="105"/>
      <Column ss:Width="150"/>

      <!-- Header Banner -->
      <Row ss:Height="36">
        <Cell ss:MergeAcross="7" ss:StyleID="BannerSales">
          <Data ss:Type="String">ITHI POORAM (ഇത്തിപ്പൂരം) — SALES REPORT OF THE DAY</Data>
        </Cell>
      </Row>
      <Row ss:Height="22">
        <Cell ss:MergeAcross="7" ss:StyleID="SubTitle">
          <Data ss:Type="String">Business Date: ${escapeXml(businessDate)} • Generated: ${escapeXml(nowStr)}</Data>
        </Cell>
      </Row>
      <Row ss:Height="8"/>

      <!-- KPI Summary Section -->
      <Row ss:Height="22">
        <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">Total Bills Settled:</Data></Cell>
        <Cell ss:StyleID="DataCellCenter"><Data ss:Type="Number">${totalBills}</Data></Cell>
        <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">Gross Revenue (INR):</Data></Cell>
        <Cell ss:StyleID="DataCellMoney"><Data ss:Type="Number">${grossSalesRupees.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">Cash Collections (INR):</Data></Cell>
        <Cell ss:StyleID="DataCellMoney"><Data ss:Type="Number">${cashRupees.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">UPI Collections (INR):</Data></Cell>
        <Cell ss:StyleID="DataCellMoney"><Data ss:Type="Number">${upiRupees.toFixed(2)}</Data></Cell>
      </Row>
      <Row ss:Height="22">
        <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">Average Order Value (AOV):</Data></Cell>
        <Cell ss:StyleID="DataCellMoney"><Data ss:Type="Number">${aovRupees.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="SectionHeader"><Data ss:Type="String">Card Collections (INR):</Data></Cell>
        <Cell ss:StyleID="DataCellMoney"><Data ss:Type="Number">${cardRupees.toFixed(2)}</Data></Cell>
        <Cell ss:MergeAcross="3" ss:StyleID="DataCellLeft"><Data ss:Type="String">GST Exempt (Regular Composition / Zero Tax Mode)</Data></Cell>
      </Row>
      <Row ss:Height="12"/>

      <!-- Column Headers -->
      <Row ss:Height="26">
        <Cell ss:StyleID="ColHeaderSales"><Data ss:Type="String">Sl</Data></Cell>
        <Cell ss:StyleID="ColHeaderSales"><Data ss:Type="String">Invoice Number</Data></Cell>
        <Cell ss:StyleID="ColHeaderSales"><Data ss:Type="String">Time</Data></Cell>
        <Cell ss:StyleID="ColHeaderSales"><Data ss:Type="String">Table</Data></Cell>
        <Cell ss:StyleID="ColHeaderSales"><Data ss:Type="String">Ordered Items Summary</Data></Cell>
        <Cell ss:StyleID="ColHeaderSales"><Data ss:Type="String">Payment Mode</Data></Cell>
        <Cell ss:StyleID="ColHeaderSales"><Data ss:Type="String">Amount (INR)</Data></Cell>
        <Cell ss:StyleID="ColHeaderSales"><Data ss:Type="String">Cashier Desk</Data></Cell>
      </Row>

      ${sheet1RowsXml}

      <!-- Total Row -->
      <Row ss:Height="24">
        <Cell ss:MergeAcross="5" ss:StyleID="SectionHeader"><Data ss:Type="String">TOTAL AUDITED SALES ACROSS ALL DISPLAYED DAYS:</Data></Cell>
        <Cell ss:StyleID="DataCellMoneyTotal"><Data ss:Type="Number">${grossSalesRupees.toFixed(2)}</Data></Cell>
        <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">Audited</Data></Cell>
      </Row>
    </Table>
  </Worksheet>`;

  // ==========================================================================
  // SHEET 2: Menu update of each day (Active dynamic columns + sold quantities)
  // ==========================================================================
  let sheet2RowsXml = '';
  if (allDishes.length === 0) {
    sheet2RowsXml = `
    <Row ss:Height="24">
      <Cell ss:MergeAcross="9" ss:StyleID="EmptyRow">
        <Data ss:Type="String">No menu items registered yet in master store.</Data>
      </Cell>
    </Row>`;
  } else {
    allDishes.forEach((dish, idx) => {
      // Calculate sold quantity for this dish from today's active & historical sales
      let soldQty = 0;
      let revenuePaise = 0;
      salesList.forEach((s) => {
        if (Array.isArray(s.items)) {
          s.items.forEach((it: any) => {
            const name = (it.itemName || it.name || '').trim().toLowerCase();
            if (name === (dish.name || '').trim().toLowerCase() || it.itemId === dish.id) {
              const q = Number(it.quantity || it.qty || 1);
              soldQty += q;
              revenuePaise += Number(it.lineTotalPaise || ((dish.pricePaise || 0) * q));
            }
          });
        }
      });

      // Also include active unpaid orders currently being prepared
      (db.orders || []).forEach((o) => {
        if (Array.isArray(o.items)) {
          o.items.forEach((it) => {
            const name = (it.itemName || it.itemName || '').trim().toLowerCase();
            if (name === (dish.name || '').trim().toLowerCase() || it.itemId === dish.id) {
              const q = Number(it.quantity || 1);
              soldQty += q;
              revenuePaise += Number(it.lineTotalPaise || ((dish.pricePaise || 0) * q));
            }
          });
        }
      });

      const price = ((dish.pricePaise || (dish.priceInr ? dish.priceInr * 100 : 0)) / 100).toFixed(2);
      const stock = typeof dish.currentStock === 'number' ? (dish.currentStock > 0 ? `${dish.currentStock} in stock` : 'Out of Stock') : 'Available';
      const status = dish.isAvailable !== false ? 'Available' : 'Sold Out';
      const rev = (revenuePaise / 100).toFixed(2);

      sheet2RowsXml += `
    <Row ss:Height="22">
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
      <Cell ss:StyleID="DataCellCode"><Data ss:Type="String">${escapeXml(dish.id || `dish-${idx + 1}`)}</Data></Cell>
      <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${escapeXml(dish.name)}</Data></Cell>
      <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${escapeXml(dish.malayalamName || '')}</Data></Cell>
      <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${escapeXml(dish.categoryName || 'Dishes')}</Data></Cell>
      <Cell ss:StyleID="DataCellMoney"><Data ss:Type="Number">${price}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="Number">${soldQty}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml(stock)}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml(status)}</Data></Cell>
      <Cell ss:StyleID="DataCellMoney"><Data ss:Type="Number">${rev}</Data></Cell>
    </Row>`;
    });
  }

  // Prepend Date & Day Header for Menu Update
  const menuDayInfo = getIstDayAndDateString(businessDate);
  if (sheet2RowsXml) {
    sheet2RowsXml = `
    <Row ss:Height="28">
      <Cell ss:MergeAcross="9" ss:StyleID="DayDateHeader">
        <Data ss:Type="String">${escapeXml(menuDayInfo.headerLabel)}</Data>
      </Cell>
    </Row>` + sheet2RowsXml;
  }

  const sheet2Xml = `
  <Worksheet ss:Name="Menu Update">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="35"/>
      <Column ss:Width="110"/>
      <Column ss:Width="180"/>
      <Column ss:Width="160"/>
      <Column ss:Width="120"/>
      <Column ss:Width="95"/>
      <Column ss:Width="80"/>
      <Column ss:Width="100"/>
      <Column ss:Width="90"/>
      <Column ss:Width="105"/>

      <!-- Header Banner -->
      <Row ss:Height="36">
        <Cell ss:MergeAcross="9" ss:StyleID="BannerMenu">
          <Data ss:Type="String">ITHI POORAM (ഇത്തിപ്പൂരം) — MENU UPDATE OF EACH DAY</Data>
        </Cell>
      </Row>
      <Row ss:Height="22">
        <Cell ss:MergeAcross="9" ss:StyleID="SubTitle">
          <Data ss:Type="String">Live Menu Catalog • Daily Stock Remaining • Item Sold Counts • Date: ${escapeXml(businessDate)}</Data>
        </Cell>
      </Row>
      <Row ss:Height="10"/>

      <!-- Column Headers -->
      <Row ss:Height="26">
        <Cell ss:StyleID="ColHeaderMenu"><Data ss:Type="String">Sl</Data></Cell>
        <Cell ss:StyleID="ColHeaderMenu"><Data ss:Type="String">Item ID</Data></Cell>
        <Cell ss:StyleID="ColHeaderMenu"><Data ss:Type="String">Dish Name</Data></Cell>
        <Cell ss:StyleID="ColHeaderMenu"><Data ss:Type="String">Malayalam Name</Data></Cell>
        <Cell ss:StyleID="ColHeaderMenu"><Data ss:Type="String">Category</Data></Cell>
        <Cell ss:StyleID="ColHeaderMenu"><Data ss:Type="String">Price (INR)</Data></Cell>
        <Cell ss:StyleID="ColHeaderMenu"><Data ss:Type="String">Sold Today</Data></Cell>
        <Cell ss:StyleID="ColHeaderMenu"><Data ss:Type="String">Stock Left</Data></Cell>
        <Cell ss:StyleID="ColHeaderMenu"><Data ss:Type="String">Status</Data></Cell>
        <Cell ss:StyleID="ColHeaderMenu"><Data ss:Type="String">Revenue (INR)</Data></Cell>
      </Row>

      ${sheet2RowsXml}
    </Table>
  </Worksheet>`;

  // ==========================================================================
  // SHEET 3: Registered table wise order storage with amount (All-Time Sales Data)
  // ==========================================================================
  let sheet3RowsXml = '';
  if (tableList.length === 0) {
    sheet3RowsXml = `
    <Row ss:Height="24">
      <Cell ss:MergeAcross="8" ss:StyleID="EmptyRow">
        <Data ss:Type="String">No tables registered yet. Tables are added permanently from Table Management.</Data>
      </Cell>
    </Row>`;
  } else {
    const allHistoricalRecords = readAllDailyLedgers();
    tableList.forEach((t, idx) => {
      const tCode = (t.tableCode || '').trim().toUpperCase();
      const tName = (t.displayName || '').trim().toUpperCase();

      // Find all settled orders for this table across ALL time records
      const tblSettledAllTime = allHistoricalRecords.filter((s) => {
        const sc = (s.tableCode || '').trim().toUpperCase();
        const sn = (s.tableName || '').trim().toUpperCase();
        return (sc && (sc === tCode || sc === tName)) || (sn && (sn === tCode || sn === tName));
      });
      // Also include active unpaid orders currently at table
      const activeUnpaidOrders = (db.orders || []).filter((o) => {
        const oc = (o.tableCode || '').trim().toUpperCase();
        const on = (o.tableName || '').trim().toUpperCase();
        return ((oc && (oc === tCode || oc === tName)) || (on && (on === tCode || on === tName))) && o.paymentStatus === 'UNPAID';
      });

      const totalOrderCount = tblSettledAllTime.length + activeUnpaidOrders.length;
      const settledPaise = tblSettledAllTime.reduce((acc, s) => acc + (s.grandTotalPaise || 0), 0);
      const activePaise = activeUnpaidOrders.reduce((acc, o) => acc + (o.grandTotalPaise || 0), 0);
      const totalPaise = settledPaise + activePaise;
      const totalRupees = (totalPaise / 100).toFixed(2);
      const invoicesStr = tblSettledAllTime.slice(0, 10).map((o) => o.invoiceNumber || o.orderCode).filter(Boolean).join(', ') || (activeUnpaidOrders.length > 0 ? 'Active Unpaid Orders' : 'None');

      const liveStatus = activeUnpaidOrders.length > 0 
        ? (activeUnpaidOrders.some(o => o.fulfillmentStatus === 'READY' || o.fulfillmentStatus === 'SERVED') ? 'BILL_PENDING' : 'OCCUPIED')
        : (t.status || 'AVAILABLE');

      sheet3RowsXml += `
    <Row ss:Height="22">
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
      <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${escapeXml(t.roomName || 'Dining Area')}</Data></Cell>
      <Cell ss:StyleID="DataCellCode"><Data ss:Type="String">${escapeXml(t.tableCode)}</Data></Cell>
      <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${escapeXml(t.displayName || `Table ${t.tableCode}`)}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="Number">${t.capacity || 4}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="Number">${totalOrderCount}</Data></Cell>
      <Cell ss:StyleID="DataCellMoney"><Data ss:Type="Number">${totalRupees}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml(liveStatus)}</Data></Cell>
      <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${escapeXml(invoicesStr)}</Data></Cell>
    </Row>`;
    });
  }

  const sheet3Xml = `
  <Worksheet ss:Name="Table Orders Storage">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="35"/>
      <Column ss:Width="140"/>
      <Column ss:Width="90"/>
      <Column ss:Width="160"/>
      <Column ss:Width="80"/>
      <Column ss:Width="95"/>
      <Column ss:Width="110"/>
      <Column ss:Width="95"/>
      <Column ss:Width="250"/>

      <!-- Header Banner -->
      <Row ss:Height="36">
        <Cell ss:MergeAcross="8" ss:StyleID="BannerTables">
          <Data ss:Type="String">ITHI POORAM (ഇത്തിപ്പൂരം) — REGISTERED TABLE-WISE ORDER STORAGE</Data>
        </Cell>
      </Row>
      <Row ss:Height="22">
        <Cell ss:MergeAcross="8" ss:StyleID="SubTitle">
          <Data ss:Type="String">Permanent Table Registry • Room-Wise Separation • Daily Order Storage &amp; Total Amount</Data>
        </Cell>
      </Row>
      <Row ss:Height="10"/>

      <!-- Column Headers -->
      <Row ss:Height="26">
        <Cell ss:StyleID="ColHeaderTables"><Data ss:Type="String">Sl</Data></Cell>
        <Cell ss:StyleID="ColHeaderTables"><Data ss:Type="String">Room / Dining Area</Data></Cell>
        <Cell ss:StyleID="ColHeaderTables"><Data ss:Type="String">Table Code</Data></Cell>
        <Cell ss:StyleID="ColHeaderTables"><Data ss:Type="String">Display Label</Data></Cell>
        <Cell ss:StyleID="ColHeaderTables"><Data ss:Type="String">Capacity</Data></Cell>
        <Cell ss:StyleID="ColHeaderTables"><Data ss:Type="String">Today Orders</Data></Cell>
        <Cell ss:StyleID="ColHeaderTables"><Data ss:Type="String">Total Amount (INR)</Data></Cell>
        <Cell ss:StyleID="ColHeaderTables"><Data ss:Type="String">Current Status</Data></Cell>
        <Cell ss:StyleID="ColHeaderTables"><Data ss:Type="String">Stored Today Invoices</Data></Cell>
      </Row>

      ${sheet3RowsXml}
    </Table>
  </Worksheet>`;

  // ==========================================================================
  // SHEET 4: Billing settlement page (With Bold Date & Day Section Rows)
  // ==========================================================================
  let sheet4RowsXml = '';
  if (salesList.length === 0) {
    sheet4RowsXml = `
    <Row ss:Height="24">
      <Cell ss:MergeAcross="8" ss:StyleID="EmptyRow">
        <Data ss:Type="String">No billing settlements stored for business date ${escapeXml(businessDate)}.</Data>
      </Cell>
    </Row>`;
  } else {
    let globalBillIndex = 1;
    sortedDates.forEach((dStr) => {
      const daySales = salesByDate[dStr] || [];
      const dayInfo = getIstDayAndDateString(dStr);
      const dayGross = daySales.reduce((acc, s) => acc + (s.grandTotalPaise || 0), 0) / 100;

      // Bold Date & Day Section Header
      sheet4RowsXml += `
    <Row ss:Height="28">
      <Cell ss:MergeAcross="9" ss:StyleID="DayDateHeader">
        <Data ss:Type="String">${escapeXml(dayInfo.headerLabel)}</Data>
      </Cell>
    </Row>`;

      daySales.forEach((s) => {
        const invNo = s.invoiceNumber || `INV-${dStr.replace(/-/g, '')}-${String(globalBillIndex).padStart(3, '0')}`;
        const timeStr = s.settledAt ? new Date(s.settledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '12:00:00 PM';
        const grandTotal = ((s.grandTotalPaise || 0) / 100).toFixed(2);
        const printedBy = s.cashier || 'Main Administrator';
        const summary = s.itemsSummary || (s.items || []).map((i: any) => `${i.itemName || i.name || 'Dish'} x ${i.quantity || i.qty || 1}`).join(', ') || 'Delicacies';

        sheet4RowsXml += `
    <Row ss:Height="22">
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="Number">${globalBillIndex++}</Data></Cell>
      <Cell ss:StyleID="DataCellCode"><Data ss:Type="String">${escapeXml(invNo)}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml(s.orderCode || invNo)}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml(`${dStr} ${timeStr}`)}</Data></Cell>
      <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${escapeXml(s.roomName || 'Dining Area')}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml(s.tableName || s.tableCode || 'COUNTER')}</Data></Cell>
      <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${escapeXml(summary)}</Data></Cell>
      <Cell ss:StyleID="DataCellMoney"><Data ss:Type="Number">${grandTotal}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml((s.paymentMode || 'CASH').toUpperCase())}</Data></Cell>
      <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${escapeXml(printedBy)}</Data></Cell>
    </Row>`;
      });

      // Day Subtotal Row
      sheet4RowsXml += `
    <Row ss:Height="24">
      <Cell ss:MergeAcross="6" ss:StyleID="DayDateSubtotal">
        <Data ss:Type="String">Settlement Total (${escapeXml(dayInfo.dayName)} - ${dStr}): ${daySales.length} Invoices</Data>
      </Cell>
      <Cell ss:StyleID="DataCellMoneyTotal"><Data ss:Type="Number">${dayGross.toFixed(2)}</Data></Cell>
      <Cell ss:MergeAcross="1" ss:StyleID="DataCellCenter"><Data ss:Type="String">Audited Settlements</Data></Cell>
    </Row>
    <Row ss:Height="6"/>`;
    });
  }

  const sheet4Xml = `
  <Worksheet ss:Name="Billing Settlement">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="35"/>
      <Column ss:Width="140"/>
      <Column ss:Width="110"/>
      <Column ss:Width="150"/>
      <Column ss:Width="130"/>
      <Column ss:Width="90"/>
      <Column ss:Width="260"/>
      <Column ss:Width="110"/>
      <Column ss:Width="95"/>
      <Column ss:Width="180"/>

      <!-- Header Banner -->
      <Row ss:Height="36">
        <Cell ss:MergeAcross="9" ss:StyleID="BannerBilling">
          <Data ss:Type="String">ITHI POORAM (ഇത്തിപ്പൂരം) — BILLING SETTLEMENT &amp; CASHIER AUDIT</Data>
        </Cell>
      </Row>
      <Row ss:Height="22">
        <Cell ss:MergeAcross="9" ss:StyleID="SubTitle">
          <Data ss:Type="String">Invoice Details • Ordered Items • Who Authorized &amp; Printed Every Bill • Cashier Audit Ledger</Data>
        </Cell>
      </Row>
      <Row ss:Height="10"/>

      <!-- Column Headers -->
      <Row ss:Height="26">
        <Cell ss:StyleID="ColHeaderBilling"><Data ss:Type="String">Sl</Data></Cell>
        <Cell ss:StyleID="ColHeaderBilling"><Data ss:Type="String">Invoice Number</Data></Cell>
        <Cell ss:StyleID="ColHeaderBilling"><Data ss:Type="String">Order Ticket</Data></Cell>
        <Cell ss:StyleID="ColHeaderBilling"><Data ss:Type="String">Settled Date &amp; Time</Data></Cell>
        <Cell ss:StyleID="ColHeaderBilling"><Data ss:Type="String">Room Area</Data></Cell>
        <Cell ss:StyleID="ColHeaderBilling"><Data ss:Type="String">Table Code</Data></Cell>
        <Cell ss:StyleID="ColHeaderBilling"><Data ss:Type="String">Ordered Items Summary</Data></Cell>
        <Cell ss:StyleID="ColHeaderBilling"><Data ss:Type="String">Grand Total (INR)</Data></Cell>
        <Cell ss:StyleID="ColHeaderBilling"><Data ss:Type="String">Payment Mode</Data></Cell>
        <Cell ss:StyleID="ColHeaderBilling"><Data ss:Type="String">Authorized &amp; Printed By</Data></Cell>
      </Row>

      ${sheet4RowsXml}
    </Table>
  </Worksheet>`;

  // ==========================================================================
  // SHEET 5: Staff registration and authorization and authentication page
  // ==========================================================================
  let sheet5RowsXml = '';
  if (staffList.length === 0) {
    sheet5RowsXml = `
    <Row ss:Height="24">
      <Cell ss:MergeAcross="7" ss:StyleID="EmptyRow">
        <Data ss:Type="String">Main Administrator registered. Add staff accounts from More &gt; Staff Management.</Data>
      </Cell>
    </Row>`;
  } else {
    staffList.forEach((st, idx) => {
      const staffId = st.id || `ithi_staff_${String(idx + 1).padStart(3, '0')}`;
      sheet5RowsXml += `
    <Row ss:Height="22">
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="Number">${idx + 1}</Data></Cell>
      <Cell ss:StyleID="DataCellCode"><Data ss:Type="String">${escapeXml(staffId)}</Data></Cell>
      <Cell ss:StyleID="DataCellLeft"><Data ss:Type="String">${escapeXml(st.fullName || st.username)}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml(st.role || 'CASHIER')}</Data></Cell>
      <Cell ss:StyleID="DataCellPin"><Data ss:Type="String">${escapeXml(st.pin ? '••••' : 'ACTIVE')}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml(st.station || 'POS Counter Desk')}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml((st as any).status || (st.isActive ? 'ACTIVE' : 'INACTIVE') || 'ACTIVE')}</Data></Cell>
      <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${escapeXml(st.registeredAt || businessDate)}</Data></Cell>
    </Row>`;
    });
  }

  const sheet5Xml = `
  <Worksheet ss:Name="Staff Authorization">
    <Table ss:DefaultRowHeight="20">
      <Column ss:Width="35"/>
      <Column ss:Width="130"/>
      <Column ss:Width="180"/>
      <Column ss:Width="140"/>
      <Column ss:Width="90"/>
      <Column ss:Width="160"/>
      <Column ss:Width="100"/>
      <Column ss:Width="140"/>

      <!-- Header Banner -->
      <Row ss:Height="36">
        <Cell ss:MergeAcross="7" ss:StyleID="BannerStaff">
          <Data ss:Type="String">ITHI POORAM (ഇത്തിപ്പൂരം) — STAFF REGISTRATION &amp; AUTHENTICATION</Data>
        </Cell>
      </Row>
      <Row ss:Height="22">
        <Cell ss:MergeAcross="7" ss:StyleID="SubTitle">
          <Data ss:Type="String">Staff Credentials • Role Permissions • Station Assignment • Security Authentication Registry</Data>
        </Cell>
      </Row>
      <Row ss:Height="10"/>

      <!-- Column Headers -->
      <Row ss:Height="26">
        <Cell ss:StyleID="ColHeaderStaff"><Data ss:Type="String">Sl</Data></Cell>
        <Cell ss:StyleID="ColHeaderStaff"><Data ss:Type="String">Staff ID</Data></Cell>
        <Cell ss:StyleID="ColHeaderStaff"><Data ss:Type="String">Full Name</Data></Cell>
        <Cell ss:StyleID="ColHeaderStaff"><Data ss:Type="String">Designated Role</Data></Cell>
        <Cell ss:StyleID="ColHeaderStaff"><Data ss:Type="String">Auth Key</Data></Cell>
        <Cell ss:StyleID="ColHeaderStaff"><Data ss:Type="String">Station Desk</Data></Cell>
        <Cell ss:StyleID="ColHeaderStaff"><Data ss:Type="String">Status</Data></Cell>
        <Cell ss:StyleID="ColHeaderStaff"><Data ss:Type="String">Registered Date</Data></Cell>
      </Row>

      ${sheet5RowsXml}
    </Table>
  </Worksheet>`;

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Ithi Pooram - Master Restaurant Database</Title>
  <Subject>Daily Restaurant Operations, Sales, Menu, Tables, Billing &amp; Staff</Subject>
  <Author>Ithi Pooram POS System</Author>
  <Created>${escapeXml(new Date().toISOString())}</Created>
 </DocumentProperties>
 <Styles>
${COMMON_STYLES}
 </Styles>
${sheet1Xml}
${sheet2Xml}
${sheet3Xml}
${sheet4Xml}
${sheet5Xml}
</Workbook>`;
}

// Backward-compatible alias
export const generateUnifiedMasterDatabase = generateUnifiedMasterDatabaseXml;
