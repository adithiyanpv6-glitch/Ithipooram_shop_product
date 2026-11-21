'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ChefHat, 
  Home, 
  UtensilsCrossed, 
  BarChart3, 
  MoreHorizontal, 
  Grid3X3, 
  ChevronRight, 
  FileText, 
  Download, 
  LogOut, 
  Menu as MenuIcon, 
  X, 
  Calendar as CalendarIcon, 
  Printer, 
  ChevronDown,
  ChevronLeft,
  Receipt,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { apiRequest, getCurrentUser } from '../../lib/api';
import { printDirectToBluetoothThermalPrinter } from '../../lib/thermalPrinter';

export default function ReportsPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'orders' | 'items' | 'stock'>('orders');
  const [salesData, setSalesData] = useState<any[]>([]);
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState<string>('All');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Full Calendar & Date Filter State
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const now = useMemo(() => new Date(), []);
  const [calendarYear, setCalendarYear] = useState<number>(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(now.getMonth());
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(
    now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  );
  const [dateFilterLabel, setDateFilterLabel] = useState<string>('Today');
  const [activePreset, setActivePreset] = useState<string>('Today');

  // Selected bill for receipt preview modal
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  // Dedicated 58mm Thermal Report Slip Modal State
  const [isReportThermalModalOpen, setIsReportThermalModalOpen] = useState(false);
  const [isBluetoothPrintingReport, setIsBluetoothPrintingReport] = useState(false);
  const [reportBtStatus, setReportBtStatus] = useState<string | null>(null);

  // Dynamically resolve target date for API & Excel download
  const resolvedDateParam = useMemo(() => {
    if (activePreset === 'Today') return 'today';
    if (activePreset === 'Yesterday') return 'yesterday';
    if (activePreset === 'Last 7 days') return '7days';
    if (activePreset === 'Last 30 days') return '30days';
    if (activePreset === 'This Month') return 'month';
    if (activePreset === 'All Time') return 'all';
    return selectedIsoDate || 'today';
  }, [activePreset, selectedIsoDate]);

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const currentMonthLabel = useMemo(() => {
    return new Date(calendarYear, calendarMonth, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [calendarYear, calendarMonth]);

  const monthGrid = useMemo(() => {
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 = Sun
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    return { firstDayIndex, totalDays };
  }, [calendarYear, calendarMonth]);

  const handleSelectDay = (day: number) => {
    const dObj = new Date(calendarYear, calendarMonth, day);
    const iso = dObj.toLocaleDateString('en-CA');
    const label = dObj.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    setSelectedIsoDate(iso);
    setActivePreset('Custom');
    setDateFilterLabel(label);
    setIsDatePickerOpen(false);
  };

  const handleNativeDateChange = (val: string) => {
    if (!val) return;
    setSelectedIsoDate(val);
    setActivePreset('Custom');
    const dObj = new Date(val + 'T00:00:00');
    setDateFilterLabel(dObj.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }));
  };

  const handleSelectPreset = (preset: string) => {
    setActivePreset(preset);
    const today = new Date();
    if (preset === 'Today') {
      setSelectedIsoDate(today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
      setDateFilterLabel('Today');
    } else if (preset === 'Yesterday') {
      const yd = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      setSelectedIsoDate(yd.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
      setDateFilterLabel('Yesterday');
    } else if (preset === 'Last 7 days') {
      setDateFilterLabel('Last 7 Days');
    } else if (preset === 'Last 30 days') {
      setDateFilterLabel('Last 30 Days');
    } else if (preset === 'This Month') {
      setDateFilterLabel(today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    } else if (preset === 'All Time') {
      setDateFilterLabel('All Time History');
    }
    if (preset !== 'Custom') {
      setIsDatePickerOpen(false);
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      const endpoint = `/api/admin/overview?range=${encodeURIComponent(resolvedDateParam)}&date=${encodeURIComponent(resolvedDateParam)}`;
      const res = await apiRequest(endpoint);
      setOverviewData(res);

      if (res && Array.isArray(res.sales)) {
        setSalesData(res.sales);
      } else {
        setSalesData([]);
      }
    } catch (e) {
      console.error('Failed to load reports:', e);
      setSalesData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    loadReports();
  }, [router, dateFilterLabel, activePreset, selectedIsoDate, resolvedDateParam]);

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ithipooram_user');
      localStorage.removeItem('ithipooram_token');
    }
    router.replace('/login');
  };

  const formatRupees = (paise: number = 0) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  const totalSalesPaise = overviewData?.kpis?.grossSalesPaise ?? 0;
  const totalOrdersCount = overviewData?.kpis?.paidOrdersCount ?? salesData.length;

  const cashTotalPaise = useMemo(() => {
    return salesData
      .filter((s) => (s.paymentType || s.paymentMode || '').toUpperCase() === 'CASH')
      .reduce((sum, s) => sum + (s.amountPaise || s.grandTotalPaise || 0), 0);
  }, [salesData]);

  const upiTotalPaise = useMemo(() => {
    return salesData
      .filter((s) => (s.paymentType || s.paymentMode || '').toUpperCase() === 'UPI')
      .reduce((sum, s) => sum + (s.amountPaise || s.grandTotalPaise || 0), 0);
  }, [salesData]);

  // Direct Bluetooth Print for 58mm Daily Report Slip
  const handlePrintReportToBluetooth = async () => {
    try {
      setIsBluetoothPrintingReport(true);
      setReportBtStatus(null);
      await printDirectToBluetoothThermalPrinter({
        restaurantName: 'ITHI POORAM',
        restaurantLocation: 'Vanchiyoor, Trivandrum',
        phone: '+91 94470 00000',
        reportType: 'daily_report',
        title: 'DAILY REVENUE REPORT',
        dateRangeLabel: dateFilterLabel,
        dateTime: new Date().toLocaleDateString('en-IN'),
        settledChecksCount: totalOrdersCount,
        cashRevenue: cashTotalPaise / 100,
        upiRevenue: upiTotalPaise / 100,
        grandTotal: totalSalesPaise / 100,
        dishesSold: salesData.slice(0, 5).map((s: any) => ({
          name: (s.items || 'Kerala Seafood').substring(0, 18),
          amount: (s.amountPaise || 12000) / 100,
        })),
        footerPrimary: 'ഇത്തിപ്പൂരം റിപ്പോർട്ട്',
        footerSecondary: 'Generated at Vanchiyoor POS Terminal',
        extraLines: 8,
      }, 'bitmap');
      setReportBtStatus('Report slip sent to SEZNIK successfully!');
    } catch (e: any) {
      setReportBtStatus(`Bluetooth Error: ${e.message || 'Connection failed'}`);
    } finally {
      setIsBluetoothPrintingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0A0C10] flex flex-col md:flex-row font-sans selection:bg-zinc-800 selection:text-white">
      
      {/* ============================================================== */}
      {/* 1. LEFT SIDEBAR                                                 */}
      {/* ============================================================== */}
      <aside className="hidden md:flex md:w-64 lg:w-72 bg-[#0C0E12] text-zinc-300 flex-col justify-between border-r border-zinc-800 shrink-0 select-none">
        
        {/* Top Brand Logo */}
        <div className="p-4 lg:p-5 border-b border-zinc-800/80">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" className="flex-1 flex items-center justify-start group py-1">
              <img 
                src="/brand-calligraphy-uploaded.png" 
                alt="ഇത്തിപ്പൂരം - Ithi Pooram" 
                className="w-full max-h-16 lg:max-h-20 object-contain invert brightness-200 transition group-hover:scale-102"
              />
            </Link>
            <button 
              onClick={handleSignOut}
              title="Sign Out"
              className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-white transition shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5 flex-1">
          <Link
            href="/"
            className="flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-zinc-400 hover:bg-zinc-900 hover:text-white font-bold text-sm transition"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>

          <Link
            href="/qr"
            className="flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-zinc-400 hover:bg-zinc-900 hover:text-white font-bold text-sm transition"
          >
            <Grid3X3 className="w-4 h-4" />
            <span>Table</span>
          </Link>

          {/* Dedicated Billing Terminal Link */}
          <Link
            href="/billing"
            className="flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-zinc-400 hover:bg-zinc-900 hover:text-white font-bold text-sm transition"
          >
            <Receipt className="w-4 h-4" />
            <span>Billing</span>
          </Link>

          <Link
            href="/menu"
            className="flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-zinc-400 hover:bg-zinc-900 hover:text-white font-bold text-sm transition"
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Items</span>
          </Link>

          <Link
            href="/reports"
            className="flex items-center justify-between px-3.5 py-3 rounded-2xl bg-white text-black font-extrabold text-sm shadow-md transition"
          >
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-4 h-4" />
              <span>Reports</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
          </Link>

          <Link
            href="/users"
            className="flex items-center justify-between px-3.5 py-3 rounded-2xl text-zinc-400 hover:bg-zinc-900 hover:text-white font-bold text-sm transition"
          >
            <div className="flex items-center space-x-3">
              <MoreHorizontal className="w-4 h-4" />
              <span>More</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
          </Link>
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-zinc-800/80 space-y-3">
          <Link
            href="/billing"
            className="w-full flex items-center justify-center py-3 px-4 rounded-2xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs shadow-sm transition active:scale-98"
          >
            <span>+ Add Order</span>
          </Link>

          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-white text-black font-black text-xs flex items-center justify-center">
                IP
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">Ithi Pooram</p>
                <p className="text-[10px] text-zinc-400 truncate">Vanchiyoor, TVM</p>
              </div>
            </div>
            <button onClick={handleSignOut} className="text-zinc-500 hover:text-white p-1">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. MOBILE TOP BAR                                               */}
      {/* ============================================================== */}
      <header className="md:hidden bg-[#0C0E12] text-white p-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-3 flex-1">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
          <img 
            src="/brand-calligraphy-uploaded.png" 
            alt="ഇത്തിപ്പൂരം" 
            className="h-9 w-auto object-contain invert brightness-200"
          />
        </div>
        <Link href="/billing" className="px-3.5 py-1.5 rounded-xl bg-white text-black font-black text-xs">
          <span>+ Add Order</span>
        </Link>
      </header>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#0C0E12] border-b border-zinc-800 px-4 py-3 space-y-2 z-30">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-zinc-300 font-bold text-sm">
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>
          <Link href="/qr" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-zinc-300 font-bold text-sm">
            <Grid3X3 className="w-4 h-4" />
            <span>Table</span>
          </Link>
          <Link href="/menu" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-zinc-300 font-bold text-sm">
            <UtensilsCrossed className="w-4 h-4" />
            <span>Items</span>
          </Link>
          <Link href="/reports" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3 px-3 py-2.5 rounded-xl bg-white text-black font-black text-sm">
            <BarChart3 className="w-4 h-4" />
            <span>Reports</span>
          </Link>
          <Link href="/users" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-zinc-300 font-bold text-sm">
            <MoreHorizontal className="w-4 h-4" />
            <span>More</span>
          </Link>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MAIN REPORTS WORKSPACE (Redesigned with uploaded Date Modal) */}
      {/* ============================================================== */}
      <main className="flex-1 flex flex-col w-full overflow-hidden">
        
        {/* Top Header with Exact Red PDF and Green XLS download buttons matching uploaded image */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-white border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/');
                }
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-black font-extrabold text-xs transition cursor-pointer active:scale-95 shadow-xs"
              title="Back to Previous Screen"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="h-6 w-px bg-zinc-200" />
            <h1 className="text-lg sm:text-2xl font-black text-black">Orders Report</h1>
          </div>
          
          {/* Two live print options: 1. Billing Paper (58mm Thermal Slip) 2. A4 Full Report (PDF) + Excel Download */}
          <div className="flex items-center space-x-2">
            {/* Option 1: Print on Billing Paper (58mm Thermal Slip) */}
            <button
              onClick={() => setIsReportThermalModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white font-black text-xs flex items-center space-x-1.5 shadow-xs transition active:scale-98 cursor-pointer"
              title="Print Daily Sales Summary on 58mm Thermal Billing Paper"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Thermal Slip (58mm)</span>
            </button>

            {/* Option 2: Full Report (A4 / PDF) */}
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-100 text-black border border-zinc-300 font-extrabold text-xs flex items-center space-x-1.5 shadow-xs transition active:scale-98 cursor-pointer"
              title="Full Page Print / Save as PDF"
            >
              <FileText className="w-3.5 h-3.5 text-zinc-700" />
              <span>A4 / PDF</span>
            </button>

            {/* Excel (.xls) Download - Dynamically bound to currently filtered date or range */}
            <a
              href={`/api/admin/daily-reports?date=${encodeURIComponent(resolvedDateParam)}&format=excel`}
              download={`IthiPooram_Report_${dateFilterLabel.replace(/[\s/]+/g, '_')}.xls`}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider shadow-xs transition flex items-center space-x-1 cursor-pointer"
              title={`Download Multi-Sheet Excel Report for ${dateFilterLabel}`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-200" />
              <span>xls</span>
            </a>
          </div>
        </div>

        {/* Content View with Full Smooth Scrolling */}
        <div className="flex-1 p-4 sm:p-6 pb-36 sm:pb-32 overflow-y-auto space-y-5">
          
          {/* Filter Pills Bar: Date Dropdown, Native Calendar Input, Payment Type */}
          <div className="flex flex-wrap items-center gap-2.5 relative">
            
            {/* 1. Date Option Button (Triggers Interactive Calendar Modal) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                className="px-4 py-2 rounded-xl bg-white border-2 border-blue-500 text-blue-600 text-xs font-black shadow-xs flex items-center space-x-2 transition cursor-pointer hover:bg-blue-50/50"
              >
                <CalendarIcon className="w-4 h-4 text-blue-600" />
                <span>{dateFilterLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
              </button>

              {/* DATE PICKER CALENDAR MODAL */}
              {isDatePickerOpen && (
                <div className="absolute top-12 left-0 z-50 bg-white rounded-3xl shadow-2xl border border-zinc-200 p-5 w-80 sm:w-96 text-xs text-black animate-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                    <span className="font-extrabold uppercase tracking-wider text-zinc-400 text-[10px]">
                      CHOOSE BUSINESS DATE
                    </span>
                    <button 
                      type="button"
                      onClick={() => {
                        handleSelectPreset('Today');
                        setIsDatePickerOpen(false);
                      }}
                      className="text-blue-600 font-bold hover:underline"
                    >
                      Reset to Today
                    </button>
                  </div>

                  <div className="grid grid-cols-12 gap-4 py-4">
                    {/* Left Quick Select Column */}
                    <div className="col-span-4 border-r border-zinc-100 pr-2 space-y-1">
                      <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block mb-1">
                        QUICK SELECT
                      </span>
                      {[
                        'Today',
                        'Yesterday',
                        'Last 7 days',
                        'Last 30 days',
                        'This Month',
                        'All Time',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className={`w-full text-left px-2 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                            activePreset === preset
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    {/* Right Interactive Calendar Column */}
                    <div className="col-span-8 space-y-3">
                      {/* Active Date Label Display */}
                      <div className="p-2.5 rounded-xl border-2 border-blue-500 bg-blue-50/40">
                        <span className="text-[9px] font-bold text-blue-600 uppercase block">Selected Date</span>
                        <span className="font-extrabold text-black text-xs block">
                          {selectedIsoDate}
                        </span>
                      </div>

                      {/* Month Switcher with Real Year & Month state */}
                      <div className="flex items-center justify-between font-extrabold text-xs px-1">
                        <button 
                          type="button"
                          onClick={handlePrevMonth}
                          className="p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-lg cursor-pointer"
                          title="Previous Month"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-black font-black">{currentMonthLabel}</span>
                        <button 
                          type="button"
                          onClick={handleNextMonth}
                          className="p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-lg cursor-pointer"
                          title="Next Month"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Calendar Day Grid */}
                      <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                        <span className="font-black text-zinc-400 py-1">SU</span>
                        <span className="font-black text-zinc-400 py-1">MO</span>
                        <span className="font-black text-zinc-400 py-1">TU</span>
                        <span className="font-black text-zinc-400 py-1">WE</span>
                        <span className="font-black text-zinc-400 py-1">TH</span>
                        <span className="font-black text-zinc-400 py-1">FR</span>
                        <span className="font-black text-zinc-400 py-1">SA</span>

                        {/* Leading Empty Cells */}
                        {Array.from({ length: monthGrid.firstDayIndex }).map((_, i) => (
                          <div key={`empty-${i}`} className="h-7" />
                        ))}

                        {/* Actual Month Days */}
                        {Array.from({ length: monthGrid.totalDays }).map((_, i) => {
                          const d = i + 1;
                          const thisIso = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const isSelected = selectedIsoDate === thisIso && activePreset === 'Custom';
                          const isToday = thisIso === now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

                          return (
                            <button
                              key={`day-${d}`}
                              type="button"
                              onClick={() => handleSelectDay(d)}
                              className={`h-7 rounded-lg font-bold text-xs transition flex items-center justify-center cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white font-extrabold shadow-sm'
                                  : isToday
                                  ? 'border border-blue-500 text-blue-600 font-extrabold hover:bg-blue-50'
                                  : 'text-zinc-700 hover:bg-zinc-100'
                              }`}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => setIsDatePickerOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Direct Native Date Calendar Input */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-black shadow-xs">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-extrabold">Jump to Date:</span>
              <input
                type="date"
                value={selectedIsoDate}
                onChange={(e) => handleNativeDateChange(e.target.value)}
                className="bg-transparent font-bold text-xs text-black cursor-pointer outline-none"
                title="Pick any date from system calendar"
              />
            </div>

            {/* 2. Payment Type Dropdown */}
            <div className="relative">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="appearance-none bg-white border border-zinc-200 text-xs font-bold text-black py-2 pl-3.5 pr-8 rounded-xl focus:outline-none cursor-pointer shadow-xs"
              >
                <option value="All">All Payment Type</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* 3. All Orders Dropdown */}
            <div className="relative">
              <select
                className="appearance-none bg-white border border-zinc-200 text-xs font-bold text-black py-2 pl-3.5 pr-8 rounded-xl focus:outline-none cursor-pointer shadow-xs"
              >
                <option value="All">All Orders</option>
                <option value="Dine-In">Dine-In</option>
                <option value="Takeaway">Takeaway</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* PRINTABLE REPORT AREA (PDF Export & Print Target)               */}
          {/* ============================================================== */}
          <div id="printable-report-area" className="space-y-5">
            
            {/* Header visible only on print */}
            <div className="hidden print:block pb-3 border-b-2 border-black">
              <h2 className="text-xl font-black text-black font-malayalam">ഇത്തിപ്പൂരം (ITHI POORAM)</h2>
              <p className="text-xs text-zinc-600 font-bold">Vanchiyoor, Trivandrum — Orders &amp; Revenue Report</p>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Date Range: {dateFilterLabel} | Generated: {new Date().toLocaleString('en-IN')}</p>
            </div>

            {/* Metric Cards (Total Sales & Total Orders) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 max-w-md gap-4">
            <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block mb-1">
                TOTAL SALES
              </span>
              <div className="text-2xl sm:text-3xl font-black text-black font-mono">
                {formatRupees(totalSalesPaise)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block mb-1">
                TOTAL ORDERS
              </span>
              <div className="text-2xl sm:text-3xl font-black text-black font-mono">
                {totalOrdersCount}
              </div>
            </div>
          </div>

          {/* Orders Report Table */}
          <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-800">
                <thead className="bg-zinc-50 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 border-b border-zinc-200">
                  <tr>
                    <th className="py-3 px-4">ORDER NO.</th>
                    <th className="py-3 px-4">TYPE</th>
                    <th className="py-3 px-4">DATE</th>
                    <th className="py-3 px-4">ITEMS</th>
                    <th className="py-3 px-4">AMOUNT</th>
                    <th className="py-3 px-4">PAYMENT TYPE</th>
                    <th className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {salesData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 px-4 text-center text-zinc-400">
                        <FileText className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                        <p className="font-black text-sm text-zinc-700">No settled orders found for {dateFilterLabel}</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          Bills settled in the terminal for this date will appear here accurately.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    salesData.map((s: any, idx: number) => (
                      <tr key={s.id || idx} className="hover:bg-zinc-50/70 transition">
                        <td className="py-3.5 px-4 font-mono font-black text-black">
                          {s.orderNumber || `#${idx + 1}`}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-zinc-600">
                          {s.type || 'Dine-In'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-zinc-600">
                          {s.date || new Date().toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-black">
                          {s.items || 'Dine-In Order'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-extrabold text-black text-sm">
                          {formatRupees(s.amountPaise || s.grandTotalPaise || 0)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full bg-zinc-100 border border-zinc-200 font-bold text-[10px] text-zinc-800">
                            {s.paymentType || s.paymentMode || 'Cash'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setSelectedReceipt(s)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-black hover:bg-zinc-100 transition"
                            title="Print / View Minimal Bill"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          </div> {/* End #printable-report-area */}

        </div>

      </main>

      {/* Bill Preview Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Bill Receipt</span>
              <button onClick={() => setSelectedReceipt(null)} className="text-zinc-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div id="printable-receipt" className="my-5 p-5 bg-[#FAFAFA] rounded-2xl border border-dashed border-zinc-300 font-mono text-xs text-black space-y-4">
              <div className="text-center space-y-1">
                <div className="flex justify-center mb-1">
                  <img 
                    src="/brand-calligraphy-uploaded.png" 
                    alt="ഇത്തിപ്പൂരം" 
                    className="h-10 w-auto object-contain"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 font-sans font-semibold">Vanchiyoor, Trivandrum</p>
                <div className="border-b border-dashed border-zinc-300 pt-2" />
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Order:</span>
                  <span className="font-bold">{selectedReceipt.orderNumber || '#4'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Table:</span>
                  <span className="font-bold">{selectedReceipt.tableCode || 'T1'}</span>
                </div>
                <div className="border-b border-dashed border-zinc-300 pt-1" />
              </div>

              <div className="space-y-1 text-sm font-black">
                <div className="flex justify-between items-center">
                  <span>TOTAL:</span>
                  <span className="text-base">{formatRupees(selectedReceipt.amountPaise || 110000)}</span>
                </div>
              </div>

              <div className="text-center pt-3 border-t border-dashed border-zinc-300 text-[10px] text-zinc-400 font-sans">
                <p className="font-bold text-black font-malayalam">നന്ദി, വീണ്ടും വരിക</p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={async () => {
                  try {
                    await printDirectToBluetoothThermalPrinter({
                      restaurantName: 'ITHI POORAM',
                      restaurantLocation: 'Vanchiyoor, Trivandrum',
                      phone: '+91 471 233 4567',
                      invoiceNumber: selectedReceipt.orderCode || 'INV-001',
                      tableCode: selectedReceipt.tableCode || 'Dine-In',
                      items: [{
                        name: (selectedReceipt.items || 'Food Items').substring(0, 16),
                        qty: 1,
                        price: (selectedReceipt.amountPaise || 12000) / 100,
                        total: (selectedReceipt.amountPaise || 12000) / 100,
                      }],
                      grandTotal: (selectedReceipt.amountPaise || 12000) / 100,
                      paymentMode: selectedReceipt.paymentType || 'Cash',
                    extraLines: 7,
                  }, 'bitmap');
                    alert('Sent to SEZNIK Bluetooth printer successfully!');
                  } catch (e: any) {
                    alert('SEZNIK Bluetooth: ' + (e.message || 'Connection error'));
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print to SEZNIK (Bluetooth)</span>
              </button>
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="flex-1 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-black flex items-center justify-center space-x-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>58mm Thermal Print (USB)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 58MM THERMAL REPORT SLIP MODAL (PRINTING VIA BILLING PAPER)     */}
      {/* ============================================================== */}
      {isReportThermalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center space-x-2">
                <Printer className="w-4 h-4 text-black" />
                <span className="text-xs font-black uppercase tracking-wider text-black">
                  Report on Billing Paper (58mm)
                </span>
              </div>
              <button 
                onClick={() => {
                  setIsReportThermalModalOpen(false);
                  setReportBtStatus(null);
                }} 
                className="text-zinc-400 hover:text-black p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status notice */}
            {reportBtStatus && (
              <div className={`mt-3 p-2.5 rounded-xl text-xs font-bold ${
                reportBtStatus.includes('Error') 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {reportBtStatus}
              </div>
            )}

            {/* 58mm Thermal Slip (Matches Physical Roll Width) */}
            <div 
              id="printable-receipt" 
              className="my-4 p-4 bg-[#FAFAFA] rounded-2xl border border-dashed border-zinc-300 font-mono text-[10px] text-black space-y-3 max-w-[280px] mx-auto text-left"
            >
              {/* Header */}
              <div className="text-center space-y-0.5">
                <div className="flex justify-center mb-1">
                  <img 
                    src="/brand-calligraphy-uploaded.png" 
                    alt="ഇത്തിപ്പൂരം" 
                    className="h-8 w-auto object-contain"
                  />
                </div>
                <p className="font-bold text-[10px]">ITHI POORAM</p>
                <p className="text-[9px] text-zinc-500 font-sans">Vanchiyoor, Trivandrum</p>
                <div className="border-b border-dashed border-zinc-400 pt-1" />
                <p className="text-[10px] font-black uppercase tracking-wider pt-1 font-sans">
                  DAILY REVENUE REPORT
                </p>
              </div>

              {/* Metadata */}
              <div className="text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span className="font-bold">{new Date().toLocaleDateString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Range:</span>
                  <span>{dateFilterLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span>Settled Checks:</span>
                  <span className="font-bold">{totalOrdersCount}</span>
                </div>
                <div className="border-b border-dashed border-zinc-400 pt-1" />
              </div>

              {/* Breakdown */}
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Cash Revenue:</span>
                  <span className="font-bold">{formatRupees(cashTotalPaise)}</span>
                </div>
                <div className="flex justify-between">
                  <span>UPI / Online:</span>
                  <span className="font-bold">{formatRupees(upiTotalPaise)}</span>
                </div>
                <div className="border-b border-dashed border-zinc-400 pt-1" />
              </div>

              {/* Grand Total */}
              <div className="flex justify-between font-black text-xs pt-0.5">
                <span>TOTAL SALES:</span>
                <span>{formatRupees(totalSalesPaise)}</span>
              </div>

              {/* Recent Dishes Sold */}
              {salesData.length > 0 && (
                <div className="pt-2 border-t border-dashed border-zinc-400 space-y-1 text-[9px]">
                  <p className="font-bold uppercase tracking-wider text-zinc-600">Dishes Sold:</p>
                  {salesData.slice(0, 4).map((s, idx) => (
                    <div key={idx} className="flex justify-between text-[9px]">
                      <span className="truncate max-w-[130px]">{s.items || 'Kerala Seafood'}</span>
                      <span className="font-mono font-bold">{formatRupees(s.amountPaise || 12000)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="text-center pt-2 border-t border-dashed border-zinc-400 text-[9px] text-zinc-500 font-sans space-y-0.5">
                <p className="font-bold text-black font-malayalam">ഇത്തിപ്പൂരം റിപ്പോർട്ട്</p>
                <p>Generated at Vanchiyoor POS Terminal</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="space-y-2">
              <button
                onClick={handlePrintReportToBluetooth}
                disabled={isBluetoothPrintingReport}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center space-x-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer active:scale-98"
              >
                {isBluetoothPrintingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                <span>Print to SEZNIK (Bluetooth)</span>
              </button>

              <div className="flex space-x-2">
                <button
                  onClick={() => setIsReportThermalModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-black flex items-center justify-center space-x-1.5 shadow-xs transition cursor-pointer active:scale-98"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip (USB)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
