'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Receipt, 
  CreditCard, 
  QrCode, 
  Banknote, 
  Printer, 
  Lock, 
  CheckCircle2, 
  Split, 
  Percent, 
  ArrowLeft,
  ChevronRight,
  Bluetooth,
  History,
  Smartphone,
  RotateCcw,
  X
} from 'lucide-react';
import { apiRequest, getCurrentUser } from '../../lib/api';
import { 
  printDirectToBluetoothThermalPrinter, 
  subscribeToPrinterConnection, 
  connectPersistentBluetoothPrinter,
  isBluetoothPrinterConnected, 
  getConnectedBluetoothDeviceName 
} from '../../lib/thermalPrinter';

interface TableSummary {
  id: string;
  tableCode: string;
  displayName: string;
  roomName?: string;
  status: 'AVAILABLE' | 'ACTIVE_ORDER' | 'BILL_PENDING' | 'CLOSED' | 'DISABLED';
  unpaidCount: number;
  unpaidTotalPaise: number;
}

export default function BillingTerminalPage() {
  const router = useRouter();

  const [mobileTab, setMobileTab] = useState<'tables' | 'orders' | 'checkout'>('tables');
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [activeBillingRoom, setActiveBillingRoom] = useState<string | null>(null);
  const [selectedTableCode, setSelectedTableCode] = useState<string>('');
  const [unpaidOrders, setUnpaidOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [billPreview, setBillPreview] = useState<any | null>(null);

  // Synced Hierarchical Back Navigation: Modals -> Checkout -> Orders -> Room Tables -> All Rooms -> Previous Page
  const handleBack = () => {
    if (isDirectBillAuthOpen) {
      setIsDirectBillAuthOpen(false);
      setIsDirectBillOpen(true);
      return;
    }
    if (isDirectBillOpen) {
      setIsDirectBillOpen(false);
      return;
    }
    if (isAddDishModalOpen) {
      setIsAddDishModalOpen(false);
      return;
    }
    if (isTotalSalesModalOpen) {
      setIsTotalSalesModalOpen(false);
      return;
    }
    if (isPinModalOpen) {
      setIsPinModalOpen(false);
      return;
    }
    if (billPreview) {
      setBillPreview(null);
      return;
    }
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.back();
      return;
    }
    if (mobileTab === 'checkout') {
      setMobileTab('orders');
      return;
    }
    if (mobileTab === 'orders') {
      setMobileTab('tables');
      setSelectedTableCode('');
      return;
    }
    if (activeBillingRoom !== null) {
      setActiveBillingRoom(null);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  // Safe hardware back button synchronization without corrupting router history
  useEffect(() => {
    const handlePop = () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (hash === '#checkout') {
        setMobileTab('checkout');
      } else if (hash === '#orders') {
        setMobileTab('orders');
      } else {
        setMobileTab('tables');
        setSelectedTableCode('');
        setActiveBillingRoom(null);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const [cashier, setCashier] = useState<any>(null);
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Payment states
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [splitCashPaise, setSplitCashPaise] = useState<number>(0);
  const [splitUpiPaise, setSplitUpiPaise] = useState<number>(0);

  // Today's Total Sales Modal State (Live Synced)
  const [isTotalSalesModalOpen, setIsTotalSalesModalOpen] = useState(false);

  // PIN re-auth modal & Staff Authorization
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [selectedStaffName, setSelectedStaffName] = useState<string>('Administrator (Master PIN)');
  const [registeredStaffUsers, setRegisteredStaffUsers] = useState<any[]>([]);
  const [selectedAuthorizer, setSelectedAuthorizer] = useState<{ id: string; name: string; type: 'ADMIN' | 'STAFF' }>({
    id: 'ADMIN',
    name: 'Administrator (Master PIN)',
    type: 'ADMIN',
  });

  // Direct Quick Bill Cashier Authorization States
  const [isDirectBillAuthOpen, setIsDirectBillAuthOpen] = useState(false);
  const [directBillAuthorizer, setDirectBillAuthorizer] = useState<{ id: string; name: string; type: 'ADMIN' | 'STAFF' }>({
    id: 'ADMIN',
    name: 'Administrator (Master PIN)',
    type: 'ADMIN',
  });
  const [directBillPin, setDirectBillPin] = useState('');
  const [directBillPinError, setDirectBillPinError] = useState<string | null>(null);

  const [staffOptions, setStaffOptions] = useState<Array<{ name: string; role: string }>>([
    { name: 'Administrator (Master PIN)', role: 'MAIN_ADMIN' },
  ]);

  // USB Thermal Printer over Network states
  const [isPrintingUsb, setIsPrintingUsb] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);

  // Derived unique rooms strictly from registered tables for room segregation
  const billingRooms = React.useMemo(() => {
    const set = new Set<string>();
    tables.forEach((t) => {
      if (t.roomName && t.roomName.trim()) set.add(t.roomName.trim());
    });
    return Array.from(set);
  }, [tables]);

  // Tables filtered by active room drill-down
  const activeRoomTables = React.useMemo(() => {
    if (!activeBillingRoom) return tables;
    return tables.filter(
      (t) => (t.roomName || 'Dining Area').toLowerCase() === activeBillingRoom.toLowerCase()
    );
  }, [tables, activeBillingRoom]);

  // Load real registered staff from master database
  useEffect(() => {
    fetch('/api/staff/sessions')
      .then((r) => r.json())
      .then((data) => {
        if (data?.staff && Array.isArray(data.staff)) {
          setRegisteredStaffUsers(data.staff);
          const list = data.staff.map((s: any) => ({
            name: s.fullName || s.username,
            role: s.role || 'CASHIER',
          }));
          setStaffOptions(list);
        }
      })
      .catch(() => {});
  }, []);

  // Receipt Print modal
  const [printedInvoice, setPrintedInvoice] = useState<any | null>(null);
  const [thermalReceiptText, setThermalReceiptText] = useState<string>('');
  const [printerErrorNotice, setPrinterErrorNotice] = useState<boolean>(false);
  const [receiptViewMode, setReceiptViewMode] = useState<'slip' | 'text'>('slip');

  const parsedReceiptData = useMemo(() => {
    if (!printedInvoice && !thermalReceiptText) return null;

    let items: Array<{ name: string; qty: number; rate: number; total: number }> = [];
    if (Array.isArray(printedInvoice?.items) && printedInvoice.items.length > 0) {
      items = printedInvoice.items.map((it: any) => ({
        name: it.name || it.itemNameSnapshot || it.itemName || 'Dish',
        qty: it.qty || it.quantity || 1,
        rate: it.rate !== undefined ? it.rate : Math.round((it.pricePaise || it.itemPriceSnapshotPaise || 0) / 100),
        total: it.total !== undefined ? it.total : Math.round((it.lineTotalPaise || ((it.pricePaise || 0) * (it.quantity || 1)) || 0) / 100),
      }));
    }

    let invoiceNumber = printedInvoice?.invoiceNumber || '';
    let dateStr = printedInvoice?.dateStr || '';
    let timeStr = printedInvoice?.timeStr || '';
    let tableCode = printedInvoice?.tableCode || printedInvoice?.tableName || '';
    let cashierName = printedInvoice?.cashierName || printedInvoice?.cashier || '';
    let paymentMode = (printedInvoice?.paymentMode || 'CASH').toUpperCase();
    let grandTotal = printedInvoice?.grandTotalPaise ? (printedInvoice.grandTotalPaise / 100).toFixed(2) : '';

    if (thermalReceiptText) {
      const invMatch = thermalReceiptText.match(/Inv:\s*([^\r\n]+)/);
      if (invMatch && !invoiceNumber) invoiceNumber = invMatch[1].trim();

      const dtMatch = thermalReceiptText.match(/Date:\s*([^\s]+)\s+Time:\s*([^\r\n]+)/);
      if (dtMatch) {
        if (!dateStr) dateStr = dtMatch[1].trim();
        if (!timeStr) timeStr = dtMatch[2].trim();
      }

      const tblMatch = thermalReceiptText.match(/Table:\s*([^\r\n]+)/);
      if (tblMatch && !tableCode) tableCode = tblMatch[1].trim();

      const cashMatch = thermalReceiptText.match(/Cashier:\s*([^\r\n]+)/);
      if (cashMatch && !cashierName) cashierName = cashMatch[1].trim();

      const totMatch = thermalReceiptText.match(/GRAND TOTAL:\s*₹?\s*([0-9.]+)/);
      if (totMatch && !grandTotal) grandTotal = totMatch[1].trim();

      const payMatch = thermalReceiptText.match(/Payment:\s*\[([^\]]+)\]/);
      if (payMatch) paymentMode = payMatch[1].trim().toUpperCase();

      if (items.length === 0) {
        const lines = thermalReceiptText.split('\n');
        let inItems = false;
        for (const line of lines) {
          if (line.includes('ITEM             QTY  RATE TOTAL')) {
            inItems = true;
            continue;
          }
          if (inItems && line.startsWith('----')) {
            continue;
          }
          if (inItems && (line.startsWith('GRAND TOTAL') || line.startsWith('====') || line.startsWith('----'))) {
            inItems = false;
            break;
          }
          if (inItems && line.trim()) {
            const namePart = line.substring(0, 16).trim();
            const rest = line.substring(16).trim().split(/\s+/);
            if (rest.length >= 3) {
              items.push({
                name: namePart,
                qty: parseInt(rest[0], 10) || 1,
                rate: parseFloat(rest[1]) || 0,
                total: parseFloat(rest[2]) || 0,
              });
            }
          }
        }
      }
    }

    if (!dateStr) dateStr = new Date().toLocaleDateString('en-IN');
    if (!timeStr) timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (!cashierName) cashierName = selectedStaffName || 'Counter Cashier';
    if (!grandTotal && items.length > 0) {
      grandTotal = items.reduce((s, it) => s + it.total, 0).toFixed(2);
    }

    return {
      invoiceNumber: invoiceNumber || '20261115-001',
      dateStr,
      timeStr,
      tableCode: tableCode || selectedTableCode || 'Table 1',
      cashierName,
      items,
      grandTotal: grandTotal || '0.00',
      paymentMode,
    };
  }, [printedInvoice, thermalReceiptText, selectedStaffName, selectedTableCode]);

  // Receipt Font Customization Settings (Editable live by shopkeeper)
  const [billSettings, setBillSettings] = useState<any>({
    baseFontSize: 15,
    grandTotalSize: 26,
    itemSize: 15,
    metadataSize: 14,
    placeName: 'Vanchiyoor, Trivandrum',
    lineSpacing: 'relaxed',
  });
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/billing/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d?.settings) setBillSettings(d.settings);
      })
      .catch(() => {});
  }, []);

  const handleSaveBillSettings = async (newSettings: any) => {
    setBillSettings(newSettings);
    try {
      await fetch('/api/billing/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      setIsDesignModalOpen(false);
    } catch (e) {}
  };

  // Bluetooth Printer states
  const [isPrinterConnected, setIsPrinterConnected] = useState<boolean>(false);
  const [connectedPrinterName, setConnectedPrinterName] = useState<string | null>(null);
  const [isConnectingPrinter, setIsConnectingPrinter] = useState<boolean>(false);

  // Mobile PWA Install state
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallPrompt(null);
      }
    } else {
      alert('📱 To install Ithi Pooram POS as an App on your phone:\n\nOn Android (Chrome):\n1. Tap the three dots (⋮) in the top-right corner.\n2. Tap "Install App" or "Add to Home screen".\n\nOn iPhone (Safari):\n1. Tap the Share button at the bottom.\n2. Tap "Add to Home Screen".');
    }
  };

  // Settled Orders tracking (persisted to localStorage so settled bills never disappear or reappear as unpaid)
  const [orderTab, setOrderTab] = useState<'unpaid' | 'settled'>('unpaid');
  const [settledInvoices, setSettledInvoices] = useState<any[]>([]);

  // Reprint modal
  const [isReprintModalOpen, setIsReprintModalOpen] = useState(false);
  const [reprintReason, setReprintReason] = useState('');
  const [reprintPin, setReprintPin] = useState('');

  // Discount modal (Manager)
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountAmountRupees, setDiscountAmountRupees] = useState('');
  const [discountReason, setDiscountReason] = useState('');

  // Quick Direct Bill & Add Dish States
  const [menuCategories, setMenuCategories] = useState<any[]>([]);
  const [isDirectBillOpen, setIsDirectBillOpen] = useState(false);
  const [directBillCart, setDirectBillCart] = useState<Array<{ id: string; name: string; malayalamName?: string; pricePaise: number; qty: number }>>([]);
  const [directBillSearch, setDirectBillSearch] = useState('');
  const [directBillPaymentMode, setDirectBillPaymentMode] = useState<'CASH' | 'UPI'>('CASH');
  const [directBillOrderType, setDirectBillOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>('TAKEAWAY');
  const [directBillTableCode, setDirectBillTableCode] = useState('');
  const [isSubmittingDirectBill, setIsSubmittingDirectBill] = useState(false);

  // Add Dish to Table modal state
  const [isAddDishModalOpen, setIsAddDishModalOpen] = useState(false);
  const [addDishCart, setAddDishCart] = useState<Array<{ id: string; name: string; malayalamName?: string; pricePaise: number; qty: number }>>([]);
  const [addDishSearch, setAddDishSearch] = useState('');
  const [isSubmittingAddDish, setIsSubmittingAddDish] = useState(false);

  const loadMenuDishes = async () => {
    try {
      const res = await fetch('/api/menu', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setMenuCategories(data);
      }
    } catch (e) {}
  };

  const allDishes = useMemo(() => {
    if (!menuCategories || !Array.isArray(menuCategories)) return [];
    const list: any[] = [];
    for (const cat of menuCategories) {
      if (Array.isArray(cat.items)) {
        for (const item of cat.items) {
          list.push({ ...item, categoryName: cat.name });
        }
      }
    }
    return list;
  }, [menuCategories]);

  const filteredDirectBillDishes = useMemo(() => {
    const available = allDishes.filter((d: any) => d.isAvailable !== false);
    if (!directBillSearch.trim()) return available;
    const q = directBillSearch.toLowerCase();
    return available.filter((d: any) =>
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.malayalamName && d.malayalamName.toLowerCase().includes(q)) ||
      (d.categoryName && d.categoryName.toLowerCase().includes(q))
    );
  }, [allDishes, directBillSearch]);

  const filteredAddDishes = useMemo(() => {
    const available = allDishes.filter((d: any) => d.isAvailable !== false);
    if (!addDishSearch.trim()) return available;
    const q = addDishSearch.toLowerCase();
    return available.filter((d: any) =>
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.malayalamName && d.malayalamName.toLowerCase().includes(q)) ||
      (d.categoryName && d.categoryName.toLowerCase().includes(q))
    );
  }, [allDishes, addDishSearch]);

  const directBillTotalPaise = useMemo(() => {
    return directBillCart.reduce((sum, it) => sum + (it.pricePaise * it.qty), 0);
  }, [directBillCart]);

  const addDishTotalPaise = useMemo(() => {
    return addDishCart.reduce((sum, it) => sum + (it.pricePaise * it.qty), 0);
  }, [addDishCart]);

  const handleDirectBillAddItem = (item: any) => {
    setDirectBillCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          malayalamName: item.malayalamName,
          pricePaise: item.pricePaise || 12000,
          qty: 1,
        },
      ];
    });
  };

  const handleDirectBillRemoveItem = (itemId: string) => {
    setDirectBillCart((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (existing && existing.qty > 1) {
        return prev.map((i) => (i.id === itemId ? { ...i, qty: i.qty - 1 } : i));
      }
      return prev.filter((i) => i.id !== itemId);
    });
  };

  const handleOpenDirectBillAuth = () => {
    if (directBillCart.length === 0) {
      alert('Please select at least one dish.');
      return;
    }
    setDirectBillPin('');
    setDirectBillPinError(null);
    setIsDirectBillOpen(false);
    setIsDirectBillAuthOpen(true);
  };

  const handleConfirmDirectBillWithPin = async () => {
    if (!directBillPin || directBillPin.length < 4) {
      setDirectBillPinError(
        directBillAuthorizer.type === 'ADMIN'
          ? 'Enter 4-digit Master Security PIN'
          : `Enter 4-digit PIN for ${directBillAuthorizer.name}`
      );
      return;
    }
    try {
      setIsSubmittingDirectBill(true);
      setDirectBillPinError(null);
      const res = await fetch('/api/billing/quick-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: directBillCart.map((i) => ({
            name: i.name,
            qty: i.qty,
            pricePaise: i.pricePaise,
          })),
          paymentMode: directBillPaymentMode,
          orderType: directBillOrderType,
          tableCode: directBillOrderType === 'DINE_IN' ? (directBillTableCode || selectedTableCode || 'T1A') : 'TAKEAWAY',
          cashierName: directBillAuthorizer.name,
          cashierId: directBillAuthorizer.id,
          authType: directBillAuthorizer.type,
          pin: directBillPin,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsDirectBillAuthOpen(false);
        setIsDirectBillOpen(false);
        const settledCart = [...directBillCart];
        setDirectBillCart([]);
        if (data.thermalReceipt) {
          setPrintedInvoice(data.invoice || {
            invoiceNumber: data.invoiceNumber,
            grandTotalPaise: data.grandTotalPaise,
            paymentMode: directBillPaymentMode,
            items: settledCart,
            cashierName: directBillAuthorizer.name,
          });
          setThermalReceiptText(data.thermalReceipt);
          triggerBluetoothPrint(data.thermalReceipt);
        }
        setPrintFeedback(`✓ Direct Bill ${data.invoiceNumber || ''} Settled & Printed!`);
        setTimeout(() => setPrintFeedback(null), 4000);
        loadTables();
        loadSettledInvoices();
        if (selectedTableCode) loadUnpaidOrders(selectedTableCode);
      } else {
        setDirectBillPinError(data.error || 'Failed to process quick bill');
      }
    } catch (e: any) {
      setDirectBillPinError(e.message || 'Error processing bill');
    } finally {
      setIsSubmittingDirectBill(false);
    }
  };

  const handleSubmitDirectBill = handleOpenDirectBillAuth;

  const handleAddDishAddItem = (item: any) => {
    setAddDishCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          malayalamName: item.malayalamName,
          pricePaise: item.pricePaise || 12000,
          qty: 1,
        },
      ];
    });
  };

  const handleAddDishRemoveItem = (itemId: string) => {
    setAddDishCart((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (existing && existing.qty > 1) {
        return prev.map((i) => (i.id === itemId ? { ...i, qty: i.qty - 1 } : i));
      }
      return prev.filter((i) => i.id !== itemId);
    });
  };

  const handleSubmitAddDish = async () => {
    if (!selectedTableCode) {
      alert('Please select a table first.');
      return;
    }
    if (addDishCart.length === 0) {
      alert('Please select at least one dish.');
      return;
    }
    try {
      setIsSubmittingAddDish(true);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableCode: selectedTableCode.toUpperCase(),
          items: addDishCart.map((i) => ({
            id: i.id,
            name: i.name,
            malayalamName: i.malayalamName,
            pricePaise: i.pricePaise,
            quantity: i.qty,
          })),
          notes: 'Counter Billing Order',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsAddDishModalOpen(false);
        setAddDishCart([]);
        setPrintFeedback(`✓ Dishes added to Table ${selectedTableCode} and sent to Kitchen!`);
        setTimeout(() => setPrintFeedback(null), 3500);
        await Promise.all([
          loadTables(),
          loadUnpaidOrders(selectedTableCode),
        ]);
      } else {
        alert(data.error || 'Failed to add dishes');
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setIsSubmittingAddDish(false);
    }
  };

  const formatRupees = (paise: number = 0) => `₹${(paise / 100).toFixed(2)}`;

  // Helper to strictly check if an invoice date string belongs to today in Indian Standard Time (IST)
  const isTodayIst = (dStr?: string) => {
    if (!dStr) return true;
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const itemDate = new Date(dStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      return itemDate === today;
    } catch {
      return true;
    }
  };

  const todaySettledStats = useMemo(() => {
    const todayInvoices = (settledInvoices || []).filter((inv) => isTodayIst(inv.settledAt));
    const completedCount = todayInvoices.length;
    const totalPaise = todayInvoices.reduce((sum, inv) => sum + (inv.grandTotalPaise || 0), 0);
    const cashPaise = todayInvoices
      .filter((i) => (i.paymentMode || '').toUpperCase() === 'CASH')
      .reduce((sum, inv) => sum + (inv.grandTotalPaise || 0), 0);
    const upiPaise = todayInvoices
      .filter((i) => (i.paymentMode || '').toUpperCase() !== 'CASH')
      .reduce((sum, inv) => sum + (inv.grandTotalPaise || 0), 0);

    return {
      completedCount,
      totalPaise,
      totalInr: (totalPaise / 100).toFixed(2),
      cashInr: (cashPaise / 100).toFixed(2),
      upiInr: (upiPaise / 100).toFixed(2),
    };
  }, [settledInvoices]);

  // Load settled invoices for today only from master server database and local cache
  // Previous days' settled invoices remain permanently in database, but are cleared from the daily cashier screen
  const loadSettledInvoices = async () => {
    try {
      const res = await fetch('/api/admin/daily-reports?date=today&format=json');
      if (res.ok) {
        const d = await res.json();
        const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const serverInvoices = (d.salesData || d.reports?.billingAuthorization || [])
          .filter((s: any) => {
            const itemDate = s.settledAt ? new Date(s.settledAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : todayIst;
            return itemDate === todayIst;
          })
          .map((s: any) => ({
            id: s.id || s.billNumber || s.orderCode,
            invoiceNumber: s.invoiceNumber || s.billNumber || `INV-${s.orderCode}`,
            orderCode: s.orderCode || s.billNumber,
            tableCode: s.tableCode || 'COUNTER',
            grandTotalPaise: s.grandTotalPaise !== undefined ? s.grandTotalPaise : (s.grandTotalRupees ? s.grandTotalRupees * 100 : (s.amountRupees ? s.amountRupees * 100 : 0)),
            paymentMode: (s.paymentMode || 'CASH').toUpperCase(),
            settledAt: s.settledAt || s.printedAt || new Date().toISOString(),
            cashierName: s.cashier || s.authorizedByStaffName || 'Cashier',
            items: s.items || [],
          }));

        setSettledInvoices((prev) => {
          const map = new Map<string, any>();
          // Only retain previous invoices that strictly belong to today
          prev.filter((inv) => isTodayIst(inv.settledAt)).forEach((inv) => map.set(inv.invoiceNumber || inv.id, inv));
          serverInvoices.forEach((inv: any) => map.set(inv.invoiceNumber || inv.id, inv));
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.settledAt || 0).getTime() - new Date(a.settledAt || 0).getTime()
          );
          if (typeof window !== 'undefined') {
            localStorage.setItem('ithipooram_settled_invoices', JSON.stringify(merged.slice(0, 100)));
          }
          return merged;
        });
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedInvoices = localStorage.getItem('ithipooram_settled_invoices');
      if (savedInvoices) {
        try {
          const parsed = JSON.parse(savedInvoices);
          if (Array.isArray(parsed)) {
            // Strictly exclude previous days' invoices so billing screen starts fresh each morning
            const todayOnly = parsed.filter((inv: any) => isTodayIst(inv.settledAt));
            setSettledInvoices(todayOnly);
            localStorage.setItem('ithipooram_settled_invoices', JSON.stringify(todayOnly));
          }
        } catch (e) {}
      }
    }
    loadSettledInvoices();
    const interval = setInterval(loadSettledInvoices, 6000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to Bluetooth printer connection events
  useEffect(() => {
    const unsub = subscribeToPrinterConnection((connected, name) => {
      setIsPrinterConnected(connected);
      setConnectedPrinterName(name);
    });
    return () => unsub();
  }, []);

  const handleConnectPrinter = async () => {
    try {
      setIsConnectingPrinter(true);
      const res = await connectPersistentBluetoothPrinter();
      setIsPrinterConnected(true);
      setConnectedPrinterName(res.name);
      alert(`Connected successfully to ${res.name}!`);
    } catch (err: any) {
      alert(err.message || 'Bluetooth connection failed. Make sure Bluetooth is enabled and SEZNIK printer is turned on.');
    } finally {
      setIsConnectingPrinter(false);
    }
  };

  const loadTables = async () => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('ithipooram_custom_tables');
        if (saved && (saved.includes('T1A') || saved.includes('t-t1a-ac') || saved.includes('AC Room'))) {
          localStorage.removeItem('ithipooram_custom_tables');
        }
      }
      setLoadingTables(true);

      // Fetch registered tables directly from master database
      const data = await apiRequest<TableSummary[]>('/tables');
      if (Array.isArray(data)) {
        setTables(data);
        if (typeof window !== 'undefined') {
          localStorage.setItem('ithipooram_custom_tables', JSON.stringify(data));
        }
      }

      if (data && data.length > 0) {
        setSelectedTableCode((prev) => {
          const exists = data.some((t) => t.tableCode.toUpperCase() === prev?.toUpperCase());
          if (exists) return prev;
          const withUnpaid = data.find((t) => t.unpaidCount > 0);
          return withUnpaid ? withUnpaid.tableCode : data[0].tableCode;
        });
      }
    } catch (err) {
      console.error('Failed to load tables:', err);
    } finally {
      setLoadingTables(false);
    }
  };

  const loadUnpaidOrders = async (tCode: string, silent = false) => {
    if (!tCode) return;
    try {
      if (!silent) setLoadingOrders(true);
      const res = await apiRequest(`/billing/tables/${tCode}/unpaid`);
      const freshOrders: any[] = res.unpaidOrders || [];

      // Read settled order identifiers from localStorage
      const savedSettled = typeof window !== 'undefined' ? localStorage.getItem('ithipooram_settled_order_ids') : null;
      const settledSet = new Set<string>(savedSettled ? JSON.parse(savedSettled) : []);

      setUnpaidOrders((prev) => {
        // 1. Filter out anything known settled by unique order ID so settled orders NEVER reappear as unpaid
        const activeFresh = freshOrders.filter(
          (o: any) => !settledSet.has(o.id) && o.paymentStatus !== 'PAID'
        );

        // 2. If cold lambda returned 0, retain previously loaded unsettled orders
        let resolved = activeFresh;
        if (activeFresh.length === 0 && prev.length > 0) {
          const stillUnsettled = prev.filter(
            (o: any) => !settledSet.has(o.id) && o.paymentStatus !== 'PAID'
          );
          if (stillUnsettled.length > 0) {
            resolved = stillUnsettled;
          }
        }

        if (resolved.length > 0) {
          setSelectedOrder((curr: any) => {
            const valid = curr && resolved.find((o: any) => o.id === curr.id);
            const target = valid || resolved[0];
            selectOrderForBilling(target);
            return target;
          });
        } else {
          setSelectedOrder(null);
          setBillPreview(null);
        }

        return resolved;
      });
    } catch (err) {
      if (!silent) console.error('Failed to load unpaid orders:', err);
    } finally {
      if (!silent) setLoadingOrders(false);
    }
  };

  const selectOrderForBilling = async (order: any) => {
    setSelectedOrder(order);
    try {
      const preview = await apiRequest(`/billing/orders/${order.id}/preview`);
      setBillPreview(preview);
      setSplitCashPaise(Math.floor(preview.calculation.grandTotalPaise / 2));
      setSplitUpiPaise(preview.calculation.grandTotalPaise - Math.floor(preview.calculation.grandTotalPaise / 2));
    } catch (err) {
      console.error('Failed to fetch bill preview:', err);
    }
  };

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) {
      router.replace('/login');
      return;
    }
    setCashier(u);
    loadTables();
  }, [router]);

  useEffect(() => {
    if (selectedTableCode) {
      loadUnpaidOrders(selectedTableCode);
    }
  }, [selectedTableCode]);

  // Live tracker: continuously tracks customer ordering system in real-time (2.5s)
  // Resilient to cold lambdas: NEVER overwrites valid table list with empty array
  useEffect(() => {
    const liveTrackerInterval = setInterval(async () => {
      try {
        const freshTables = await apiRequest<TableSummary[]>('/tables');
        if (Array.isArray(freshTables)) {
          setTables(freshTables);
          if (typeof window !== 'undefined') {
            localStorage.setItem('ithipooram_custom_tables', JSON.stringify(freshTables));
          }
        }
        if (selectedTableCode) {
          loadUnpaidOrders(selectedTableCode, true);
        }
      } catch (err) {
        // Silent background polling
      }
    }, 2500);

    return () => clearInterval(liveTrackerInterval);
  }, [selectedTableCode]);

  const handleInitiatePayment = () => {
    if (!selectedOrder) return;
    setEnteredPin('');
    setPinError(null);
    setIsPinModalOpen(true);
  };

  const handleConfirmPaymentWithPin = async () => {
    if (!enteredPin || enteredPin.length < 4) {
      setPinError(
        selectedAuthorizer.type === 'ADMIN'
          ? 'Enter 4-digit Master Security PIN'
          : `Enter 4-digit PIN for ${selectedAuthorizer.name}`
      );
      return;
    }

    try {
      setIsSubmittingPayment(true);
      setPinError(null);

      const payload: any = {
        paymentMode,
        referenceNumber: referenceNumber ? referenceNumber.trim() : undefined,
        cashierPin: enteredPin,
        authType: selectedAuthorizer.type,
        cashierId: selectedAuthorizer.id,
        cashierName: selectedAuthorizer.name,
      };

      if (paymentMode === 'SPLIT_PAYMENT') {
        payload.splitPayments = [
          { mode: 'CASH', amountPaise: splitCashPaise },
          { mode: 'UPI', amountPaise: splitUpiPaise, ref: referenceNumber || 'SPLIT-UPI' },
        ];
      }

      const res = await apiRequest(`/billing/orders/${selectedOrder.id}/confirm-payment`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const orderSettled = selectedOrder;
      const invoiceData = res.invoice;

      // 1. Immediately record in settled order IDs so this order CANNOT reappear as unpaid
      if (typeof window !== 'undefined' && orderSettled) {
        const savedSettled = localStorage.getItem('ithipooram_settled_order_ids');
        const settledList: string[] = savedSettled ? JSON.parse(savedSettled) : [];
        if (orderSettled.id) settledList.push(orderSettled.id);
        localStorage.setItem('ithipooram_settled_order_ids', JSON.stringify(settledList));

        // 2. Persist full invoice record so cashier can review or reprint anytime
        const savedInvoices = localStorage.getItem('ithipooram_settled_invoices');
        const invoicesList = savedInvoices ? JSON.parse(savedInvoices) : [];
        const fullRecord = {
          ...invoiceData,
          id: invoiceData?.id || `inv-${Date.now()}`,
          invoiceNumber: invoiceData?.invoiceNumber || `INV-${Date.now().toString().slice(-4)}`,
          orderCode: orderSettled.customerCode,
          tableCode: selectedTableCode,
          items: orderSettled.items,
          grandTotalPaise: invoiceData?.grandTotalPaise || orderSettled.grandTotalPaise,
          paymentMode,
          settledAt: new Date().toISOString(),
          cashierName: selectedAuthorizer.name,
          thermalReceipt: res.thermalReceipt,
        };
        invoicesList.unshift(fullRecord);
        localStorage.setItem('ithipooram_settled_invoices', JSON.stringify(invoicesList.slice(0, 100)));
        setSettledInvoices(invoicesList.slice(0, 100));
      }

      // 3. Immediately clear settled order from current unpaid state
      setUnpaidOrders((prev) => prev.filter((o) => o.id !== orderSettled?.id && o.customerCode !== orderSettled?.customerCode));
      setSelectedOrder(null);
      setBillPreview(null);

      // 4. Update table status immediately (no waiting for server poll)
      setTables((prev) => prev.map((t) => {
        if (t.tableCode.toUpperCase() === selectedTableCode.toUpperCase()) {
          const newCount = Math.max(0, t.unpaidCount - 1);
          const newPaise = Math.max(0, t.unpaidTotalPaise - (orderSettled?.grandTotalPaise || 0));
          return {
            ...t,
            unpaidCount: newCount,
            unpaidTotalPaise: newPaise,
            status: newCount > 0 ? t.status : 'AVAILABLE',
          };
        }
        return t;
      }));

      setIsPinModalOpen(false);
      setPrintedInvoice(res.invoice);
      setThermalReceiptText(res.thermalReceipt);
      setPrinterErrorNotice(res.printerStatus === 'PRINTER_ERROR');

      // Refresh in parallel
      Promise.all([
        loadTables(),
        loadUnpaidOrders(selectedTableCode),
      ]).catch(() => {});

      setPrintFeedback('✓ Payment confirmed! Review bill preview below and click Print to SEZNIK.');
      setTimeout(() => setPrintFeedback(null), 5000);
    } catch (err: any) {
      setPinError(err.message || 'Payment confirmation failed');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const triggerBluetoothPrint = async (textToPrint: string, dataObject?: any) => {
    const dataToSend = dataObject || parsedReceiptData;
    if (!textToPrint && !dataToSend) return;
    try {
      setIsPrintingUsb(true);
      setPrintFeedback('Sending to B-41 Thermal Printer...');
      const res = await apiRequest('/printer/print', {
        method: 'POST',
        body: JSON.stringify({ 
          receiptText: textToPrint, 
          receiptData: dataToSend,
          printerName: 'B-41' 
        }),
      });

      if (res.success) {
        setPrintFeedback('✓ Printed on B-41 Thermal Printer');
        setTimeout(() => setPrintFeedback(null), 3500);
        return true;
      } else {
        const msg = res.message || '⚠️ B-41 printer disconnected. Double-click printer icon on Desktop to auto-reconnect.';
        setPrintFeedback(msg);
        setTimeout(() => setPrintFeedback(null), 6000);
        return false;
      }
    } catch (err: any) {
      console.warn('[Bluetooth Print] Network error:', err);
      setPrintFeedback('⚠️ Could not connect to laptop printer server.');
      setTimeout(() => setPrintFeedback(null), 4000);
      return false;
    } finally {
      setIsPrintingUsb(false);
    }
  };

  const handleConfirmReprint = async () => {
    if (!printedInvoice || !reprintReason.trim() || !reprintPin) return;

    try {
      const res = await apiRequest(`/billing/invoices/${printedInvoice.id}/reprint`, {
        method: 'POST',
        body: JSON.stringify({
          reason: reprintReason.trim(),
          cashierPin: reprintPin,
        }),
      });

      setThermalReceiptText(res.thermalReceipt);
      setIsReprintModalOpen(false);
      setReprintReason('');
      setReprintPin('');
      
      // Immediately print duplicate copy on SEZNIK Bluetooth printer
      await triggerBluetoothPrint(res.thermalReceipt);
    } catch (err: any) {
      alert(err.message || 'Reprint failed');
    }
  };

  const handleTestPrint = async () => {
    const testSlip = 
`================================
          ഇത്തിപ്പൂരം
          ITHI POORAM
     Vanchiyoor, Trivandrum
================================
SEZNIK BLUETOOTH TEST
Date: ${new Date().toLocaleDateString('en-IN')}
Time: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
Device: SEZNIK 58mm Bluetooth
Status: WIRELESS TEST PASSED!
================================
      നന്ദി! വീണ്ടും വരിക
     Thank You! Visit Again
================================\n\n\n\n`;
    setThermalReceiptText(testSlip);
    await triggerBluetoothPrint(testSlip);
  };

  return (
    <div className="min-h-screen bg-parchment-50 flex flex-col font-sans">
      {/* Top POS Header - Responsive for All Mobile Devices */}
      <header className="bg-slatepos-900 border-b border-slatepos-800 text-white px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
        {/* Left: Instant Back Navigation */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleBack}
            className="p-2 rounded-xl bg-slatepos-800 hover:bg-slatepos-700 text-slatepos-300 transition-colors cursor-pointer"
            title="Back to Previous Page"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm sm:text-lg font-black tracking-wider text-white uppercase truncate max-w-[130px] xs:max-w-none">
            Billing
          </h1>
        </div>

        {/* Right: Clean Header with Total Sales Live Button & Quick Bill */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Total Sales Button with Live Sync */}
          <button
            type="button"
            onClick={() => setIsTotalSalesModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm cursor-pointer active:scale-95"
            title="Click to view today's total completed orders and sales revenue"
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>Total Sales ({todaySettledStats.completedCount})</span>
          </button>

          {/* Quick Direct Bill Button */}
          <button
            onClick={() => {
              loadMenuDishes();
              setDirectBillCart([]);
              setDirectBillSearch('');
              if (selectedTableCode) {
                setDirectBillTableCode(selectedTableCode);
                setDirectBillOrderType('DINE_IN');
              } else {
                setDirectBillOrderType('TAKEAWAY');
              }
              setIsDirectBillOpen(true);
            }}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-full text-[11px] font-black bg-amber-500 hover:bg-amber-400 text-stone-950 transition shadow-sm cursor-pointer active:scale-95"
            title="Fast Direct Bill for counter or dine-in customers"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>+ Quick Bill</span>
          </button>
        </div>
      </header>

      {/* Live Print Status Banner across Network for Mobile & PC */}
      {printFeedback && (
        <div className="bg-emerald-600 text-white text-xs font-black py-2 px-4 text-center shadow-lg sticky top-[50px] sm:top-[60px] z-25 flex items-center justify-center space-x-2 animate-fade-in">
          <Printer className="w-3.5 h-3.5 animate-bounce" />
          <span>{printFeedback}</span>
        </div>
      )}

      {/* Mobile Stepper / Tab Bar for Phone/Tablet Cashiers */}
      <div className="lg:hidden bg-stone-900 border-b border-stone-800 px-1.5 py-1.5 flex items-center justify-between text-xs sticky top-[50px] sm:top-[60px] z-20 shadow-md">
        <button
          onClick={() => setMobileTab('tables')}
          className={`flex-1 min-w-0 py-2 px-1 text-center rounded-lg font-bold transition text-xs truncate ${
            mobileTab === 'tables'
              ? 'bg-amber-500 text-stone-950 shadow-sm font-black'
              : 'text-stone-300 hover:bg-stone-800'
          }`}
        >
          1. Table ({selectedTableCode || '—'})
        </button>
        <ChevronRight className="w-3 h-3 text-stone-500 shrink-0 mx-0.5" />
        <button
          onClick={() => setMobileTab('orders')}
          className={`flex-1 min-w-0 py-2 px-1 text-center rounded-lg font-bold transition text-xs truncate ${
            mobileTab === 'orders'
              ? 'bg-amber-500 text-stone-950 shadow-sm font-black'
              : 'text-stone-300 hover:bg-stone-800'
          }`}
        >
          2. Orders ({unpaidOrders.length})
        </button>
        <ChevronRight className="w-3 h-3 text-stone-500 shrink-0 mx-0.5" />
        <button
          onClick={() => setMobileTab('checkout')}
          className={`flex-1 min-w-0 py-2 px-1 text-center rounded-lg font-bold transition text-xs truncate ${
            mobileTab === 'checkout'
              ? 'bg-amber-500 text-stone-950 shadow-sm font-black'
              : 'text-stone-300 hover:bg-stone-800'
          }`}
        >
          3. Settle {selectedOrder ? `(${formatRupees(billPreview?.calculation?.grandTotalPaise || selectedOrder.grandTotalPaise)})` : ''}
        </button>
      </div>

      {/* Main 3-Column Split View for High-Volume Counter Work */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0">
        {/* Left Column: Room Drill-Down & Table Selector */}
        <section className={`w-full lg:w-80 border-r border-parchment-200 bg-white p-4 flex flex-col flex-shrink-0 overflow-y-auto pb-36 lg:pb-6 ${
          mobileTab === 'tables' ? 'flex' : 'hidden lg:flex'
        }`}>
          
          {/* LEVEL 1: ROOMS LIST (One down after another with side notification of pending bills) */}
          {activeBillingRoom === null && (
            <div className="flex-1 flex flex-col space-y-3">
              <div className="pb-1 border-b border-parchment-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-slatepos-700">
                    Rooms ({billingRooms.length})
                  </h2>
                  <span className="text-[11px] font-bold text-slatepos-400">
                    {tables.length} Total Tables
                  </span>
                </div>
                <p className="text-[11px] text-slatepos-400 mt-0.5">
                  Select a room to view tables &amp; settle bills
                </p>
              </div>

              {billingRooms.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-parchment-200 rounded-2xl bg-parchment-50/60 my-auto">
                  <QrCode className="w-8 h-8 text-slatepos-400 mb-2" />
                  <h3 className="text-sm font-bold text-slatepos-900">No Rooms Registered</h3>
                  <p className="text-xs text-slatepos-500 mt-1 mb-3">
                    Register rooms and tables in Table Management first.
                  </p>
                  <Link
                    href="/qr"
                    className="px-4 py-2 rounded-xl bg-slatepos-900 text-white font-bold text-xs shadow-xs"
                  >
                    Go to Table Management &rarr;
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {billingRooms.map((rm) => {
                    const roomTables = tables.filter(
                      (t) => (t.roomName || 'Dining Area').toLowerCase() === rm.toLowerCase()
                    );
                    const pendingCount = roomTables.reduce((sum, t) => sum + (t.unpaidCount || 0), 0);
                    const pendingPaise = roomTables.reduce((sum, t) => sum + (t.unpaidTotalPaise || 0), 0);

                    return (
                      <button
                        key={rm}
                        type="button"
                        onClick={() => setActiveBillingRoom(rm)}
                        className="w-full text-left bg-parchment-50/60 hover:bg-parchment-100/80 p-3.5 rounded-2xl border-2 border-parchment-200 hover:border-slatepos-900 shadow-2xs transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99]"
                      >
                        <div className="space-y-1 flex-1 pr-2">
                          <span className="text-sm font-black text-slatepos-950 block">{rm}</span>
                          <span className="text-[11px] font-semibold text-slatepos-500 block">
                            {roomTables.length} {roomTables.length === 1 ? 'Table' : 'Tables'}
                          </span>
                        </div>

                        {/* Side Notification: Which room has pending bill to settle notify on the side with how many left in numbers */}
                        <div className="flex items-center space-x-2 shrink-0">
                          {pendingCount > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-brand-600 text-white animate-pulse shadow-xs">
                                {pendingCount} {pendingCount === 1 ? 'Pending' : 'Pending'}
                              </span>
                              <span className="text-[10px] font-bold text-brand-700 mt-0.5">
                                {formatRupees(pendingPaise)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                              All Settled ✓
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-slatepos-400 group-hover:text-slatepos-900 group-hover:translate-x-0.5 transition" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* LEVEL 2: TABLES INSIDE SELECTED ROOM */}
          {activeBillingRoom !== null && (
            <div className="flex-1 flex flex-col space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-parchment-200">
                <button
                  type="button"
                  onClick={() => setActiveBillingRoom(null)}
                  className="px-2.5 py-1 rounded-lg border border-parchment-300 hover:border-slatepos-900 bg-white hover:bg-parchment-100 text-slatepos-800 text-xs font-black flex items-center space-x-1 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>All Rooms</span>
                </button>
                <div className="text-right">
                  <h3 className="text-xs font-black text-slatepos-950">{activeBillingRoom}</h3>
                  <span className="text-[10px] font-semibold text-slatepos-500">
                    {activeRoomTables.length} Tables
                  </span>
                </div>
              </div>

              {activeRoomTables.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-parchment-300 rounded-2xl bg-parchment-50/60 my-auto">
                  <QrCode className="w-6 h-6 text-slatepos-400 mb-2" />
                  <p className="text-xs font-bold text-slatepos-700">No tables in {activeBillingRoom}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {activeRoomTables.map((t) => {
                    const isSelected = selectedTableCode.toUpperCase() === t.tableCode.toUpperCase();
                    const isBillPending = t.status === 'BILL_PENDING';
                    const isActive = t.status === 'ACTIVE_ORDER';
                    const tableSettledList = settledInvoices.filter(
                      (inv) => (inv.tableCode || '').toUpperCase() === t.tableCode.toUpperCase()
                    );

                    return (
                      <button
                        key={t.id || t.tableCode}
                        onClick={() => {
                          setSelectedTableCode(t.tableCode);
                          setMobileTab('orders');
                          if (typeof window !== 'undefined') {
                            window.history.pushState({ ...(window.history.state || {}), sub: 'orders' }, '', '#orders');
                          }
                        }}
                        className={`p-3 rounded-2xl border text-left transition relative flex flex-col justify-between min-h-[105px] cursor-pointer ${
                          isSelected
                            ? 'border-brand-600 bg-brand-50/60 ring-2 ring-brand-500/30'
                            : isBillPending
                            ? 'border-brand-300 bg-brand-50/30 hover:border-brand-400'
                            : isActive
                            ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400'
                            : tableSettledList.length > 0
                            ? 'border-emerald-300 bg-emerald-50/30 hover:border-emerald-400'
                            : 'border-parchment-200 bg-parchment-50/50 hover:border-parchment-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-base font-black text-slatepos-950 font-mono">
                            {t.tableCode}
                          </span>
                          <div className="flex items-center space-x-1">
                            {tableSettledList.length > 0 && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-md" title="Settled Bills Today">
                                ✓ {tableSettledList.length}
                              </span>
                            )}
                            {t.unpaidCount > 0 && (
                              <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                                {t.unpaidCount}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] font-medium text-slatepos-500 truncate">
                            {t.displayName ? t.displayName.split('(')[0] : `Table ${t.tableCode}`}
                          </div>
                          <div className="text-xs font-extrabold text-slatepos-900 mt-0.5">
                            {t.unpaidTotalPaise > 0 ? formatRupees(t.unpaidTotalPaise) : 'Free'}
                          </div>

                          {/* Today's Settled Orders (YYYYMMDD-XXX) */}
                          {tableSettledList.length > 0 && (
                            <div className="mt-1.5 pt-1 border-t border-dashed border-emerald-200 text-[10px] font-mono text-emerald-800 truncate">
                              <span>✓ {tableSettledList.map((inv) => (inv.invoiceNumber || inv.orderCode || '').replace(/^INV-/, '')).slice(0, 2).join(', ')}</span>
                              {tableSettledList.length > 2 && <span className="text-slatepos-400 font-sans"> +{tableSettledList.length - 2}</span>}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </section>

        {/* Middle Column: Latest 3 to 5 Unpaid Orders for Selected Table */}
        <section className={`w-full lg:w-96 border-r border-parchment-200 bg-parchment-50 p-4 flex flex-col flex-shrink-0 overflow-y-auto pb-36 lg:pb-6 ${
          mobileTab === 'orders' ? 'flex' : 'hidden lg:flex'
        }`}>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-parchment-200">
            <div>
              <h2 className="text-sm font-bold text-slatepos-900 flex items-center space-x-1.5">
                <span>Orders</span>
                {selectedTableCode && (
                  <span className="font-mono text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                    {selectedTableCode}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slatepos-500">
                {selectedTableCode ? 'Latest 3 to 5 unpaid customer tickets' : 'Select a table to monitor tickets'}
              </p>
            </div>
          </div>

          {/* Sub-Tabs: Unpaid Orders vs Settled History */}
          <div className="flex bg-parchment-200/70 p-1 rounded-xl mb-3">
            <button
              onClick={() => setOrderTab('unpaid')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                orderTab === 'unpaid'
                  ? 'bg-white text-slatepos-950 shadow-xs'
                  : 'text-slatepos-600 hover:text-slatepos-900'
              }`}
            >
              <span>Unpaid</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${orderTab === 'unpaid' ? 'bg-amber-100 text-amber-800' : 'bg-parchment-300 text-slatepos-600'}`}>
                {unpaidOrders.length}
              </span>
            </button>
            <button
              onClick={() => setOrderTab('settled')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                orderTab === 'settled'
                  ? 'bg-white text-slatepos-950 shadow-xs'
                  : 'text-slatepos-600 hover:text-slatepos-900'
              }`}
            >
              <span>Settled</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${orderTab === 'settled' ? 'bg-emerald-100 text-emerald-800' : 'bg-parchment-300 text-slatepos-600'}`}>
                {settledInvoices.filter(inv => !selectedTableCode || (inv.tableCode || '').toUpperCase() === selectedTableCode.toUpperCase()).length}
              </span>
            </button>
          </div>

          {/* Direct Add Dish to Selected Table */}
          {selectedTableCode && orderTab === 'unpaid' && (
            <button
              onClick={() => {
                loadMenuDishes();
                setAddDishCart([]);
                setAddDishSearch('');
                setIsAddDishModalOpen(true);
              }}
              className="w-full mb-3 py-2.5 px-3 rounded-xl bg-slatepos-900 hover:bg-slatepos-800 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer active:scale-98 shadow-xs"
            >
              <span>+ Add Dishes to Table {selectedTableCode}</span>
            </button>
          )}

          {tables.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-parchment-200">
              <h3 className="text-sm font-bold text-slatepos-900">No Tables Added Yet</h3>
              <p className="text-xs text-slatepos-500 mt-1">
                Add tables from the Table QR Stands section to view orders here.
              </p>
            </div>
          ) : !selectedTableCode ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-parchment-200">
              <h3 className="text-sm font-bold text-slatepos-900">No Table Selected</h3>
              <p className="text-xs text-slatepos-500 mt-1">
                Select a table on the left to inspect customer orders.
              </p>
            </div>
          ) : orderTab === 'settled' ? (
            // Settled Invoices List for Selected Table
            (() => {
              const tableSettled = settledInvoices.filter(
                (inv) => !selectedTableCode || (inv.tableCode || '').toUpperCase() === selectedTableCode.toUpperCase()
              );

              if (tableSettled.length === 0) {
                return (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-parchment-200">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mb-2" />
                    <h3 className="text-sm font-bold text-slatepos-900">No Settled Bills Yet</h3>
                    <p className="text-xs text-slatepos-500 mt-1">
                      Settled bills for Table {selectedTableCode} will appear here with 1-click reprint.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-2.5">
                  {tableSettled.map((inv, idx) => (
                    <div
                      key={inv.id || idx}
                      className="p-3.5 rounded-2xl border border-parchment-200 bg-white hover:border-emerald-300 transition shadow-2xs"
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-parchment-100">
                        <div>
                          <span className="text-xs font-black text-slatepos-950 font-mono">
                            {inv.invoiceNumber || 'INV-PAID'}
                          </span>
                          <div className="text-[10px] text-slatepos-400">
                            {inv.settledAt ? new Date(inv.settledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Settled'} • {inv.paymentMode || 'UPI'}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-emerald-700">
                            {formatRupees(inv.grandTotalPaise || 0)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slatepos-500">
                          {inv.cashierName || 'Cashier'}
                        </span>
                        <button
                          onClick={() => {
                            setPrintedInvoice(inv);
                            setThermalReceiptText(inv.thermalReceipt || '');
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slatepos-900 hover:bg-slatepos-800 text-white flex items-center space-x-1 cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                          <span>View Receipt</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          ) : loadingOrders ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs text-slatepos-500">Checking open orders...</p>
            </div>
          ) : unpaidOrders.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-parchment-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/60 mb-2" />
              <h3 className="text-sm font-bold text-slatepos-900">No Unpaid Orders</h3>
              <p className="text-xs text-slatepos-500 mt-1">
                Table {selectedTableCode} has no outstanding balance.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {unpaidOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                return (
                  <button
                    key={order.id}
                    onClick={() => {
                      selectOrderForBilling(order);
                      setMobileTab('checkout');
                      if (typeof window !== 'undefined') {
                        window.history.pushState({ ...(window.history.state || {}), sub: 'checkout' }, '', '#checkout');
                      }
                    }}
                    className={`w-full p-4 rounded-2xl border text-left transition shadow-2xs ${
                      isSelected
                        ? 'border-brand-600 bg-white ring-2 ring-brand-500/20'
                        : 'border-parchment-200 bg-white hover:border-parchment-300'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-parchment-100">
                      <div>
                        <span className="text-base font-black text-slatepos-950 font-mono">
                          {order.customerCode}
                        </span>
                        <div className="text-[10px] text-slatepos-400">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-brand-700">
                          {formatRupees(order.grandTotalPaise)}
                        </span>
                        <div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              order.fulfillmentStatus === 'READY'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.fulfillmentStatus === 'PREPARING'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slatepos-100 text-slatepos-600'
                            }`}
                          >
                            {order.fulfillmentStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 space-y-1">
                      {order.items.map((it: any) => (
                        <div key={it.id} className="flex justify-between text-xs text-slatepos-700">
                          <span className="truncate pr-2">
                            {it.quantity}x {it.itemNameSnapshot || it.itemName || it.name}
                          </span>
                          <span className="font-semibold text-slatepos-900">
                            {formatRupees(it.lineTotalPaise)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Full Bill Preview & Payment Confirmation */}
        <section className={`flex-1 bg-white p-4 sm:p-6 flex flex-col justify-between overflow-y-auto pb-36 lg:pb-6 ${
          mobileTab === 'checkout' ? 'flex' : 'hidden lg:flex'
        }`}>
          {!selectedOrder || !billPreview ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slatepos-400 p-8">
              <Receipt className="w-16 h-16 text-slatepos-200 mb-3" />
              <h3 className="text-base font-bold text-slatepos-700">Select an Order Ticket</h3>
              <p className="text-xs text-slatepos-400 mt-1 max-w-xs">
                Pick a table and choose an unpaid check to review item lines and collect payment.
              </p>
            </div>
          ) : (
            <div className="max-w-xl mx-auto w-full flex flex-col h-full justify-between">
              <div>
                <div className="pb-4 border-b border-parchment-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slatepos-400">
                      BILL PREVIEW
                    </span>
                    <h2 className="text-2xl font-black text-slatepos-950 font-mono">
                      {selectedOrder.customerCode}
                    </h2>
                    <p className="text-xs text-slatepos-500">
                      Table: {selectedOrder.table?.displayName || selectedTableCode} • Time:{' '}
                      {new Date(selectedOrder.createdAt).toLocaleTimeString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                      UNPAID
                    </span>
                  </div>
                </div>

                <div className="py-4 border-b border-parchment-200 space-y-2">
                  <div className="text-xs font-bold text-slatepos-400 uppercase tracking-wider flex justify-between">
                    <span>Item & Qty</span>
                    <span>Total (INR)</span>
                  </div>
                  {selectedOrder.items.map((it: any) => (
                    <div key={it.id} className="flex justify-between text-sm text-slatepos-800">
                      <div>
                        <span className="font-semibold text-slatepos-950">{it.itemNameSnapshot || it.itemName || it.name}</span>
                        <span className="text-xs text-slatepos-500 ml-2">
                          ({it.quantity} x {formatRupees(it.itemPriceSnapshotPaise || it.pricePaise)})
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slatepos-900">
                        {formatRupees(it.lineTotalPaise)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="py-4 border-b border-parchment-200 space-y-2 text-xs text-slatepos-600">
                  <div className="flex justify-between items-center text-lg font-black text-slatepos-950">
                    <span>Net Payable:</span>
                    <span className="font-mono text-brand-700 text-xl">
                      {formatRupees(billPreview.calculation.grandTotalPaise || billPreview.calculation.subtotalPaise)}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slatepos-500">
                    Final price inclusive of all taxes. No additional GST charged.
                  </div>
                </div>

                <div className="py-4 space-y-3">
                  <label className="block text-xs font-bold text-slatepos-700 uppercase tracking-wider">
                    Select Payment Mode:
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {['UPI', 'CASH', 'CARD'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPaymentMode(mode)}
                        className={`py-3 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition border ${
                          paymentMode === mode
                            ? 'border-brand-600 bg-brand-50 text-brand-800 shadow-2xs ring-1 ring-brand-500/30'
                            : 'border-parchment-200 bg-white text-slatepos-700 hover:bg-parchment-50'
                        }`}
                      >
                        {mode === 'UPI' && <QrCode className="w-5 h-5 mb-1 text-brand-600" />}
                        {mode === 'CASH' && <Banknote className="w-5 h-5 mb-1 text-emerald-600" />}
                        {mode === 'CARD' && <CreditCard className="w-5 h-5 mb-1 text-blue-600" />}
                        <span>{mode}</span>
                      </button>
                    ))}
                  </div>

                  {paymentMode === 'UPI' && (
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="UPI Transaction ID / Ref (e.g. 2381290312)"
                      className="w-full text-xs p-2.5 rounded-xl border border-parchment-300 bg-parchment-50 focus:outline-none focus:border-brand-500 text-slatepos-900 font-medium"
                    />
                  )}

                  {paymentMode === 'CARD' && (
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="POS Terminal Approval Code / RRN"
                      className="w-full text-xs p-2.5 rounded-xl border border-parchment-300 bg-parchment-50 focus:outline-none focus:border-brand-500 text-slatepos-900 font-medium"
                    />
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-parchment-200">
                <button
                  onClick={handleInitiatePayment}
                  className="w-full py-4 rounded-2xl font-black text-sm text-white bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-900/15 flex items-center justify-center space-x-2 transition active:scale-98"
                >
                  <Lock className="w-4 h-4" />
                  <span>Authorize & Settle Bill ({formatRupees(billPreview.calculation.grandTotalPaise)})</span>
                </button>
                <p className="text-[10px] text-center text-slatepos-400 mt-2">
                  PIN re-authentication required. Instant row-lock guarantees against double-settlement.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Cashier Personal PIN Modal (Mobile Optimized without on-screen keypad; aligns phone's keyboard) */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-parchment-200 text-center animate-in zoom-in-95 duration-150 my-auto">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-2.5">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slatepos-950">Cashier Authorization</h3>
            <p className="text-xs text-slatepos-500 mt-0.5">
              Select authorizing user and enter PIN for{' '}
              <strong className="text-slatepos-900 font-mono">{selectedOrder?.customerCode}</strong>.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmPaymentWithPin();
              }}
              className="mt-3.5 space-y-3"
            >
              {pinError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold text-left">
                  {pinError}
                </div>
              )}

              {/* Select Who is Authorizing & Printing Bill */}
              <div className="text-left space-y-1">
                <label className="block text-[11px] font-black uppercase text-slatepos-700 tracking-wider">
                  Authorizing Person:
                </label>
                <select
                  value={selectedAuthorizer.id}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPinError(null);
                    setEnteredPin('');
                    if (val === 'ADMIN') {
                      setSelectedAuthorizer({ id: 'ADMIN', name: 'Administrator (Master PIN)', type: 'ADMIN' });
                    } else {
                      const st = registeredStaffUsers.find((s: any) => s.id === val);
                      if (st) {
                        setSelectedAuthorizer({ id: st.id, name: st.fullName || st.username, type: 'STAFF' });
                      }
                    }
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-slatepos-50 border-2 border-slatepos-300 font-bold text-xs text-slatepos-950 focus:outline-none focus:border-brand-600 cursor-pointer"
                >
                  <option value="ADMIN">👑 Administrator (Master PIN)</option>
                  {registeredStaffUsers.map((st: any) => (
                    <option key={st.id} value={st.id}>
                      👤 {st.fullName || st.username} ({st.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* PIN Entering Area with Native Keyboard Support */}
              <div className="py-2">
                <label className="block text-[11px] font-bold text-slatepos-700 mb-1.5 uppercase tracking-wider">
                  {selectedAuthorizer.type === 'ADMIN'
                    ? 'Enter 4-Digit Master Security PIN:'
                    : `Enter PIN for ${selectedAuthorizer.name}:`}
                </label>
                <div className="relative inline-block">
                  <input
                    type="password"
                    inputMode="numeric"
                    enterKeyHint="done"
                    maxLength={6}
                    value={enteredPin}
                    onChange={(e) => setEnteredPin(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirmPaymentWithPin();
                      }
                    }}
                    placeholder="••••"
                    className="w-44 text-center text-3xl tracking-[0.4em] font-mono py-2.5 px-3 rounded-2xl border-2 border-slatepos-900 focus:border-brand-600 focus:outline-none bg-white text-slate-950 font-black shadow-inner"
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-slatepos-500 font-semibold mt-1">
                  {selectedAuthorizer.type === 'ADMIN'
                    ? 'Master Security PIN required to confirm settlement'
                    : `Each staff member must authorize with their own registered PIN`}
                </p>
              </div>

              {/* Modal Buttons */}
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingPayment}
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 py-3 rounded-xl text-xs font-bold bg-slatepos-100 text-slatepos-700 hover:bg-slatepos-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment || enteredPin.length < 4}
                  className="flex-1 py-3 rounded-xl text-xs font-black bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 cursor-pointer shadow-md transition active:scale-98"
                >
                  {isSubmittingPayment ? 'Verifying PIN...' : 'Confirm PIN & View Bill Preview 👁️'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 58mm/80mm ESC/POS Thermal Receipt Preview & Print Modal */}
      {printedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl border border-parchment-200 overflow-hidden min-h-0">
            {/* Embedded Print CSS for exact 58mm thermal paper output */}
            <style jsx global>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #printable-receipt, #printable-receipt * {
                  visibility: visible !important;
                }
                #printable-receipt {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 58mm !important;
                  max-width: 58mm !important;
                  height: auto !important;
                  max-height: none !important;
                  overflow: visible !important;
                  padding: 2mm !important;
                  margin: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  font-family: 'Courier New', Courier, monospace !important;
                  font-size: 13px !important;
                  font-weight: 700 !important;
                  line-height: 1.35 !important;
                  color: black !important;
                  background: white !important;
                }
                #printable-receipt img {
                  max-height: 18mm !important;
                  width: auto !important;
                  margin: 0 auto !important;
                  display: block !important;
                }
              }
            `}</style>

            <div className="p-4 border-b border-parchment-200 flex items-center justify-between bg-parchment-50 shrink-0">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slatepos-950">Payment Confirmed</h3>
                  <p className="text-[11px] text-slatepos-500 font-mono font-bold">
                    {parsedReceiptData?.invoiceNumber || printedInvoice.invoiceNumber}
                  </p>
                </div>
              </div>

              {/* View Switcher: Slip Graphic vs 58mm Mono */}
              <div className="flex bg-slatepos-200 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setReceiptViewMode('slip')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    receiptViewMode === 'slip' ? 'bg-white text-slatepos-950 shadow-xs' : 'text-slatepos-600 hover:text-slatepos-900'
                  }`}
                >
                  Receipt Slip
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptViewMode('text')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    receiptViewMode === 'text' ? 'bg-white text-slatepos-950 shadow-xs' : 'text-slatepos-600 hover:text-slatepos-900'
                  }`}
                >
                  58mm Mono
                </button>
              </div>

              <button
                onClick={() => {
                  setPrintedInvoice(null);
                  setThermalReceiptText('');
                }}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-slatepos-200 text-slatepos-700 hover:bg-slatepos-300 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-3 sm:p-5 overflow-y-auto min-h-0 flex-1 bg-parchment-100 flex justify-center items-start">
              {receiptViewMode === 'slip' && parsedReceiptData ? (
                <div
                  id="printable-receipt"
                  className="bg-white text-slatepos-950 px-5 sm:px-6 pt-8 pb-10 rounded-2xl shadow-md border border-parchment-300 font-mono select-none w-full max-w-[360px] sm:max-w-[420px] my-1"
                  style={{
                    fontSize: `${billSettings.itemSize || 15}px`,
                    lineHeight: billSettings.lineSpacing === 'compact' ? '1.2' : billSettings.lineSpacing === 'normal' ? '1.35' : '1.5',
                  }}
                >
                  {/* Exact Home Page Brand Calligraphy Header */}
                  <div className="text-center pb-2.5">
                    <img
                      src="/brand-calligraphy-cropped.png"
                      alt="ഇത്തിപ്പൂരം - ITHI POORAM"
                      className="h-16 sm:h-20 w-auto max-w-[240px] mx-auto object-contain"
                      style={{ filter: 'contrast(160%)' }}
                    />
                    {/* ONLY place under brand calligraphy */}
                    <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-slatepos-950 mt-1.5">
                      {billSettings.placeName || 'Vanchiyoor, Trivandrum'}
                    </div>
                  </div>

                  {/* Metadata: Invoice Number, Date, Time, Table, Cashier */}
                  <div 
                    className="border-t-2 border-b-2 border-dashed border-slatepos-300 py-2.5 my-3 space-y-1 text-slatepos-900"
                    style={{ fontSize: `${billSettings.metadataSize || 14}px` }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold">Inv: <strong className="text-sm sm:text-base font-black text-slatepos-950">{parsedReceiptData.invoiceNumber}</strong></span>
                      <span className="font-semibold text-slatepos-700">{parsedReceiptData.timeStr}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Date: {parsedReceiptData.dateStr}</span>
                      <span className="font-bold">Table: <strong className="text-sm sm:text-base font-black text-slatepos-950">{parsedReceiptData.tableCode}</strong></span>
                    </div>
                    <div>
                      <span className="font-semibold">Cashier: <strong className="font-bold text-slatepos-950">{parsedReceiptData.cashierName}</strong></span>
                    </div>
                  </div>

                  {/* Column Headers */}
                  <div 
                    className="border-b-2 border-dashed border-slatepos-300 pb-1.5 font-black flex justify-between uppercase text-slatepos-950"
                    style={{ fontSize: `${billSettings.itemSize || 15}px` }}
                  >
                    <span className="w-1/2">ITEM</span>
                    <span className="w-10 text-center">QTY</span>
                    <span className="w-14 text-right">RATE</span>
                    <span className="w-16 text-right">TOTAL</span>
                  </div>

                  {/* Items List */}
                  <div 
                    className="py-2.5 space-y-1.5 border-b-2 border-dashed border-slatepos-300"
                    style={{ fontSize: `${billSettings.itemSize || 15}px` }}
                  >
                    {parsedReceiptData.items.map((it: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-start leading-snug">
                        <span className="w-1/2 font-bold truncate pr-1 text-slatepos-950">{it.name}</span>
                        <span className="w-10 text-center font-bold text-slatepos-800">{it.qty}</span>
                        <span className="w-14 text-right font-medium text-slatepos-800">₹{it.rate}</span>
                        <span className="w-16 text-right font-black text-slatepos-950">₹{it.total}</span>
                      </div>
                    ))}
                  </div>

                  {/* Grand Total & Payment Type - NO GST / NO TAXES */}
                  <div className="py-3 border-b-2 border-dashed border-slatepos-300 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-base sm:text-lg font-black text-slatepos-950">GRAND TOTAL:</span>
                      <span 
                        className="font-mono font-black text-brand-700"
                        style={{ fontSize: `${billSettings.grandTotalSize || 26}px` }}
                      >
                        ₹{parsedReceiptData.grandTotal}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slatepos-800 flex justify-between items-center">
                      <span>Payment:</span>
                      <span className="uppercase font-mono text-slatepos-950 font-black">[{parsedReceiptData.paymentMode}]</span>
                    </div>
                  </div>

                  {/* Footer: Malayalam & English */}
                  <div className="text-center pt-3 pb-1 space-y-1.5">
                    <img
                      src="/footer_malayalam.png"
                      alt="നന്ദി! വീണ്ടും വരിക"
                      className="h-6 sm:h-7 mx-auto object-contain my-1"
                      style={{ filter: 'contrast(160%)' }}
                    />
                    <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-slatepos-900">
                      Thank You! Visit Again
                    </div>
                  </div>
                </div>
              ) : (
                <pre
                  id="printable-receipt"
                  className="bg-white text-slatepos-950 p-5 rounded-xl shadow-xs border border-parchment-200 font-mono text-xs sm:text-sm leading-relaxed whitespace-pre max-w-[360px] w-full"
                >
                  {thermalReceiptText}
                </pre>
              )}
            </div>

            <div className="shrink-0 p-4 border-t border-parchment-200 bg-white space-y-2.5">
              {/* Feedback status inside modal */}
              {printFeedback && (
                <div className="text-center text-xs font-bold text-emerald-800 bg-emerald-50 py-2 px-3 rounded-xl border border-emerald-300">
                  {printFeedback}
                </div>
              )}

              {/* Primary 1-Click Print: Directly to B-41 Bluetooth Thermal Printer wirelessly */}
              <button
                disabled={isPrintingUsb}
                onClick={() => triggerBluetoothPrint(thermalReceiptText, parsedReceiptData)}
                className="w-full py-3.5 rounded-xl text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center space-x-2 shadow-md cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <Printer className="w-5 h-5" />
                <span>{isPrintingUsb ? 'Sending to B-41 Thermal...' : '🖨️ Print to B-41 Thermal Printer'}</span>
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={async () => {
                    setPrintFeedback('🔄 Reconnecting B-41 Printer...');
                    try {
                      const res = await apiRequest('/printer/reconnect', { method: 'POST' });
                      if (res && res.success) {
                        setPrintFeedback('✓ B-41 Printer Reconnected & Ready!');
                        setTimeout(() => setPrintFeedback(null), 3500);
                      } else {
                        setPrintFeedback(res?.message || '⚠️ Printer offline. Check if power is ON.');
                        setTimeout(() => setPrintFeedback(null), 5000);
                      }
                    } catch {
                      setPrintFeedback('⚠️ Reconnect command failed. Turn printer ON.');
                      setTimeout(() => setPrintFeedback(null), 4000);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 flex items-center justify-center space-x-1.5 border border-amber-200 cursor-pointer shadow-2xs transition"
                  title="Wake up and reconnect B-41 Printer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>🔄 Reconnect Printer</span>
                </button>

                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') window.print();
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center space-x-1.5 border border-stone-300 cursor-pointer shadow-2xs"
                  title="Export as PDF on phone or share via WhatsApp"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Save/Share PDF</span>
                </button>

                <button
                  onClick={() => setIsReprintModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-parchment-200 hover:bg-parchment-300 text-slatepos-800 cursor-pointer"
                >
                  Reprint Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reprint Bill Modal */}
      {isReprintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-parchment-200">
            <h3 className="text-base font-bold text-slatepos-950">Reprint Bill Copy</h3>
            <p className="text-xs text-slatepos-500 mt-1">
              Every reprint is stamped &ldquo;DUPLICATE REPRINT&rdquo; and recorded in the audit trail.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slatepos-700 mb-1">
                  Reason for Reprint:
                </label>
                <textarea
                  value={reprintReason}
                  onChange={(e) => setReprintReason(e.target.value)}
                  placeholder="e.g. Customer requested copy..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-parchment-300 focus:outline-none focus:border-brand-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slatepos-700 mb-1">
                  Cashier PIN:
                </label>
                <input
                  type="password"
                  value={reprintPin}
                  onChange={(e) => setReprintPin(e.target.value)}
                  placeholder="Enter PIN"
                  className="w-full text-xs p-2 rounded-xl border border-parchment-300 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="mt-5 flex space-x-2">
              <button
                onClick={() => setIsReprintModalOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-slatepos-100 text-slatepos-700"
              >
                Cancel
              </button>
              <button
                disabled={!reprintReason.trim() || !reprintPin}
                onClick={handleConfirmReprint}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
              >
                Confirm Reprint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Bill Design & Font Size Customizer Modal */}
      {isDesignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-parchment-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-parchment-200">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🎨</span>
                <div>
                  <h3 className="text-base font-black text-slatepos-950">Bill Font &amp; Layout Designer</h3>
                  <p className="text-[11px] text-slatepos-500">Fine-tune receipt font sizes for maximum readability</p>
                </div>
              </div>
              <button
                onClick={() => setIsDesignModalOpen(false)}
                className="p-1 rounded-lg hover:bg-parchment-100 text-slatepos-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Presets */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slatepos-700 mb-1.5">
                  Quick Font Size Presets:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Standard', item: 13, total: 22, meta: 12 },
                    { label: '★ Large', item: 15, total: 26, meta: 14 },
                    { label: '🔥 Extra Large', item: 18, total: 32, meta: 16 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setBillSettings((prev: any) => ({
                          ...prev,
                          itemSize: p.item,
                          grandTotalSize: p.total,
                          metadataSize: p.meta,
                          lineSpacing: 'relaxed',
                        }));
                      }}
                      className="py-2 px-2 rounded-xl text-xs font-bold border border-parchment-300 hover:border-brand-500 hover:bg-brand-50 text-slatepos-800 transition active:scale-95 cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-3 p-3 bg-parchment-50 rounded-2xl border border-parchment-200">
                <div>
                  <div className="flex justify-between text-xs font-bold text-slatepos-800 mb-1">
                    <span>Items &amp; Dish Names:</span>
                    <span className="font-mono text-brand-700 font-black">{billSettings.itemSize || 15}px</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="20"
                    value={billSettings.itemSize || 15}
                    onChange={(e) => setBillSettings((prev: any) => ({ ...prev, itemSize: Number(e.target.value) }))}
                    className="w-full accent-brand-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slatepos-800 mb-1">
                    <span>Grand Total Number:</span>
                    <span className="font-mono text-brand-700 font-black">{billSettings.grandTotalSize || 26}px</span>
                  </div>
                  <input
                    type="range"
                    min="18"
                    max="36"
                    value={billSettings.grandTotalSize || 26}
                    onChange={(e) => setBillSettings((prev: any) => ({ ...prev, grandTotalSize: Number(e.target.value) }))}
                    className="w-full accent-brand-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slatepos-800 mb-1">
                    <span>Table &amp; Cashier Info:</span>
                    <span className="font-mono text-brand-700 font-black">{billSettings.metadataSize || 14}px</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="20"
                    value={billSettings.metadataSize || 14}
                    onChange={(e) => setBillSettings((prev: any) => ({ ...prev, metadataSize: Number(e.target.value) }))}
                    className="w-full accent-brand-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Location Header */}
              <div>
                <label className="block text-xs font-bold text-slatepos-700 mb-1">
                  Place Name Under Calligraphy:
                </label>
                <input
                  type="text"
                  value={billSettings.placeName || 'Vanchiyoor, Trivandrum'}
                  onChange={(e) => setBillSettings((prev: any) => ({ ...prev, placeName: e.target.value }))}
                  className="w-full text-xs p-2.5 rounded-xl border border-parchment-300 font-bold text-slatepos-900 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-parchment-200 flex space-x-2">
              <button
                type="button"
                onClick={() => setIsDesignModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slatepos-100 text-slatepos-700 hover:bg-slatepos-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveBillSettings(billSettings)}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-brand-600 hover:bg-brand-700 text-white shadow-md cursor-pointer active:scale-95"
              >
                Save &amp; Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Direct Bill Modal */}
      {isDirectBillOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-black">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900">Direct Quick Bill</h3>
                  <p className="text-xs text-zinc-500">Fast counter order &amp; immediate thermal print</p>
                </div>
              </div>
              <button
                onClick={() => setIsDirectBillOpen(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-black hover:bg-zinc-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Order Type & Table Selection */}
              <div className="flex items-center gap-3">
                <div className="flex bg-zinc-100 p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setDirectBillOrderType('TAKEAWAY')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      directBillOrderType === 'TAKEAWAY' ? 'bg-white text-black shadow-xs' : 'text-zinc-500 hover:text-black'
                    }`}
                  >
                    Takeaway
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectBillOrderType('DINE_IN');
                      if (!directBillTableCode && tables.length > 0) {
                        setDirectBillTableCode(tables[0].tableCode);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      directBillOrderType === 'DINE_IN' ? 'bg-white text-black shadow-xs' : 'text-zinc-500 hover:text-black'
                    }`}
                  >
                    Dine-In
                  </button>
                </div>

                {directBillOrderType === 'DINE_IN' && (
                  <select
                    value={directBillTableCode || selectedTableCode || (tables[0]?.tableCode ?? '')}
                    onChange={(e) => setDirectBillTableCode(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-900 focus:outline-none focus:border-black"
                  >
                    {tables.map((t) => (
                      <option key={t.id} value={t.tableCode}>
                        {t.tableCode} - {t.displayName || `Table ${t.tableCode}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Search dishes */}
              <input
                type="text"
                value={directBillSearch}
                onChange={(e) => setDirectBillSearch(e.target.value)}
                placeholder="Search dishes (e.g. Masala Dosa, Idli)..."
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-xs text-zinc-900 font-medium focus:outline-none focus:border-black placeholder-zinc-400"
              />

              {/* Dishes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 border border-zinc-100 rounded-2xl bg-zinc-50/50">
                {filteredDirectBillDishes.length === 0 ? (
                  <div className="col-span-full py-6 text-center text-xs text-zinc-400 font-medium">
                    No dishes found matching &quot;{directBillSearch}&quot;
                  </div>
                ) : (
                  filteredDirectBillDishes.map((dish: any) => {
                    const inCart = directBillCart.find((it) => it.id === dish.id);
                    return (
                      <button
                        key={dish.id}
                        type="button"
                        onClick={() => handleDirectBillAddItem(dish)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer active:scale-95 ${
                          inCart
                            ? 'border-amber-400 bg-amber-50/80 ring-1 ring-amber-400'
                            : 'border-zinc-200 bg-white hover:border-zinc-400'
                        }`}
                      >
                        <div>
                          <span className="font-extrabold text-xs text-zinc-900 block truncate">{dish.name}</span>
                          {dish.malayalamName && (
                            <span className="text-[10px] text-zinc-400 font-malayalam block truncate">{dish.malayalamName}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-100">
                          <span className="text-xs font-black text-zinc-900 font-mono">
                            ₹{(dish.pricePaise / 100).toFixed(0)}
                          </span>
                          {inCart ? (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-stone-950 font-black text-[10px]">
                              {inCart.qty}
                            </span>
                          ) : (
                            <span className="text-[11px] font-black text-zinc-400 hover:text-black">+</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Cart Items */}
              {directBillCart.length > 0 && (
                <div className="border border-zinc-200 rounded-2xl p-3 bg-white space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-zinc-500 pb-1 border-b border-zinc-100">
                    Selected Items ({directBillCart.reduce((sum, it) => sum + it.qty, 0)})
                  </div>
                  <div className="divide-y divide-zinc-100 max-h-36 overflow-y-auto">
                    {directBillCart.map((it) => (
                      <div key={it.id} className="py-1.5 flex items-center justify-between text-xs">
                        <div className="flex-1 pr-2">
                          <span className="font-bold text-zinc-900 block truncate">{it.name}</span>
                          <span className="text-[10px] font-mono text-zinc-500">₹{(it.pricePaise / 100).toFixed(0)} each</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleDirectBillRemoveItem(it.id)}
                            className="w-6 h-6 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center font-black cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-mono font-black text-xs min-w-[16px] text-center">{it.qty}</span>
                          <button
                            type="button"
                            onClick={() => handleDirectBillAddItem(it)}
                            className="w-6 h-6 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center font-black cursor-pointer"
                          >
                            +
                          </button>
                          <span className="font-mono font-black text-xs text-zinc-900 min-w-[50px] text-right">
                            ₹{((it.pricePaise * it.qty) / 100).toFixed(0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Mode Selection */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-zinc-700">Payment Mode:</span>
                <div className="flex bg-zinc-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setDirectBillPaymentMode('CASH')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      directBillPaymentMode === 'CASH' ? 'bg-white text-black shadow-xs font-black' : 'text-zinc-500'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectBillPaymentMode('UPI')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      directBillPaymentMode === 'UPI' ? 'bg-white text-black shadow-xs font-black' : 'text-zinc-500'
                    }`}
                  >
                    UPI
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-zinc-400 block">Total Amount</span>
                <span className="text-lg font-black text-zinc-900 font-mono">
                  {formatRupees(directBillTotalPaise)}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsDirectBillOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingDirectBill || directBillCart.length === 0}
                  onClick={handleOpenDirectBillAuth}
                  className="px-5 py-2.5 rounded-xl bg-black hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-black flex items-center space-x-1.5 shadow-md transition cursor-pointer active:scale-95"
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Authorize &amp; Settle</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Direct Bill Cashier Authorization Modal */}
      {isDirectBillAuthOpen && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95 duration-150 my-auto">
            {/* Top Back Navigation Bar */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  setIsDirectBillAuthOpen(false);
                  setIsDirectBillOpen(true);
                }}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition cursor-pointer active:scale-95"
                title="Back to Quick Bill"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Authorization</span>
              <div className="w-12" />
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-2.5">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slatepos-950">Cashier Authorization</h3>
            <p className="text-xs text-slatepos-500 mt-0.5">
              Select who is authorizing and enter PIN to settle direct bill ({formatRupees(directBillTotalPaise)}).
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmDirectBillWithPin();
              }}
              className="mt-3.5 space-y-3"
            >
              {directBillPinError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold text-left">
                  {directBillPinError}
                </div>
              )}

              {/* Select Authorizing User */}
              <div className="text-left space-y-1">
                <label className="block text-[11px] font-black uppercase text-slatepos-700 tracking-wider">
                  Authorizing Person:
                </label>
                <select
                  value={directBillAuthorizer.id}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDirectBillPinError(null);
                    setDirectBillPin('');
                    if (val === 'ADMIN') {
                      setDirectBillAuthorizer({ id: 'ADMIN', name: 'Administrator (Master PIN)', type: 'ADMIN' });
                    } else {
                      const st = registeredStaffUsers.find((s: any) => s.id === val);
                      if (st) {
                        setDirectBillAuthorizer({ id: st.id, name: st.fullName || st.username, type: 'STAFF' });
                      }
                    }
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-slatepos-50 border-2 border-slatepos-300 font-bold text-xs text-slatepos-950 focus:outline-none focus:border-brand-600 cursor-pointer"
                >
                  <option value="ADMIN">👑 Administrator (Master PIN)</option>
                  {registeredStaffUsers.map((st: any) => (
                    <option key={st.id} value={st.id}>
                      👤 {st.fullName || st.username} ({st.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* PIN Input (Using Native Phone Keyboard, No in-display keypad) */}
              <div className="py-2">
                <label className="block text-[11px] font-bold text-slatepos-700 mb-1.5 uppercase tracking-wider">
                  {directBillAuthorizer.type === 'ADMIN'
                    ? 'Enter 4-Digit Master Security PIN:'
                    : `Enter PIN for ${directBillAuthorizer.name}:`}
                </label>
                <div className="relative inline-block">
                  <input
                    type="password"
                    inputMode="numeric"
                    enterKeyHint="done"
                    maxLength={6}
                    value={directBillPin}
                    onChange={(e) => setDirectBillPin(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirmDirectBillWithPin();
                      }
                    }}
                    placeholder="••••"
                    className="w-44 text-center text-3xl tracking-[0.4em] font-mono py-2.5 px-3 rounded-2xl border-2 border-slatepos-900 focus:border-brand-600 focus:outline-none bg-white text-slate-950 font-black shadow-inner"
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-slatepos-500 font-semibold mt-1">
                  {directBillAuthorizer.type === 'ADMIN'
                    ? 'Master PIN required to authorize settlement'
                    : `Each staff member must authorize with their own registered PIN`}
                </p>
              </div>

              {/* Modal Buttons */}
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingDirectBill}
                  onClick={() => {
                    setIsDirectBillAuthOpen(false);
                    setIsDirectBillOpen(true);
                  }}
                  className="flex-1 py-3 rounded-xl text-xs font-bold bg-slatepos-100 text-slatepos-700 hover:bg-slatepos-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDirectBill || directBillPin.length < 4}
                  className="flex-1 py-3 rounded-xl text-xs font-black bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 cursor-pointer shadow-md transition active:scale-98"
                >
                  {isSubmittingDirectBill ? 'Authorizing...' : 'Authorize & Print Bill 👁️'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Today's Total Sales Modal (Live Synced) */}
      {isTotalSalesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-zinc-200 space-y-4 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
              <Banknote className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-slatepos-950">Today&apos;s Total Sales</h3>
              <p className="text-xs text-slatepos-500 font-medium mt-0.5">
                Live synced daily sales ledger for today
              </p>
            </div>

            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200 space-y-3">
              <div className="border-b border-zinc-200 pb-2">
                <span className="text-[11px] font-extrabold uppercase text-zinc-500 tracking-wider block">
                  Completed Orders Today
                </span>
                <span className="text-2xl font-black text-slatepos-950 font-mono">
                  {todaySettledStats.completedCount} Orders
                </span>
              </div>

              <div>
                <span className="text-[11px] font-extrabold uppercase text-zinc-500 tracking-wider block">
                  Total Amount of All Orders
                </span>
                <span className="text-3xl font-black text-emerald-700 font-mono tracking-tight">
                  ₹{todaySettledStats.totalInr}
                </span>
              </div>

              <div className="pt-2 border-t border-zinc-200 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded-xl border border-zinc-200">
                  <span className="text-[10px] text-zinc-400 font-bold block">Cash Sales</span>
                  <span className="font-mono font-black text-zinc-900">₹{todaySettledStats.cashInr}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-zinc-200">
                  <span className="text-[10px] text-zinc-400 font-bold block">UPI / Online</span>
                  <span className="font-mono font-black text-zinc-900">₹{todaySettledStats.upiInr}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsTotalSalesModalOpen(false)}
              className="w-full py-3 rounded-xl bg-slatepos-900 hover:bg-slatepos-800 text-white font-black text-xs transition cursor-pointer active:scale-98"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add Dishes to Table Modal */}
      {isAddDishModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-base font-black text-zinc-900 flex items-center space-x-2">
                  <span>Add Dishes to Table</span>
                  <span className="px-2 py-0.5 rounded-lg bg-black text-white font-mono text-xs font-black">
                    {selectedTableCode}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500">Order will be placed directly and sent to Kitchen (KDS)</p>
              </div>
              <button
                onClick={() => setIsAddDishModalOpen(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-black hover:bg-zinc-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Search dishes */}
              <input
                type="text"
                value={addDishSearch}
                onChange={(e) => setAddDishSearch(e.target.value)}
                placeholder="Search dishes (e.g. Masala Dosa, Chicken 65)..."
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-xs text-zinc-900 font-medium focus:outline-none focus:border-black placeholder-zinc-400"
              />

              {/* Dishes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-1 border border-zinc-100 rounded-2xl bg-zinc-50/50">
                {filteredAddDishes.length === 0 ? (
                  <div className="col-span-full py-6 text-center text-xs text-zinc-400 font-medium">
                    No dishes found matching &quot;{addDishSearch}&quot;
                  </div>
                ) : (
                  filteredAddDishes.map((dish: any) => {
                    const inCart = addDishCart.find((it) => it.id === dish.id);
                    return (
                      <button
                        key={dish.id}
                        type="button"
                        onClick={() => handleAddDishAddItem(dish)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer active:scale-95 ${
                          inCart
                            ? 'border-brand-500 bg-brand-50/70 ring-1 ring-brand-500'
                            : 'border-zinc-200 bg-white hover:border-zinc-400'
                        }`}
                      >
                        <div>
                          <span className="font-extrabold text-xs text-zinc-900 block truncate">{dish.name}</span>
                          {dish.malayalamName && (
                            <span className="text-[10px] text-zinc-400 font-malayalam block truncate">{dish.malayalamName}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-100">
                          <span className="text-xs font-black text-zinc-900 font-mono">
                            ₹{(dish.pricePaise / 100).toFixed(0)}
                          </span>
                          {inCart ? (
                            <span className="px-1.5 py-0.5 rounded-md bg-brand-600 text-white font-black text-[10px]">
                              {inCart.qty}
                            </span>
                          ) : (
                            <span className="text-[11px] font-black text-zinc-400 hover:text-black">+</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Cart Items */}
              {addDishCart.length > 0 && (
                <div className="border border-zinc-200 rounded-2xl p-3 bg-white space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-zinc-500 pb-1 border-b border-zinc-100">
                    Dishes to Add ({addDishCart.reduce((sum, it) => sum + it.qty, 0)})
                  </div>
                  <div className="divide-y divide-zinc-100 max-h-36 overflow-y-auto">
                    {addDishCart.map((it) => (
                      <div key={it.id} className="py-1.5 flex items-center justify-between text-xs">
                        <div className="flex-1 pr-2">
                          <span className="font-bold text-zinc-900 block truncate">{it.name}</span>
                          <span className="text-[10px] font-mono text-zinc-500">₹{(it.pricePaise / 100).toFixed(0)} each</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleAddDishRemoveItem(it.id)}
                            className="w-6 h-6 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center font-black cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-mono font-black text-xs min-w-[16px] text-center">{it.qty}</span>
                          <button
                            type="button"
                            onClick={() => handleAddDishAddItem(it)}
                            className="w-6 h-6 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center font-black cursor-pointer"
                          >
                            +
                          </button>
                          <span className="font-mono font-black text-xs text-zinc-900 min-w-[50px] text-right">
                            ₹{((it.pricePaise * it.qty) / 100).toFixed(0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-zinc-400 block">Order Total</span>
                <span className="text-lg font-black text-zinc-900 font-mono">
                  {formatRupees(addDishTotalPaise)}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddDishModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingAddDish || addDishCart.length === 0}
                  onClick={handleSubmitAddDish}
                  className="px-5 py-2.5 rounded-xl bg-slatepos-900 hover:bg-slatepos-800 disabled:opacity-50 text-white text-xs font-black shadow-md transition cursor-pointer active:scale-95"
                >
                  {isSubmittingAddDish ? 'Placing Order...' : 'Send to Kitchen & Table'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Standby 58mm Thermal Print Container (used for test slips and zero-modal auto-prints) */}
      {!printedInvoice && thermalReceiptText && (
        <div className="hidden print:block" aria-hidden="true">
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-receipt, #printable-receipt * {
                visibility: visible !important;
              }
              #printable-receipt {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 58mm !important;
                max-width: 58mm !important;
                padding: 2px !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
                font-family: 'Courier New', Courier, monospace !important;
                font-size: 13px !important;
                font-weight: 700 !important;
                line-height: 1.35 !important;
                color: black !important;
                background: white !important;
              }
            }
          `}</style>
          <pre
            id="printable-receipt"
            className="font-mono text-[11px] leading-tight whitespace-pre bg-white text-black p-0 m-0"
          >
            {thermalReceiptText}
          </pre>
        </div>
      )}
    </div>
  );
}
