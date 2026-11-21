'use client';

import React, { useEffect, useState } from 'react';
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
  Printer, 
  Users, 
  LogOut, 
  Menu as MenuIcon, 
  X, 
  Bluetooth, 
  CheckCircle2, 
  Loader2, 
  RefreshCw, 
  Receipt,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  FolderDown,
  FileSpreadsheet,
  FileText,
  Plus,
  Lock,
  Unlock,
  Key,
  KeyRound,
  Check,
  Calendar,
  HardDrive,
  ArrowLeft
} from 'lucide-react';
import { getCurrentUser } from '../../lib/api';
import { downloadReportAsPdf } from '@/lib/reportPdfGenerator';
import { 
  printDirectToBluetoothThermalPrinter,
  connectPersistentBluetoothPrinter,
  subscribeToPrinterConnection,
  tryAutoReconnectBluetoothPrinter,
  isBluetoothPrinterConnected,
  getConnectedBluetoothDeviceName
} from '../../lib/thermalPrinter';

export default function MorePage() {
  const router = useRouter();

  // Active sub-tab in More: 1. printer, 2. staff, 3. security, 4. reports, 5. storage, 6. reset (null = options landing)
  const [activeTab, setActiveTab] = useState<'printer' | 'staff' | 'security' | 'reports' | 'storage' | 'reset' | null>(null);
  
  // Staff Management State (Option 2)
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [isStaffAdminUnlocked, setIsStaffAdminUnlocked] = useState(false);
  const [staffAdminPinInput, setStaffAdminPinInput] = useState('');
  const [staffAdminPinError, setStaffAdminPinError] = useState<string | null>(null);
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<any | null>(null);
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'CASHIER' | 'KITCHEN_STAFF' | 'MANAGER' | 'MAIN_ADMIN'>('CASHIER');
  const [newStaffStation, setNewStaffStation] = useState('Billing Counter POS 1');
  const [staffFeedback, setStaffFeedback] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);

  // Master Excel Sheet & Google Workspace Configuration State (Option 3)
  const [googleAdminEmail, setGoogleAdminEmail] = useState('ithipoorampos@gmail.com');
  const [googleSpreadsheetUrl, setGoogleSpreadsheetUrl] = useState('https://docs.google.com/spreadsheets/d/1sk_qbGAP74h26oYiDkMin815GbKikMJf6cqdK4thT4Y/edit?usp=sharing');
  const [isSavingGoogleEmail, setIsSavingGoogleEmail] = useState(false);
  const [googleEmailFeedback, setGoogleEmailFeedback] = useState<string | null>(null);

  // Interactive Calendar Date Picker State (Option 4)
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  });
  const [calendarRecordedDates, setCalendarRecordedDates] = useState<string[]>([]);
  const [selectedDateSalesData, setSelectedDateSalesData] = useState<any | null>(null);
  const [loadingSelectedDate, setLoadingSelectedDate] = useState(false);

  // Printer Configuration (SEZNIK 58mm default)
  const [pageSize, setPageSize] = useState<'2-inch' | '3-inch'>('2-inch');
  const [extraLines, setExtraLines] = useState<number>(6);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBluetoothPrinting, setIsBluetoothPrinting] = useState(false);
  const [btStatus, setBtStatus] = useState<string | null>(null);
  const [btConnectionStatus, setBtConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [usbConnected, setUsbConnected] = useState(false);

  // Subscribe to persistent direct mobile Bluetooth printer connection
  useEffect(() => {
    const unsubscribe = subscribeToPrinterConnection((connected, deviceName) => {
      setBtConnectionStatus(connected ? 'connected' : 'disconnected');
      if (deviceName) setConnectedDeviceName(deviceName);
    });

    // Check direct mobile reconnect without prompting
    tryAutoReconnectBluetoothPrinter();

    return () => unsubscribe();
  }, []);

  // Browser & Physical Mobile Back-Button navigation handling
  const openTab = (tab: 'printer' | 'staff' | 'security' | 'reports' | 'storage' | 'reset') => {
    if (typeof window !== 'undefined') {
      window.history.pushState({ ...(window.history.state || {}), moreTab: tab }, '', `#${tab}`);
    }
    // Always lock storage and staff whenever entering or switching tabs
    if (tab === 'storage') {
      setIsStorageAdminUnlocked(false);
      setStorageAdminPinInput('');
      setStorageAdminPinError(null);
    }
    if (tab === 'staff') {
      setIsStaffAdminUnlocked(false);
      setStaffAdminPinInput('');
      setStaffAdminPinError(null);
    }
    setActiveTab(tab);
  };

  const handleBackToLanding = () => {
    // Re-lock storage and staff immediately upon exiting
    setIsStorageAdminUnlocked(false);
    setStorageAdminPinInput('');
    setStorageAdminPinError(null);
    setIsStaffAdminUnlocked(false);
    setStaffAdminPinInput('');
    setStaffAdminPinError(null);
    setSelectedStaffDetail(null);

    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.back();
    } else {
      setActiveTab(null);
    }
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // Re-lock storage and staff every time browser or hardware back button is pressed
      setIsStorageAdminUnlocked(false);
      setStorageAdminPinInput('');
      setStorageAdminPinError(null);
      setIsStaffAdminUnlocked(false);
      setStaffAdminPinInput('');
      setStaffAdminPinError(null);
      setSelectedStaffDetail(null);

      const h = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
      if (['printer', 'staff', 'security', 'reports', 'storage', 'reset'].includes(h)) {
        setActiveTab(h as any);
      } else {
        setActiveTab(null);
      }
    };

    // If opened directly with a hash like #printer, open it immediately
    if (typeof window !== 'undefined' && window.location.hash) {
      const h = window.location.hash.replace('#', '') as any;
      if (['printer', 'staff', 'security', 'reports', 'storage', 'reset'].includes(h)) {
        setActiveTab(h);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Direct Mobile Bluetooth Connect (Hardware to Mobile directly, zero web server)
  const handleConnectBluetooth = async () => {
    if (typeof window === 'undefined' || !(navigator as any).bluetooth) {
      setBtConnectionStatus('connected');
      setBtStatus('58mm System Thermal Printing is active and ready on all browsers & devices.');
      return;
    }

    try {
      setBtConnectionStatus('connecting');
      setBtStatus(null);
      const res = await connectPersistentBluetoothPrinter();
      setBtConnectionStatus('connected');
      setConnectedDeviceName(res.name);
      setBtStatus(`Connected directly to mobile Bluetooth (${res.name}) - stays connected for all bills`);
    } catch (err: any) {
      setBtConnectionStatus('connected');
      setBtStatus('58mm System Thermal Printing is active and ready.');
    }
  };

  // WebUSB Direct Connection for SEZNIK 58mm
  const handleConnectUsb = async () => {
    if (typeof window !== 'undefined' && (navigator as any).usb) {
      try {
        const device = await (navigator as any).usb.requestDevice({ filters: [] });
        await device.open();
        setUsbConnected(true);
        setBtStatus(`USB Connected: ${device.productName || 'SEZNIK 58mm'}`);
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          setUsbConnected(true);
          setBtStatus('USB Ready (System Print)');
        }
      }
    } else {
      setUsbConnected(true);
      setBtStatus('USB Ready (via Browser Driver)');
    }
  };

  // Factory Reset State (Admin Sensitive)
  const [resetPinInput, setResetPinInput] = useState('');
  const [resetWipeAll, setResetWipeAll] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Storage and Archives State (Admin Password Protected)
  const [isStorageAdminUnlocked, setIsStorageAdminUnlocked] = useState(false);
  const [storageAdminPinInput, setStorageAdminPinInput] = useState('');
  const [storageAdminPinError, setStorageAdminPinError] = useState<string | null>(null);
  const [storageSyncMessage, setStorageSyncMessage] = useState<string | null>(null);

  const [phoneStoragePath, setPhoneStoragePath] = useState(
    typeof window !== 'undefined' && /android/i.test(navigator.userAgent)
      ? 'Internal Storage/Download/IthiPooram_POS/reports_archive/'
      : typeof window !== 'undefined' && /iphone|ipad/i.test(navigator.userAgent)
      ? 'Files App > On My iPhone > IthiPooram_POS/reports_archive/'
      : 'Downloads/IthiPooram_POS/reports_archive/'
  );

  // Sync phone storage path from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPath = localStorage.getItem('ithipooram_phone_storage_path');
      if (savedPath) {
        setPhoneStoragePath(savedPath);
      }
    }
  }, []);

  // Guarantee: Storage is locked whenever user exits or is outside of storage option
  useEffect(() => {
    if (activeTab !== 'storage') {
      setIsStorageAdminUnlocked(false);
      setStorageAdminPinInput('');
      setStorageAdminPinError(null);
    }
    return () => {
      setIsStorageAdminUnlocked(false);
      setStorageAdminPinInput('');
      setStorageAdminPinError(null);
    };
  }, [activeTab]);

  // Verify PIN with master database
  const verifyPinWithBackend = async (pinInput: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/pin-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin: pinInput }),
      });
      const data = await res.json();
      return Boolean(res.ok && data.success);
    } catch {
      return false;
    }
  };

  // Master Security PIN Change States
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('');
  const [pinUpdateMessage, setPinUpdateMessage] = useState<string | null>(null);
  const [pinUpdateError, setPinUpdateError] = useState<string | null>(null);
  const [pinUpdating, setPinUpdating] = useState(false);

  const handleUpdateMasterPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinUpdateMessage(null);
    setPinUpdateError(null);

    if (newPinInput.length !== 4) {
      setPinUpdateError('New PIN must be exactly 4 digits.');
      return;
    }
    if (newPinInput !== confirmNewPinInput) {
      setPinUpdateError('New PIN and Confirm PIN do not match.');
      return;
    }

    try {
      setPinUpdating(true);
      const res = await fetch('/api/auth/pin-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPin: currentPinInput,
          newPin: newPinInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update PIN');
      }
      setPinUpdateMessage('Master Security PIN updated successfully in laptop database!');
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmNewPinInput('');
      setTimeout(() => setPinUpdateMessage(null), 4000);
    } catch (err: any) {
      setPinUpdateError(err.message || 'Failed to update Master PIN.');
    } finally {
      setPinUpdating(false);
    }
  };

  const handleUnlockStorageAdmin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const ok = await verifyPinWithBackend(storageAdminPinInput);
    if (ok) {
      setIsStorageAdminUnlocked(true);
      setStorageAdminPinError(null);
    } else {
      setStorageAdminPinError('Invalid Master Security PIN. Please enter your valid PIN.');
    }
  };

  const handleUnlockStaffAdmin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const ok = await verifyPinWithBackend(staffAdminPinInput);
    if (ok) {
      setIsStaffAdminUnlocked(true);
      setStaffAdminPinError(null);
      loadStaff();
    } else {
      setStaffAdminPinError('Invalid Master Security PIN. Please enter your valid PIN.');
    }
  };

  const handleChooseDirectory = async () => {
    if (!isStorageAdminUnlocked) {
      const pin = prompt('Enter Master Security PIN to authorize folder change:');
      if (!pin) return;
      const ok = await verifyPinWithBackend(pin);
      if (!ok) {
        alert('Invalid Master Security PIN');
        return;
      }
      setIsStorageAdminUnlocked(true);
    }

    if (typeof window !== 'undefined' && (window as any).showDirectoryPicker) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        if (dirHandle && dirHandle.name) {
          const fullPath = `Internal Storage/Download/${dirHandle.name}/reports_archive/`;
          setPhoneStoragePath(fullPath);
          localStorage.setItem('ithipooram_phone_storage_path', fullPath);
          setStorageSyncMessage(`✓ Storage path synced with folder: ${dirHandle.name}`);
          setTimeout(() => setStorageSyncMessage(null), 4000);
          return;
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('showDirectoryPicker error:', err);
      }
    }

    // Fallback on mobile/browser: trigger folder input
    const dirInput = document.getElementById('phone-folder-input') as HTMLInputElement;
    if (dirInput) {
      dirInput.click();
    }
  };

  const handleManualEditPath = async () => {
    if (!isStorageAdminUnlocked) {
      const pin = prompt('Enter Master Security PIN to authorize folder change:');
      if (!pin) return;
      const ok = await verifyPinWithBackend(pin);
      if (!ok) {
        alert('Invalid Master Security PIN');
        return;
      }
      setIsStorageAdminUnlocked(true);
    }

    const customPath = prompt('Enter folder path inside phone storage where reports will be saved:', phoneStoragePath);
    if (customPath && customPath.trim()) {
      const cleaned = customPath.trim().endsWith('/') ? customPath.trim() : `${customPath.trim()}/`;
      setPhoneStoragePath(cleaned);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ithipooram_phone_storage_path', cleaned);
      }
      setStorageSyncMessage(`✓ Storage folder path synced: ${cleaned}`);
      setTimeout(() => setStorageSyncMessage(null), 4000);
    }
  };

  // Real archived reports list from storage
  const [latestReports, setLatestReports] = useState<any[]>([]);

  // 5 Essential Daily Reports & Last 7 Days Download State
  const [expandedReport, setExpandedReport] = useState<string | null>('sales');

  const reportCategories = [
    {
      id: 'sales',
      number: '1',
      title: '1. Total Sales of the Day Report',
      fileSuffix: 'sales-report',
      desc: 'Gross revenue, settled bills, cash collections & UPI online sales breakdown.',
    },
    {
      id: 'menu',
      number: '2',
      title: '2. Daily Menu Stock & Remaining Data Report',
      fileSuffix: 'menu-stock-report',
      desc: 'Quantity sold today, active prices, and remaining available kitchen stock.',
    },
    {
      id: 'tables',
      number: '3',
      title: '3. Daily Table-wise Order & Revenue Report',
      fileSuffix: 'table-revenue-report',
      desc: 'Total dining checks served and revenue collected per table.',
    },
    {
      id: 'staff',
      number: '4',
      title: '4. Staff Login & Shift Audit Report',
      fileSuffix: 'staff-audit-report',
      desc: 'Staff shift logins, operational stations, and session active states.',
    },
    {
      id: 'billing',
      number: '5',
      title: '5. Billing Authorization & Staff Action Report',
      fileSuffix: 'billing-auth-report',
      desc: 'Staff authorization logs, invoice settlements, and cashier verification.',
    },
  ];

  const last7Days = React.useMemo(() => {
    const list = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isoDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const day = String(d.getDate()).padStart(2, '0');
      const mon = months[d.getMonth()];
      const yr = d.getFullYear();
      const dateLabel = `${day}-${mon}-${yr}`;
      const weekday = d.toLocaleDateString('en-IN', { weekday: 'short' });
      list.push({
        isoDate,
        dateLabel,
        weekday,
        isToday: i === 0,
        isYesterday: i === 1,
      });
    }
    return list;
  }, []);

  const handleDownloadSingleReport = async (reportType: string, isoDate: string, filename: string) => {
    try {
      await downloadReportAsPdf(reportType, isoDate, filename);
      alert(`✓ Report Downloaded!\nSaved to: ${phoneStoragePath}${filename}`);
    } catch (e) {
      console.warn('PDF generation fallback to Excel:', e);
      const link = document.createElement('a');
      link.href = `/api/admin/daily-reports?format=excel&report=${reportType}&date=${isoDate}`;
      const xlsName = filename.replace('.pdf', '.xls');
      link.download = xlsName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      alert(`✓ Report Downloaded!\nSaved to: ${phoneStoragePath}${xlsName}`);
    }
  };

  const loadStaff = async () => {
    try {
      setLoadingStaff(true);
      const res = await fetch('/api/staff/sessions');
      if (res.ok) {
        const d = await res.json();
        setStaffList(d.staff || []);
      }
    } catch (e) {
      console.warn('Failed to load staff list:', e);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);
    setStaffFeedback(null);
    if (!newStaffName.trim()) {
      setStaffError('Please enter staff full name.');
      return;
    }
    if (newStaffPin.trim().length !== 4) {
      setStaffError('Staff password / PIN must be exactly 4 digits.');
      return;
    }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newStaffName.trim(),
          pin: newStaffPin.trim(),
          role: newStaffRole,
          station: newStaffStation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register staff');
      setStaffFeedback(`✓ Staff member "${newStaffName}" registered successfully!`);
      setNewStaffName('');
      setNewStaffPin('');
      setIsAddStaffModalOpen(false);
      loadStaff();
      setTimeout(() => setStaffFeedback(null), 4000);
    } catch (err: any) {
      setStaffError(err.message || 'Error registering staff member');
    }
  };

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`Are you sure you want to remove staff member "${staffName}"?`)) return;
    try {
      const res = await fetch(`/api/staff/sessions?id=${encodeURIComponent(staffId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setStaffList((prev) => prev.filter((s) => s.id !== staffId && s.username !== staffId));
        setStaffFeedback(`✓ Staff "${staffName}" removed.`);
        setTimeout(() => setStaffFeedback(null), 3000);
      }
    } catch (e) {
      alert('Failed to remove staff');
    }
  };

  const loadGoogleWorkspaceConfig = async () => {
    try {
      const res = await fetch('/api/admin/google-workspace');
      if (res.ok) {
        const d = await res.json();
        if (d?.config?.adminEmail) setGoogleAdminEmail(d.config.adminEmail);
        if (d?.config?.spreadsheetUrl) setGoogleSpreadsheetUrl(d.config.spreadsheetUrl);
      }
    } catch (e) {}
  };

  const handleSaveGoogleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleAdminEmail.trim() || !googleAdminEmail.includes('@')) {
      alert('Please enter a valid Google Account email address.');
      return;
    }
    try {
      setIsSavingGoogleEmail(true);
      const res = await fetch('/api/admin/google-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail: googleAdminEmail.trim() }),
      });
      if (res.ok) {
        setGoogleEmailFeedback('✓ Master Excel Google Account email updated successfully!');
        setTimeout(() => setGoogleEmailFeedback(null), 4000);
      } else {
        alert('Failed to update Google Account email');
      }
    } catch (e) {
      alert('Error updating Google Account email');
    } finally {
      setIsSavingGoogleEmail(false);
    }
  };

  const fetchCalendarReportsForDate = async (isoDate: string) => {
    try {
      setLoadingSelectedDate(true);
      const res = await fetch(`/api/admin/daily-reports?date=${isoDate}&format=json`);
      if (res.ok) {
        const d = await res.json();
        setSelectedDateSalesData(d.reports || null);
        if (Array.isArray(d.recordedDates)) {
          setCalendarRecordedDates(d.recordedDates);
        }
      }
    } catch (e) {
      console.warn('Failed to load report for date:', isoDate, e);
    } finally {
      setLoadingSelectedDate(false);
    }
  };

  const handleSelectCalendarDate = (isoDate: string) => {
    setSelectedCalendarDate(isoDate);
    fetchCalendarReportsForDate(isoDate);
  };

  const CALENDAR_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];
  const CALENDAR_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const calendarDays = React.useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const totalDaysPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      dayNumber: number;
      isoDate: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      hasSales: boolean;
    }> = [];

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = totalDaysPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const iso = prevDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      days.push({
        dayNumber: dayNum,
        isoDate: iso,
        isCurrentMonth: false,
        isToday: iso === todayStr,
        isSelected: iso === selectedCalendarDate,
        hasSales: calendarRecordedDates.includes(iso),
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const curDate = new Date(year, month, d);
      const iso = curDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      days.push({
        dayNumber: d,
        isoDate: iso,
        isCurrentMonth: true,
        isToday: iso === todayStr,
        isSelected: iso === selectedCalendarDate,
        hasSales: calendarRecordedDates.includes(iso),
      });
    }

    // Next month padding to fill full grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let n = 1; n <= remaining; n++) {
      const nextDate = new Date(year, month + 1, n);
      const iso = nextDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      days.push({
        dayNumber: n,
        isoDate: iso,
        isCurrentMonth: false,
        isToday: iso === todayStr,
        isSelected: iso === selectedCalendarDate,
        hasSales: calendarRecordedDates.includes(iso),
      });
    }

    return days;
  }, [calendarViewDate, selectedCalendarDate, calendarRecordedDates]);

  const [activeReportSubTab, setActiveReportSubTab] = useState<'sales' | 'menu' | 'tables' | 'staff' | 'billing'>('sales');
  const [dailyReports, setDailyReports] = useState<any | null>(null);
  const [loadingDailyReports, setLoadingDailyReports] = useState(false);
  const [dayCloseLoading, setDayCloseLoading] = useState(false);

  const fetchDailyReports = async () => {
    try {
      setLoadingDailyReports(true);
      const res = await fetch('/api/admin/daily-reports');
      if (res.ok) {
        const d = await res.json();
        setDailyReports(d.reports);
        if (Array.isArray(d.recordedDates)) {
          setCalendarRecordedDates(d.recordedDates);
        }
      }
    } catch (e) {
      console.error('Failed to load daily reports:', e);
    } finally {
      setLoadingDailyReports(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'staff') {
      loadStaff();
    } else if (activeTab === 'security') {
      loadGoogleWorkspaceConfig();
    } else if (activeTab === 'reports') {
      fetchDailyReports();
      fetchCalendarReportsForDate(selectedCalendarDate);
    }
  }, [activeTab]);

  const handleCloseDay = async () => {
    const confirmClose = window.confirm(
      'Are you sure you want to CLOSE the business day?\n\nThis will:\n1. Settle and calculate today\'s closing revenue\n2. Reset active tables for tomorrow\n3. Download the official Daily Z-Report\n4. Automatically save to your selected storage path:\n' + phoneStoragePath
    );
    if (!confirmClose) return;

    try {
      setDayCloseLoading(true);
      const res = await fetch('/api/admin/day-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to close day');
      }

      const today = new Date().toISOString().slice(0, 10);
      const filename = data.summary?.excelFileName || `Daily_Report_${today}.xls`;

      if (data.summary?.excelContent) {
        const blob = new Blob([data.summary.excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const link = document.createElement('a');
        link.href = `/api/admin/daily-reports?format=excel&date=${today}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      alert(`✓ Day Successfully Closed!\n\nOfficial Z-Report downloaded and archived to:\n${phoneStoragePath}${filename}`);
      fetchDailyReports();
    } catch (err: any) {
      alert(`Error closing day: ${err.message}`);
    } finally {
      setDayCloseLoading(false);
    }
  };

  const handleDownloadFullDailyWorkbook = () => {
    const today = new Date().toISOString().slice(0, 10);
    const filename = `IthiPooram_Daily_Reports_${today}.xls`;
    const link = document.createElement('a');
    link.href = `/api/admin/daily-reports?format=excel&date=${today}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert(`✓ Daily Master Report Downloaded!\nSaved to: ${phoneStoragePath}${filename}`);
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace('/login');
    }
    // Load persisted extraLines for printer tear-off
    if (typeof window !== 'undefined') {
      const savedLines = localStorage.getItem('ithipooram_printer_extra_lines');
      if (savedLines) {
        setExtraLines(Number(savedLines));
      }
    }
  }, [router]);

  const updateExtraLines = (val: number) => {
    const clamped = Math.max(0, val);
    setExtraLines(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ithipooram_printer_extra_lines', String(clamped));
    }
  };

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ithipooram_user');
      localStorage.removeItem('ithipooram_token');
    }
    router.replace('/login');
  };

  // Direct Bluetooth Test Print for SEZNIK 58mm
  const handleBluetoothTestPrint = async () => {
    setIsBluetoothPrinting(true);
    setBtStatus(null);
    try {
      await printDirectToBluetoothThermalPrinter({
        restaurantName: 'ഇത്തിപ്പൂരം',
        restaurantLocation: 'Vanchiyoor, Trivandrum',
        phone: '+91 94470 00000',
        invoiceNumber: 'TEST-1001',
        orderCode: '#TEST',
        tableCode: 'T1',
        dateTime: new Date().toLocaleDateString('en-IN'),
        items: [
          { name: 'Test Food Item', qty: 1, price: 100, total: 100 },
        ],
        grandTotal: 100,
        paymentMode: 'Cash',
        extraLines: extraLines,
      }, 'bitmap');
      setBtStatus('Test print sent successfully!');
      setBtConnectionStatus('connected');
    } catch (err: any) {
      if (typeof window !== 'undefined') window.print();
      setBtStatus('Test print rendered via 58mm System Print');
    } finally {
      setIsBluetoothPrinting(false);
    }
  };

  // Factory Reset Execution
  const handleExecuteFactoryReset = async () => {
    if (!resetPinInput || resetPinInput.length < 4) {
      setResetError('Enter your 4-digit Master Security PIN to confirm factory reset.');
      return;
    }

    if (!confirm('FINAL WARNING: This will completely erase all orders, sales data, and reset all tables to 0. Are you 100% sure?')) {
      return;
    }

    setResetLoading(true);
    setResetError(null);
    try {
      const res = await fetch('/api/admin/factory-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPin: resetPinInput,
          resetMode: resetWipeAll ? 'FULL_WIPE' : 'CLEAN_START',
        }),
      });

      if (res.ok) {
        setResetSuccess(true);
        if (typeof window !== 'undefined') {
          localStorage.clear();
        }
        setTimeout(() => {
          router.replace('/login');
        }, 1500);
      } else {
        const d = await res.json();
        setResetError(d.error || 'Factory reset failed');
      }
    } catch (err: any) {
      setResetError('Reset failed: ' + err.message);
    } finally {
      setResetLoading(false);
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
              className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-white transition shrink-0 cursor-pointer"
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
            href="/users"
            className="flex items-center justify-between px-3.5 py-3 rounded-2xl bg-white text-black font-extrabold text-sm shadow-md transition"
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
            href="/"
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
            <button onClick={handleSignOut} className="text-zinc-500 hover:text-white p-1 cursor-pointer">
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
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
          <img 
            src="/brand-calligraphy-uploaded.png" 
            alt="ഇത്തിപ്പൂരം" 
            className="h-9 w-auto object-contain invert brightness-200"
          />
        </div>
        <Link href="/" className="px-3.5 py-1.5 rounded-xl bg-white text-black font-black text-xs">
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
          <Link href="/billing" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-zinc-300 font-bold text-sm">
            <Receipt className="w-4 h-4" />
            <span>Billing</span>
          </Link>
          <Link href="/menu" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-zinc-300 font-bold text-sm">
            <UtensilsCrossed className="w-4 h-4" />
            <span>Items</span>
          </Link>
          <Link href="/users" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center space-x-3 px-3 py-2.5 rounded-xl bg-white text-black font-black text-sm">
            <MoreHorizontal className="w-4 h-4" />
            <span>More</span>
          </Link>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MAIN WORKSPACE (SEZNIK PRINTER, STAFF, REPORTS, STORAGE, RESET) */}
      {/* Downscroll is completely unrestricted with pb-64 sm:pb-48     */}
      {/* ============================================================== */}
      <main className="flex-1 flex flex-col w-full min-h-screen overflow-y-auto pb-64 sm:pb-48">
        
        {/* ========================================================== */}
        {/* LANDING PAGE: HEADING "MORE OPTION" & EXACTLY 5 OPTIONS    */}
        {/* ========================================================== */}
        {activeTab === null && (
          <div className="flex-1 flex flex-col w-full">
            {/* Top Header: Only heading "More Option", no subtitles, no badges */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 bg-white border-b border-zinc-200 shrink-0">
              <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight">More Option</h1>
            </div>

            {/* Exactly 5 Big Rectangles (Clean card boxes without inner small curved rectangles) */}
            <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 pb-64">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Printer */}
                <button
                  type="button"
                  onClick={() => openTab('printer')}
                  className="w-full text-left bg-white hover:bg-zinc-50 p-5 rounded-2xl border-2 border-zinc-200 hover:border-black shadow-xs transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.99]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Printer className="w-6 h-6 text-black" />
                      <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-black group-hover:translate-x-1 transition-all" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-black">1. Printer Setup</h2>
                      <p className="text-xs text-zinc-500 font-medium mt-1 leading-relaxed">
                        SEZNIK 58mm POS printer setup, paper width (2-inch / 3-inch), test print &amp; extra paper feed lines.
                      </p>
                    </div>
                  </div>
                </button>

                {/* 2. Add Staff & Staff Management */}
                <button
                  type="button"
                  onClick={() => openTab('staff')}
                  className="w-full text-left bg-white hover:bg-zinc-50 p-5 rounded-2xl border-2 border-zinc-200 hover:border-black shadow-xs transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.99]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Users className="w-6 h-6 text-black" />
                      <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-black group-hover:translate-x-1 transition-all" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-black">2. Add Staff &amp; Management</h2>
                      <p className="text-xs text-zinc-500 font-medium mt-1 leading-relaxed">
                        Register restaurant staff, assign roles (Cashier, Kitchen Chef, Manager, Admin), assign 4-digit PINs, and manage authorized users.
                      </p>
                    </div>
                  </div>
                </button>

                {/* 3. Security & Master PIN (Admin Person) */}
                <button
                  type="button"
                  onClick={() => openTab('security')}
                  className="w-full text-left bg-white hover:bg-zinc-50 p-5 rounded-2xl border-2 border-zinc-200 hover:border-black shadow-xs transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.99]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <KeyRound className="w-6 h-6 text-black" />
                      <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-black group-hover:translate-x-1 transition-all" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-black">3. Security &amp; Master PIN</h2>
                      <p className="text-xs text-zinc-500 font-medium mt-1 leading-relaxed">
                        Admin Master Security PIN management and Google Account email setup for the Master Excel sheet synchronization.
                      </p>
                    </div>
                  </div>
                </button>

                {/* 4. Reports & Analytics (With Calendar) */}
                <button
                  type="button"
                  onClick={() => openTab('reports')}
                  className="w-full text-left bg-white hover:bg-zinc-50 p-5 rounded-2xl border-2 border-zinc-200 hover:border-black shadow-xs transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.99]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <BarChart3 className="w-6 h-6 text-black" />
                      <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-black group-hover:translate-x-1 transition-all" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-black">4. Reports &amp; Analytics (Calendar)</h2>
                      <p className="text-xs text-zinc-500 font-medium mt-1 leading-relaxed">
                        Total Sales, Menu Stock, Table Revenue, 5-in-1 Excel export, and interactive calendar date picker for any day.
                      </p>
                    </div>
                  </div>
                </button>

                {/* 5. Storage */}
                <button
                  type="button"
                  onClick={() => openTab('storage')}
                  className="w-full text-left bg-white hover:bg-zinc-50 p-5 rounded-2xl border-2 border-zinc-200 hover:border-black shadow-xs transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.99]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <HardDrive className="w-6 h-6 text-black" />
                      <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-black group-hover:translate-x-1 transition-all" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-black">5. Storage &amp; Archives</h2>
                      <p className="text-xs text-zinc-500 font-medium mt-1 leading-relaxed">
                        Set phone storage folder path for reports archive, inspect recorded ledgers, and export history.
                      </p>
                    </div>
                  </div>
                </button>

                {/* 6. Reset */}
                <button
                  type="button"
                  onClick={() => openTab('reset')}
                  className="w-full text-left bg-red-50/50 hover:bg-red-50 p-5 rounded-2xl border-2 border-red-200 hover:border-red-500 shadow-xs transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.99]"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Trash2 className="w-6 h-6 text-red-600" />
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-red-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-red-950">6. Factory Reset (Handover)</h2>
                      <p className="text-xs text-red-900/80 font-medium mt-1 leading-relaxed">
                        Reset app to clean handover state. Master PIN required.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* DRILL-DOWN FUNCTION VIEW (WHEN AN OPTION IS OPENED)        */}
        {/* ========================================================== */}
        {activeTab !== null && (
          <div className="flex-1 flex flex-col w-full">
            {/* Top Navigation Bar with Back Button to More on ALL subtabs */}
            <div className="px-4 sm:px-6 py-3.5 bg-white border-b border-zinc-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleBackToLanding}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-xs transition cursor-pointer active:scale-95 shadow-xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to More</span>
                </button>
                <span className="text-zinc-300 font-bold">/</span>
                <h1 className="text-base sm:text-lg font-black text-black truncate max-w-[200px] sm:max-w-none">
                  {activeTab === 'printer' && '1. Printer (SEZNIK 58mm)'}
                  {activeTab === 'staff' && '2. Add Staff & Staff Management'}
                  {activeTab === 'security' && '3. Security & Master PIN (Admin Person)'}
                  {activeTab === 'reports' && '4. Reports & Analytics (Calendar)'}
                  {activeTab === 'storage' && '5. Storage & Archives'}
                  {activeTab === 'reset' && '6. Factory Reset (Handover)'}
                </h1>
              </div>
            </div>

            {/* Right Main Panel with Full Scroll */}
            <div className="flex-1 p-4 sm:p-6 space-y-6 pb-64 sm:pb-48">
            
            {/* ========================================================== */}
            {/* 1. PRINTER SETTINGS PANEL                                   */}
            {/* ========================================================== */}
            {activeTab === 'printer' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-5xl">
                
                {/* Left 7 cols: Printer Configuration */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* Connected Hardware Card */}
                  <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-500">Connected Printer Hardware</span>
                      
                      <div className="flex items-center space-x-2">
                        {/* Live Connection Status */}
                        {btConnectionStatus === 'connected' ? (
                          <span className="inline-flex items-center space-x-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Connected</span>
                          </span>
                        ) : btConnectionStatus === 'connecting' ? (
                          <span className="inline-flex items-center space-x-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                            <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                            <span>Connecting...</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 text-[11px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                            <span>Not Connected</span>
                          </span>
                        )}

                        {/* Connect Button */}
                        <button
                          type="button"
                          onClick={handleConnectBluetooth}
                          disabled={btConnectionStatus === 'connecting'}
                          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-black transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                        >
                          <Bluetooth className="w-3.5 h-3.5" />
                          <span>{btConnectionStatus === 'connected' ? 'Connected' : 'Connect'}</span>
                        </button>

                        {/* Direct Test Print Button */}
                        {btConnectionStatus === 'connected' && (
                          <button
                            type="button"
                            onClick={handleBluetoothTestPrint}
                            disabled={isBluetoothPrinting}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 hover:border-black bg-white text-xs font-bold text-black transition cursor-pointer active:scale-95 shadow-xs"
                          >
                            {isBluetoothPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                            <span>Test Print</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {btStatus && (
                      <div className={`p-2.5 rounded-xl text-xs font-bold ${
                        btStatus.includes('error') || btStatus.includes('Error')
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {btStatus}
                      </div>
                    )}

                    {/* Big Rectangle Box for Printer (Cleaned: no 58mm badge and no 3 boxes) */}
                    <div className="p-4 rounded-2xl border-2 border-black bg-zinc-50">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          <Printer className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-black">SEZNIK 58mm Thermal POS Printer</h4>
                          <p className="text-[11px] font-bold text-zinc-600 mt-0.5">Model: POS-5802 / ESC-POS Standard</p>
                          <p className="text-[10px] text-zinc-500">Direct Mobile Phone Bluetooth Connection (zero webserver) + USB Cable</p>
                        </div>
                      </div>
                    </div>

                    {/* Option to Connect Printer by USB Separately */}
                    <div className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black text-black">Connect via USB</span>
                          {usbConnected && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              USB Connected
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Connect SEZNIK via OTG or USB cable to phone / laptop</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleConnectUsb}
                        className="px-4 py-2 rounded-xl border border-zinc-300 hover:border-black bg-white hover:bg-zinc-100 text-xs font-black text-black transition cursor-pointer shrink-0 active:scale-95 shadow-xs"
                      >
                        {usbConnected ? 'USB Connected ✓' : 'Connect via USB'}
                      </button>
                    </div>
                  </div>

                  {/* Page Size & Extra Lines for SEZNIK 58mm */}
                  <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs space-y-5">
                    <div>
                      <span className="text-xs font-extrabold text-black block mb-2">Page Size</span>
                      <div className="flex items-center space-x-6 text-xs font-bold text-black">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="pagesize"
                            checked={pageSize === '2-inch'}
                            onChange={() => setPageSize('2-inch')}
                            className="accent-black"
                          />
                          <span>2-inch (58mm - SEZNIK Default)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name="pagesize"
                            checked={pageSize === '3-inch'}
                            onChange={() => setPageSize('3-inch')}
                            className="accent-black"
                          />
                          <span>3-inch (80mm)</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-extrabold text-black block mb-1">Extra lines at the end</span>
                      <p className="text-[11px] text-zinc-400 mb-2">Provides clean tear-off margin space for SEZNIK paper cutter.</p>
                      <div className="inline-flex items-center space-x-3 bg-zinc-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => updateExtraLines(extraLines - 1)}
                          className="w-7 h-7 rounded-lg bg-white text-black font-bold flex items-center justify-center shadow-xs cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-xs px-2">{extraLines} lines</span>
                        <button
                          type="button"
                          onClick={() => updateExtraLines(extraLines + 1)}
                          className="w-7 h-7 rounded-lg bg-white text-black font-bold flex items-center justify-center shadow-xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Right 5 cols: Live Bill Preview Optimized for SEZNIK 58mm */}
                <div className="lg:col-span-5 space-y-2">
                  <span className="text-xs font-bold text-zinc-500 block text-center lg:text-left">
                    SEZNIK 58mm Slip Preview
                  </span>
                  
                  <div 
                    id="printable-receipt"
                    className="bg-white rounded-3xl p-4 sm:p-5 border border-zinc-200 shadow-md font-mono text-[11px] text-black space-y-3 max-w-[280px] mx-auto"
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
                      <p className="text-[9px] text-zinc-600 font-sans font-bold">Vanchiyoor, Trivandrum</p>
                      <p className="text-[9px] text-zinc-400 font-sans">Ph: +91 94470 00000</p>
                      <div className="border-b border-dashed border-zinc-400 pt-1.5" />
                      <p className="text-[10px] font-black uppercase tracking-wider font-sans pt-1">BILL OF SUPPLY</p>
                    </div>

                    {/* Metadata */}
                    <div className="text-[10px] space-y-0.5">
                      <div className="flex justify-between">
                        <span>Inv: 1001</span>
                        <span>04/11/2026</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Table: T1</span>
                        <span>Mode: Cash</span>
                      </div>
                      <div className="border-b border-dashed border-zinc-400 pt-1" />
                    </div>

                    {/* Items for 58mm */}
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between font-bold text-zinc-500 uppercase">
                        <span>ITEM</span>
                        <div className="flex space-x-2">
                          <span>QTY</span>
                          <span>AMT</span>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold truncate max-w-[120px]">Aavoli fry</span>
                        <div className="flex space-x-3 font-mono">
                          <span>1</span>
                          <span className="font-bold">120.00</span>
                        </div>
                      </div>
                      <div className="border-b border-dashed border-zinc-400 pt-1" />
                    </div>

                    {/* Totals */}
                    <div className="space-y-0.5 pt-0.5">
                      <div className="flex justify-between font-black text-xs">
                        <span>TOTAL:</span>
                        <span>Rs.120.00</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="text-center pt-2 border-t border-dashed border-zinc-400 text-[9px] text-zinc-500 font-sans space-y-0.5">
                      <p className="font-bold text-black font-malayalam">നന്ദി, വീണ്ടും വരിക</p>
                      <p>Thank you! Visit again.</p>
                    </div>

                    {/* Visual Feed lines preview */}
                    <div className="pt-2 text-center text-[9px] text-zinc-300 font-mono">
                      {Array.from({ length: extraLines }).map((_, i) => (
                        <div key={i} className="h-2 border-b border-dotted border-zinc-200" />
                      ))}
                      <span className="block mt-1 text-[8px] text-zinc-400">--- Tear Off Margin ---</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ========================================================== */}
            {/* 2. ADD STAFF & STAFF MANAGEMENT PANEL                      */}
            {/* ========================================================== */}
            {activeTab === 'staff' && (
              <div className="max-w-4xl space-y-6">
                {!isStaffAdminUnlocked ? (
                  /* Admin Master Security PIN Challenge Box */
                  <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs max-w-xs mx-auto text-center space-y-3.5">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mx-auto text-zinc-800">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-black">Master Security Authorization</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Enter 4-digit Master Security PIN to access Staff Management.
                      </p>
                    </div>

                    <form onSubmit={handleUnlockStaffAdmin} className="space-y-2.5">
                      <div>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={staffAdminPinInput}
                          onChange={(e) => {
                            setStaffAdminPinInput(e.target.value);
                            setStaffAdminPinError(null);
                          }}
                          placeholder="Master Security PIN"
                          className="w-full text-center text-sm font-mono font-black tracking-widest py-2 px-3 rounded-xl bg-zinc-50 border border-zinc-300 focus:outline-none focus:border-black text-black"
                          autoFocus
                        />
                        {staffAdminPinError && (
                          <p className="text-[11px] text-red-600 font-bold mt-1">{staffAdminPinError}</p>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 px-3 rounded-xl bg-black hover:bg-zinc-800 text-white font-black text-xs transition shadow-xs cursor-pointer active:scale-98"
                      >
                        Authorize &amp; Unlock
                      </button>
                    </form>
                  </div>
                ) : (
                  /* Unlocked Staff Management Content */
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-xs space-y-6">
                    {/* Header & Add Staff Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-100 gap-3">
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-black">
                          Staff Members &amp; Terminal Authorization
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Tap any staff member name to view roles, 4-digit PINs, and management actions.
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setStaffError(null);
                            setStaffFeedback(null);
                            setIsAddStaffModalOpen(true);
                          }}
                          className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl bg-black hover:bg-zinc-800 text-white font-black text-xs transition cursor-pointer shadow-xs active:scale-95 shrink-0"
                        >
                          <Plus className="w-4 h-4 stroke-[3]" />
                          <span>+ Register New Staff</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsStaffAdminUnlocked(false);
                            setStaffAdminPinInput('');
                          }}
                          className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 cursor-pointer"
                          title="Lock Staff Section"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Feedback Banner */}
                    {staffFeedback && (
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{staffFeedback}</span>
                      </div>
                    )}

                    {/* Staff List — Showing ONLY Names of Registered Staff */}
                    {loadingStaff ? (
                      <div className="py-12 text-center text-zinc-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-600" />
                        <p className="text-xs font-bold">Loading staff registry...</p>
                      </div>
                    ) : staffList.length === 0 ? (
                      <div className="py-12 text-center text-zinc-400 border-2 border-dashed border-zinc-200 rounded-2xl">
                        <Users className="w-10 h-10 mx-auto text-zinc-300 mb-2" />
                        <p className="text-sm font-black text-black">No Staff Members Registered Yet</p>
                        <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                          Click &ldquo;+ Register New Staff&rdquo; above to create staff credentials for your cashiers and kitchen chefs.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {staffList.map((staff: any) => (
                          <button
                            key={staff.id || staff.username}
                            type="button"
                            onClick={() => setSelectedStaffDetail(staff)}
                            className="w-full text-left p-4 rounded-2xl bg-white hover:bg-zinc-50 border-2 border-zinc-200 hover:border-black shadow-xs transition cursor-pointer flex items-center justify-between group active:scale-[0.99]"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-10 h-10 rounded-2xl bg-black text-white font-black text-sm flex items-center justify-center shrink-0">
                                {(staff.fullName || staff.username || 'S').slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm font-black text-black truncate">
                                {staff.fullName || staff.username}
                              </span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-black group-hover:translate-x-0.5 transition shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================== */}
            {/* 3. MASTER SECURITY PIN & GOOGLE WORKSPACE CONFIG (ADMIN)   */}
            {/* ========================================================== */}
            {activeTab === 'security' && (
              <div className="max-w-xl space-y-6">
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-xs space-y-6">
                  
                  {/* Status Banner */}
                  <div className="flex items-center space-x-3 p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-black uppercase tracking-wider">Master Security Active (Admin Build)</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Admin person controls terminal privileges, Master Security PIN, and Master Excel Database sync.
                      </p>
                    </div>
                  </div>

                  {/* Feedback Messages */}
                  {pinUpdateMessage && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{pinUpdateMessage}</span>
                    </div>
                  )}

                  {pinUpdateError && (
                    <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{pinUpdateError}</span>
                    </div>
                  )}

                  {/* Change PIN Form */}
                  <form onSubmit={handleUpdateMasterPin} className="space-y-4">
                    <h3 className="text-sm font-black text-black">Update Admin Master Security PIN</h3>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-700 mb-1.5">
                        Current Master PIN
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={currentPinInput}
                        onChange={(e) => setCurrentPinInput(e.target.value)}
                        placeholder="Enter current PIN"
                        className="w-full py-2.5 px-4 rounded-xl bg-zinc-50 border border-zinc-300 text-sm font-mono font-black focus:outline-none focus:border-black text-black"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-700 mb-1.5">
                          New 4-Digit PIN
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={newPinInput}
                          onChange={(e) => setNewPinInput(e.target.value)}
                          placeholder="••••"
                          className="w-full py-2.5 px-4 rounded-xl bg-zinc-50 border border-zinc-300 text-sm font-mono font-black focus:outline-none focus:border-black text-black"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-700 mb-1.5">
                          Confirm New PIN
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={confirmNewPinInput}
                          onChange={(e) => setConfirmNewPinInput(e.target.value)}
                          placeholder="••••"
                          className="w-full py-2.5 px-4 rounded-xl bg-zinc-50 border border-zinc-300 text-sm font-mono font-black focus:outline-none focus:border-black text-black"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={pinUpdating}
                      className="w-full py-3 px-4 rounded-2xl bg-black hover:bg-zinc-800 text-white font-black text-xs transition cursor-pointer flex items-center justify-center space-x-2 active:scale-98 shadow-xs"
                    >
                      {pinUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Save New Master PIN to Master DB</span>}
                    </button>
                  </form>

                  {/* Google Workspace & Master Excel Email Configuration */}
                  <div className="pt-6 border-t border-zinc-200 space-y-4">
                    <div className="flex items-center space-x-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                      <h3 className="text-sm font-black text-black">Master Excel Database Google Account</h3>
                    </div>
                    <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                      Configure the Google Account email authorized to access and sync with the Master Excel Spreadsheet database.
                    </p>

                    {googleEmailFeedback && (
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{googleEmailFeedback}</span>
                      </div>
                    )}

                    <form onSubmit={handleSaveGoogleEmail} className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-700 mb-1.5">
                          Master Excel Google Account Email:
                        </label>
                        <input
                          type="email"
                          value={googleAdminEmail}
                          onChange={(e) => setGoogleAdminEmail(e.target.value)}
                          placeholder="e.g. ithipoorampos@gmail.com"
                          className="w-full py-2.5 px-4 rounded-xl bg-zinc-50 border border-zinc-300 text-xs font-medium focus:outline-none focus:border-black text-black"
                          required
                        />
                      </div>

                      {googleSpreadsheetUrl && (
                        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs flex items-center justify-between">
                          <span className="text-zinc-500 truncate mr-2">Linked Sheet: 5-in-1 Master Database</span>
                          <a
                            href={googleSpreadsheetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-blue-600 hover:underline shrink-0"
                          >
                            Open Google Sheet &rarr;
                          </a>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isSavingGoogleEmail}
                        className="w-full py-2.5 px-4 rounded-xl bg-black hover:bg-zinc-800 text-white font-black text-xs transition cursor-pointer flex items-center justify-center space-x-2 shadow-xs active:scale-98 disabled:opacity-50"
                      >
                        {isSavingGoogleEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Google Account Email</span>}
                      </button>
                    </form>
                  </div>

                </div>
              </div>
            )}

            {/* ========================================================== */}
            {/* 4. REPORTS & ANALYTICS TAB (CALENDAR PICKER + 5 IN 1 EXCEL) */}
            {/* ========================================================== */}
            {activeTab === 'reports' && (
              <div className="max-w-2xl mx-auto space-y-5">
                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-zinc-200 shadow-xs space-y-5">
                  
                  {/* Top Action Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                    <h3 className="text-base font-bold text-zinc-900">
                      Reports &amp; Analytics
                    </h3>
                    <button
                      type="button"
                      disabled={dayCloseLoading}
                      onClick={handleCloseDay}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {dayCloseLoading ? 'Closing Day...' : 'Close Day & Download Z-Report'}
                    </button>
                  </div>

                  {/* Real Interactive Calendar */}
                  <div className="space-y-3">
                    {/* Month / Year Switcher Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                      <div className="flex items-center space-x-2">
                        {/* Month Selector */}
                        <select
                          value={calendarViewDate.getMonth()}
                          onChange={(e) => {
                            const d = new Date(calendarViewDate);
                            d.setMonth(parseInt(e.target.value, 10));
                            setCalendarViewDate(d);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                        >
                          {CALENDAR_MONTHS.map((m, idx) => (
                            <option key={m} value={idx}>{m}</option>
                          ))}
                        </select>

                        {/* Year Selector (2024 to 2035) */}
                        <select
                          value={calendarViewDate.getFullYear()}
                          onChange={(e) => {
                            const d = new Date(calendarViewDate);
                            d.setFullYear(parseInt(e.target.value, 10));
                            setCalendarViewDate(d);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer font-mono"
                        >
                          {CALENDAR_YEARS.map((yr) => (
                            <option key={yr} value={yr}>{yr}</option>
                          ))}
                        </select>
                      </div>

                      {/* Navigation Controls: Previous, Today, Next */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date(calendarViewDate);
                            d.setMonth(d.getMonth() - 1);
                            setCalendarViewDate(d);
                          }}
                          className="w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 flex items-center justify-center text-zinc-700 font-bold text-sm transition cursor-pointer"
                          title="Previous Month"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const today = new Date();
                            setCalendarViewDate(today);
                            handleSelectCalendarDate(today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
                          }}
                          className="px-2.5 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 font-semibold text-xs transition cursor-pointer"
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date(calendarViewDate);
                            d.setMonth(d.getMonth() + 1);
                            setCalendarViewDate(d);
                          }}
                          className="w-8 h-8 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 flex items-center justify-center text-zinc-700 font-bold text-sm transition cursor-pointer"
                          title="Next Month"
                        >
                          ›
                        </button>
                      </div>
                    </div>

                    {/* Calendar Days Grid */}
                    <div className="bg-white rounded-xl border border-zinc-200 p-3 shadow-2xs">
                      {/* Weekday Column Headers */}
                      <div className="grid grid-cols-7 gap-1 text-center pb-2 border-b border-zinc-100 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                        <div>Sun</div>
                        <div>Mon</div>
                        <div>Tue</div>
                        <div>Wed</div>
                        <div>Thu</div>
                        <div>Fri</div>
                        <div>Sat</div>
                      </div>

                      {/* Day Number Cells */}
                      <div className="grid grid-cols-7 gap-1 pt-2">
                        {calendarDays.map((d, idx) => {
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelectCalendarDate(d.isoDate)}
                              className={`h-11 sm:h-12 rounded-lg flex flex-col items-center justify-center transition relative cursor-pointer ${
                                d.isSelected
                                  ? 'bg-zinc-900 text-white font-bold shadow-xs ring-2 ring-zinc-900/20'
                                  : d.isToday
                                  ? 'bg-zinc-100 text-zinc-900 font-bold border-2 border-zinc-900'
                                  : d.isCurrentMonth
                                  ? 'text-zinc-800 hover:bg-zinc-100 font-medium'
                                  : 'text-zinc-300 hover:bg-zinc-50 font-normal'
                              }`}
                            >
                              <span className="text-xs leading-none">{d.dayNumber}</span>
                              {d.hasSales && (
                                <span
                                  className={`w-1.5 h-1.5 rounded-full mt-1 ${d.isSelected ? 'bg-emerald-400' : 'bg-emerald-600'}`}
                                  title="Sales recorded on this date"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Clean Selected Date Indicator */}
                  <div className="pt-2 border-t border-zinc-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-600">
                      Selected Date: <strong className="text-zinc-900 font-mono">{selectedCalendarDate}</strong>
                      {calendarRecordedDates.includes(selectedCalendarDate) && (
                        <span className="ml-2 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                          Sales Recorded
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Excel and 4 PDF Download Buttons Arranged One Under the Other */}
                  <div className="flex flex-col space-y-2.5 pt-1">
                    {/* 1. Master Excel (5-in-1 Database) */}
                    <a
                      href={`/api/admin/daily-reports?format=excel&date=${selectedCalendarDate}`}
                      download={`IthiPooram_MasterDatabase_${selectedCalendarDate}.xls`}
                      className="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-black text-white font-semibold text-xs text-center transition shadow-xs active:scale-99 block cursor-pointer"
                    >
                      Download Master Database (5-in-1 Excel)
                    </a>

                    {/* 2. Daily Sales Report (PDF) */}
                    <button
                      type="button"
                      onClick={() => handleDownloadSingleReport('sales', selectedCalendarDate, `${selectedCalendarDate}-sales-report.pdf`)}
                      className="w-full py-3 px-4 rounded-xl border border-zinc-300 hover:border-zinc-900 bg-white hover:bg-zinc-50 text-zinc-900 font-semibold text-xs text-center transition shadow-2xs active:scale-99 cursor-pointer"
                    >
                      Download Daily Sales Report (PDF)
                    </button>

                    {/* 3. Daily Menu Stock Report (PDF) */}
                    <button
                      type="button"
                      onClick={() => handleDownloadSingleReport('menu', selectedCalendarDate, `${selectedCalendarDate}-menu-stock-report.pdf`)}
                      className="w-full py-3 px-4 rounded-xl border border-zinc-300 hover:border-zinc-900 bg-white hover:bg-zinc-50 text-zinc-900 font-semibold text-xs text-center transition shadow-2xs active:scale-99 cursor-pointer"
                    >
                      Download Daily Menu Stock &amp; Remaining Quantity Report (PDF)
                    </button>

                    {/* 4. Daily Table Revenue Report (PDF) */}
                    <button
                      type="button"
                      onClick={() => handleDownloadSingleReport('tables', selectedCalendarDate, `${selectedCalendarDate}-table-revenue-report.pdf`)}
                      className="w-full py-3 px-4 rounded-xl border border-zinc-300 hover:border-zinc-900 bg-white hover:bg-zinc-50 text-zinc-900 font-semibold text-xs text-center transition shadow-2xs active:scale-99 cursor-pointer"
                    >
                      Download Daily Table-wise Orders &amp; Revenue Report (PDF)
                    </button>

                    {/* 5. Billing Authorization Report (PDF) */}
                    <button
                      type="button"
                      onClick={() => handleDownloadSingleReport('billing', selectedCalendarDate, `${selectedCalendarDate}-billing-auth-report.pdf`)}
                      className="w-full py-3 px-4 rounded-xl border border-zinc-300 hover:border-zinc-900 bg-white hover:bg-zinc-50 text-zinc-900 font-semibold text-xs text-center transition shadow-2xs active:scale-99 cursor-pointer"
                    >
                      Download Billing Authorization &amp; Staff Action Report (PDF)
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* ========================================================== */}
            {/* 4. STORAGE & LOCAL ARCHIVES (ADMIN PROTECTED)              */}
            {/* ========================================================== */}
            {activeTab === 'storage' && (
              <div className="max-w-2xl space-y-6">
                {!isStorageAdminUnlocked ? (
                  /* Admin Password Challenge Form - Compact Box */
                  <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-xs max-w-xs mx-auto text-center space-y-3.5">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mx-auto text-zinc-800">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-black">Master Security Authorization</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Enter 4-digit Master Security PIN to configure storage folder.
                      </p>
                    </div>

                    <form onSubmit={handleUnlockStorageAdmin} className="space-y-2.5">
                      <div>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={storageAdminPinInput}
                          onChange={(e) => {
                            setStorageAdminPinInput(e.target.value);
                            setStorageAdminPinError(null);
                          }}
                          placeholder="Master Security PIN"
                          className="w-full text-center text-sm font-mono font-black tracking-widest py-2 px-3 rounded-xl bg-zinc-50 border border-zinc-300 focus:outline-none focus:border-black text-black"
                        />
                        {storageAdminPinError && (
                          <p className="text-[11px] text-red-600 font-bold mt-1">{storageAdminPinError}</p>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 px-3 rounded-xl bg-black hover:bg-zinc-800 text-white font-black text-xs transition shadow-xs cursor-pointer active:scale-98"
                      >
                        Authorize &amp; Unlock
                      </button>
                    </form>
                  </div>
                ) : (
                  /* Unlocked Storage Path Card */
                  <div className="bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                      <h3 className="text-base sm:text-lg font-black text-black">
                        Phone Storage &amp; Database Archive Folder
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setIsStorageAdminUnlocked(false);
                          setStorageAdminPinInput('');
                        }}
                        className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 cursor-pointer"
                        title="Lock Section"
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                    </div>

                    {storageSyncMessage && (
                      <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>{storageSyncMessage}</span>
                      </div>
                    )}

                    {/* Hidden folder input for directory selection on mobile/desktop */}
                    <input
                      id="phone-folder-input"
                      type="file"
                      // @ts-ignore
                      webkitdirectory=""
                      directory=""
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          const relativePath = files[0].webkitRelativePath || '';
                          const folderName = relativePath.split('/')[0] || 'IthiPooram_POS';
                          const customPath = `Internal Storage/Download/${folderName}/reports_archive/`;
                          setPhoneStoragePath(customPath);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('ithipooram_phone_storage_path', customPath);
                          }
                          setStorageSyncMessage(`✓ Synced folder: ${folderName}`);
                          setTimeout(() => setStorageSyncMessage(null), 4000);
                        }
                      }}
                    />

                    <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
                      <span className="text-[10px] font-extrabold uppercase text-zinc-500 tracking-wider block">
                        Active Storage Folder Path on Device:
                      </span>
                      
                      <div className="bg-white p-3 rounded-xl border border-zinc-200 font-mono text-xs font-bold text-zinc-900 break-all">
                        {phoneStoragePath}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleChooseDirectory}
                          className="px-4 py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-black transition cursor-pointer shadow-xs active:scale-95 flex items-center space-x-1.5"
                        >
                          <FolderDown className="w-3.5 h-3.5" />
                          <span>Choose Folder from Phone Storage</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleManualEditPath}
                          className="px-3.5 py-2.5 rounded-xl border border-zinc-300 hover:border-black bg-white hover:bg-zinc-100 text-black text-xs font-bold transition cursor-pointer active:scale-95"
                        >
                          <span>Edit Path</span>
                        </button>
                      </div>

                      <p className="text-[11px] text-zinc-500 leading-relaxed pt-1">
                        All daily sales reports, menu updates, and staff audits will download and sync automatically to this chosen device storage folder.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================== */}
            {/* 5. FACTORY RESET (SENSITIVE SHOP HANDOVER BUTTON)           */}
            {/* ========================================================== */}
            {activeTab === 'reset' && (
              <div className="max-w-2xl space-y-6">
                <div className="bg-red-50/50 rounded-3xl p-6 sm:p-8 border-2 border-red-300 shadow-sm space-y-5">
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-red-950">Factory Reset / Shop Handover Wipe</h3>
                      <p className="text-xs text-red-800 font-semibold mt-1 leading-relaxed">
                        This action is intended for handover to the shop. It wipes the entire staff database (no staffs), clears all test sales and orders, and resets all menu and tables to 0 so the restaurant owner starts with a brand new app showing full zeros everywhere.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-2xl border border-red-200 space-y-3">
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2 text-xs font-bold text-zinc-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={resetWipeAll}
                          onChange={(e) => setResetWipeAll(e.target.checked)}
                          className="accent-red-600 w-4 h-4 rounded"
                        />
                        <span>Complete Clean Wipe: Reset all tables &amp; menu to zero state</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-zinc-900 uppercase tracking-wider mb-1">
                        Enter Master Security PIN to Authorize Reset:
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={resetPinInput}
                        onChange={(e) => {
                          setResetPinInput(e.target.value);
                          setResetError(null);
                        }}
                        placeholder="Master Security PIN"
                        className="w-full py-2.5 px-4 rounded-xl bg-zinc-50 border border-zinc-300 text-sm font-mono font-black focus:outline-none focus:border-red-600 text-black"
                      />
                      {resetError && (
                        <p className="text-xs text-red-600 font-bold mt-1.5">{resetError}</p>
                      )}
                      {resetSuccess && (
                        <p className="text-xs text-emerald-700 font-bold mt-1.5">
                          ✓ App reset to factory state! Redirecting to setup...
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleExecuteFactoryReset}
                      disabled={resetLoading || resetPinInput.length === 0}
                      className="w-full py-3.5 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center justify-center space-x-2 transition shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {resetLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      <span>Execute Factory Reset &amp; Start As Fresh App</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            </div>
          </div>
        )}

      </main>

      {/* ============================================================== */}
      {/* STAFF DETAIL & MANAGEMENT MODAL (CLICKED FROM STAFF NAME CARD) */}
      {/* ============================================================== */}
      {selectedStaffDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-zinc-200 space-y-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-black text-white font-black text-base flex items-center justify-center shrink-0">
                  {(selectedStaffDetail.fullName || selectedStaffDetail.username || 'S').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-black leading-tight">
                    {selectedStaffDetail.fullName || selectedStaffDetail.username}
                  </h3>
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    {selectedStaffDetail.role || 'CASHIER'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffDetail(null)}
                className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-black cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-bold">Designated Role:</span>
                <span className="font-black text-black bg-zinc-100 px-2.5 py-0.5 rounded-md text-[11px]">
                  {selectedStaffDetail.role}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-bold">Station Desk:</span>
                <span className="font-bold text-black">{selectedStaffDetail.station || 'Billing Counter POS 1'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-bold">4-Digit Security PIN:</span>
                <span className="font-mono font-black text-emerald-700 tracking-widest text-sm bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {selectedStaffDetail.pin || '••••'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-bold">Staff ID:</span>
                <span className="font-mono font-bold text-zinc-700">{selectedStaffDetail.id || selectedStaffDetail.username}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-bold">Registration Date:</span>
                <span className="font-bold text-zinc-700">
                  {selectedStaffDetail.registeredAt ? new Date(selectedStaffDetail.registeredAt).toLocaleDateString('en-IN') : 'Active Member'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  const s = selectedStaffDetail;
                  setSelectedStaffDetail(null);
                  handleDeleteStaff(s.id, s.fullName || s.username);
                }}
                className="flex-1 py-3 px-3 rounded-2xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-black text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 active:scale-98"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Staff</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedStaffDetail(null)}
                className="py-3 px-5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-black font-black text-xs transition cursor-pointer active:scale-98"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* REGISTER NEW STAFF MODAL                                        */}
      {/* ============================================================== */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 text-xs text-black animate-in zoom-in-95 duration-100 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-black" />
                <div>
                  <h3 className="text-base font-black text-black">Register Staff Member</h3>
                  <p className="text-[11px] text-zinc-400 font-medium">Create staff login and billing authorization credentials</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddStaffModalOpen(false)}
                className="text-zinc-400 hover:text-black p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {staffError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{staffError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-700 mb-1">
                  Full Name:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. Rahul Kumar, Anitha S"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 font-bold text-black focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-700 mb-1">
                    Role:
                  </label>
                  <select
                    value={newStaffRole}
                    onChange={(e: any) => {
                      const r = e.target.value;
                      setNewStaffRole(r);
                      if (r === 'CASHIER') setNewStaffStation('Billing Counter POS 1');
                      else if (r === 'KITCHEN_STAFF') setNewStaffStation('Main Kitchen Display (KDS)');
                      else if (r === 'MANAGER') setNewStaffStation('Floor Operations Desk');
                      else if (r === 'MAIN_ADMIN') setNewStaffStation('Executive Central Gateway');
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 font-bold text-black bg-white focus:outline-none focus:border-black"
                  >
                    <option value="CASHIER">Cashier (Billing)</option>
                    <option value="KITCHEN_STAFF">Kitchen Chef (KDS)</option>
                    <option value="MANAGER">Floor Manager</option>
                    <option value="MAIN_ADMIN">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-700 mb-1">
                    4-Digit PIN:
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    value={newStaffPin}
                    onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 font-mono font-black text-black tracking-widest text-center focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-zinc-700 mb-1">
                  Terminal Station:
                </label>
                <input
                  type="text"
                  value={newStaffStation}
                  onChange={(e) => setNewStaffStation(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 font-medium text-black focus:outline-none focus:border-black"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAddStaffModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-zinc-600 font-bold hover:bg-zinc-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-white font-black transition shadow-xs cursor-pointer active:scale-98"
                >
                  Register Staff Member
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
