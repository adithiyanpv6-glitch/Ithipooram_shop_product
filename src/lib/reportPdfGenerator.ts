import jsPDF from 'jspdf';
import { BRAND_CALLIGRAPHY_BASE64 } from './brandCalligraphyBase64';

export async function downloadReportAsPdf(reportType: string, isoDate: string, filename: string) {
  try {
    const res = await fetch(`/api/admin/daily-reports?date=${isoDate}`);
    if (!res.ok) {
      throw new Error('Failed to fetch report data from database');
    }
    const data = await res.json();
    const reports = data.reports || {};

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Color palette - Black & White / Luxury Zinc Theme
    const primaryColor = [12, 14, 18]; // #0C0E12
    const accentGrey = [100, 116, 139];
    const lightBg = [248, 250, 252];

    // Header Banner - Authentic Brand Calligraphy Logo (matching bills & home screen)
    try {
      // 384x86 -> aspect ratio ~4.465. At width = 48mm, height = 10.75mm
      doc.addImage(BRAND_CALLIGRAPHY_BASE64, 'PNG', 14, 8, 48, 10.75);
    } catch (e) {
      console.warn('Calligraphy logo rendering fallback:', e);
    }

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('VANCHIYOOR, TRIVANDRUM', 14, 23);

    // Business Date & Report Stamp on top right
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`DATE: ${isoDate}`, 196, 14, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('OFFICIAL BUSINESS REPORT', 196, 20, { align: 'right' });

    // Clean dividing border rule below header
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 26, 196, 26);

    let y = 35;

    // Report Type Heading
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);

    if (reportType === 'sales') {
      doc.text('TOTAL SALES OF THE DAY REPORT', 14, y);
      y += 8;
      const sales = reports.totalSales || {};

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Business Day: ${isoDate}`, 14, y);
      y += 10;

      // Clean KPI Grid (Total Bills, Gross Total, Cash, UPI - Zero Tax)
      const rows = [
        ['Total Bills Settled', `${sales.totalBillsSettled || 0} Orders`],
        ['Gross Total Sales', `INR ${(sales.grossSalesRupees || 0).toFixed(2)}`],
        ['Cash Collections', `INR ${(sales.cashRupees || 0).toFixed(2)}`],
        ['UPI / Online Collections', `INR ${(sales.upiRupees || 0).toFixed(2)}`],
      ];

      rows.forEach(([label, value], idx) => {
        const rowBg = idx % 2 === 0 ? 245 : 255;
        doc.setFillColor(rowBg, rowBg, rowBg);
        doc.rect(14, y - 4, 182, 8, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.line(14, y + 4, 196, y + 4);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(label, 18, y + 1.5);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(value, 192, y + 1.5, { align: 'right' });
        y += 8;
      });

    } else if (reportType === 'menu') {
      doc.text('2. DAILY MENU STOCK & REMAINING DATA REPORT', 14, y);
      y += 8;
      const items = reports.menuAndRemainingStock || [];

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y - 4, 182, 8, 'F');
      doc.text('Item Name', 16, y + 1.5);
      doc.text('Category', 80, y + 1.5);
      doc.text('Price (INR)', 125, y + 1.5);
      doc.text('Sold', 150, y + 1.5);
      doc.text('Remaining Stock', 192, y + 1.5, { align: 'right' });
      y += 8;

      doc.setFont('helvetica', 'normal');
      items.forEach((it: any, idx: number) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        const rowBg = idx % 2 === 0 ? 250 : 255;
        doc.setFillColor(rowBg, rowBg, rowBg);
        doc.rect(14, y - 4, 182, 7, 'F');

        doc.text(String(it.name || '').substring(0, 35), 16, y + 1);
        doc.text(String(it.category || '').substring(0, 20), 80, y + 1);
        doc.text(String(it.priceRupees || 0), 125, y + 1);
        doc.text(String(it.soldQty || 0), 150, y + 1);
        doc.text(String(it.currentStock || 'Unlimited'), 192, y + 1, { align: 'right' });
        y += 7;
      });

    } else if (reportType === 'tables') {
      doc.text('3. DAILY TABLE-WISE ORDER & REVENUE REPORT', 14, y);
      y += 8;
      const tables = reports.tablewiseRevenue || [];

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y - 4, 182, 8, 'F');
      doc.text('Table Code', 16, y + 1.5);
      doc.text('Display Name', 60, y + 1.5);
      doc.text('Total Orders Served', 130, y + 1.5);
      doc.text('Revenue (INR)', 192, y + 1.5, { align: 'right' });
      y += 8;

      doc.setFont('helvetica', 'normal');
      tables.forEach((t: any, idx: number) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        const rowBg = idx % 2 === 0 ? 250 : 255;
        doc.setFillColor(rowBg, rowBg, rowBg);
        doc.rect(14, y - 4, 182, 7, 'F');

        doc.text(t.tableCode || '', 16, y + 1);
        doc.text(t.displayName || '', 60, y + 1);
        doc.text(String(t.ordersCount || 0), 130, y + 1);
        doc.text(`INR ${(t.totalRevenueRupees || 0).toFixed(2)}`, 192, y + 1, { align: 'right' });
        y += 7;
      });

    } else if (reportType === 'staff') {
      doc.text('4. STAFF LOGIN & SHIFT AUDIT REPORT', 14, y);
      y += 8;
      const staffList = reports.staffLoginAudit || [];

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y - 4, 182, 8, 'F');
      doc.text('Staff Name', 16, y + 1.5);
      doc.text('Role', 70, y + 1.5);
      doc.text('Station', 120, y + 1.5);
      doc.text('Status', 192, y + 1.5, { align: 'right' });
      y += 8;

      doc.setFont('helvetica', 'normal');
      staffList.forEach((s: any, idx: number) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        const rowBg = idx % 2 === 0 ? 250 : 255;
        doc.setFillColor(rowBg, rowBg, rowBg);
        doc.rect(14, y - 4, 182, 7, 'F');

        doc.text(s.staffName || '', 16, y + 1);
        doc.text(s.role || '', 70, y + 1);
        doc.text(s.station || '', 120, y + 1);
        doc.text(s.status || 'ACTIVE', 192, y + 1, { align: 'right' });
        y += 7;
      });

    } else if (reportType === 'billing') {
      doc.text('5. BILLING AUTHORIZATION & PRINT AUDIT REPORT', 14, y);
      y += 8;
      const authList = reports.billingAuthorization || [];

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y - 4, 182, 8, 'F');
      doc.text('Invoice Ticket', 16, y + 1.5);
      doc.text('Table', 65, y + 1.5);
      doc.text('Payment', 95, y + 1.5);
      doc.text('Cashier Desk', 135, y + 1.5);
      doc.text('Amount (INR)', 192, y + 1.5, { align: 'right' });
      y += 8;

      doc.setFont('helvetica', 'normal');
      authList.forEach((b: any, idx: number) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        const rowBg = idx % 2 === 0 ? 250 : 255;
        doc.setFillColor(rowBg, rowBg, rowBg);
        doc.rect(14, y - 4, 182, 7, 'F');

        doc.text(b.billNumber || '', 16, y + 1);
        doc.text(b.tableCode || '', 65, y + 1);
        doc.text(b.paymentMode || 'UPI', 95, y + 1);
        doc.text(b.authorizedByStaffName || 'Cashier', 135, y + 1);
        doc.text(`INR ${(b.grandTotalRupees || 0).toFixed(2)}`, 192, y + 1, { align: 'right' });
        y += 7;
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Generated by Ithi Pooram Restaurant Management System on ${new Date().toLocaleString('en-IN')}`,
      14,
      288
    );
    doc.text('Page 1 of 1', 192, 288, { align: 'right' });

    // Download PDF directly
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);

    return true;
  } catch (err: any) {
    console.error('Error generating PDF:', err);
    throw err;
  }
}
