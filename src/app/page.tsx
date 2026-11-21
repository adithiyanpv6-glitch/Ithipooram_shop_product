'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Home, 
  UtensilsCrossed, 
  BarChart3, 
  MoreHorizontal, 
  Plus, 
  Grid3X3, 
  ChevronRight, 
  ChevronDown, 
  RefreshCw, 
  UserPlus, 
  ShieldCheck,
  ArrowUpRight, 
  ArrowLeft,
  LogOut, 
  Menu as MenuIcon,
  X,
  ChefHat,
  Check,
  BellRing,
  FileSpreadsheet,
  AlertCircle,
  Calendar,
  Receipt,
  ShoppingBag,
  Minus,
  Search,
  Printer,
  Lock
} from 'lucide-react';
import { apiRequest, getCurrentUser } from '../lib/api';

export default function RootHomePage() {
  const router = useRouter();

  // Authentication state
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Overview Data & Live Polling State
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningOrders, setRunningOrders] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);

  // UI State: Graph metric tab & range selector
  const [chartMetric, setChartMetric] = useState<'sales' | 'orders' | 'aov'>('sales');
  const [selectedRange, setSelectedRange] = useState<'today' | '7days' | 'month' | 'all'>('today');

  const [isDayCloseModalOpen, setIsDayCloseModalOpen] = useState(false);
  const [dayCloseLoading, setDayCloseLoading] = useState(false);
  const [dayCloseSummary, setDayCloseSummary] = useState<any | null>(null);
  const [dayClosePin, setDayClosePin] = useState('');
  const [dayClosePinError, setDayClosePinError] = useState<string | null>(null);

  // Waiter Manual Order Desk Modal State (for dine-in guests without smartphone/QR)
  const [isWaiterOrderModalOpen, setIsWaiterOrderModalOpen] = useState(false);
  const [waiterSelectedTable, setWaiterSelectedTable] = useState<string>('');
  const [waiterSearchQuery, setWaiterSearchQuery] = useState<string>('');
  const [waiterCart, setWaiterCart] = useState<Array<{ id: string; name: string; malayalamName?: string; pricePaise: number; qty: number }>>([]);
  const [menuCategories, setMenuCategories] = useState<any[]>([]);
  const [waiterSubmitting, setWaiterSubmitting] = useState(false);
  const [waiterNotice, setWaiterNotice] = useState<string | null>(null);

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

  const filteredDishes = useMemo(() => {
    if (!waiterSearchQuery.trim()) return allDishes;
    const q = waiterSearchQuery.toLowerCase();
    return allDishes.filter((d: any) => 
      (d.name && d.name.toLowerCase().includes(q)) || 
      (d.malayalamName && d.malayalamName.toLowerCase().includes(q)) ||
      (d.categoryName && d.categoryName.toLowerCase().includes(q))
    );
  }, [allDishes, waiterSearchQuery]);

  const waiterCartTotalPaise = useMemo(() => {
    return waiterCart.reduce((acc, it) => acc + (it.pricePaise * it.qty), 0);
  }, [waiterCart]);

  // Quick Direct Bill & Print Modal State
  const [isDirectBillModalOpen, setIsDirectBillModalOpen] = useState(false);
  const [directBillSearch, setDirectBillSearch] = useState('');
  const [directBillCart, setDirectBillCart] = useState<Array<{ id: string; name: string; malayalamName?: string; pricePaise: number; qty: number }>>([]);
  const [directBillPaymentMode, setDirectBillPaymentMode] = useState<'CASH' | 'UPI'>('CASH');
  const [directBillOrderType, setDirectBillOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>('TAKEAWAY');
  const [directBillTableCode, setDirectBillTableCode] = useState<string>('');
  const [isPreviewingDirectBill, setIsPreviewingDirectBill] = useState(false);
  const [isPrintingDirectBill, setIsPrintingDirectBill] = useState(false);
  const [directBillNotice, setDirectBillNotice] = useState<string | null>(null);
  const [printedDirectReceiptText, setPrintedDirectReceiptText] = useState<string | null>(null);
  const [lastSettledInvoice, setLastSettledInvoice] = useState<any | null>(null);

  // Quick Direct Bill Cashier Authorization States
  const [isHomeDirectAuthOpen, setIsHomeDirectAuthOpen] = useState(false);
  const [homeStaffUsers, setHomeStaffUsers] = useState<any[]>([]);
  const [homeAuthorizer, setHomeAuthorizer] = useState<{ id: string; name: string; type: 'ADMIN' | 'STAFF' }>({
    id: 'ADMIN',
    name: 'Administrator (Master PIN)',
    type: 'ADMIN',
  });
  const [homeAuthPin, setHomeAuthPin] = useState('');
  const [homeAuthPinError, setHomeAuthPinError] = useState<string | null>(null);

  // Load registered staff for Cashier Authorization
  useEffect(() => {
    fetch('/api/staff/sessions')
      .then((r) => r.json())
      .then((d) => {
        if (d?.staff && Array.isArray(d.staff)) {
          setHomeStaffUsers(d.staff);
        }
      })
      .catch(() => {});
  }, []);

  const availableDayDishes = useMemo(() => {
    return allDishes.filter((d: any) => d.isAvailable !== false);
  }, [allDishes]);

  const filteredDirectBillDishes = useMemo(() => {
    if (!directBillSearch.trim()) return availableDayDishes;
    const q = directBillSearch.toLowerCase();
    return availableDayDishes.filter((d: any) => 
      (d.name && d.name.toLowerCase().includes(q)) || 
      (d.malayalamName && d.malayalamName.toLowerCase().includes(q)) ||
      (d.categoryName && d.categoryName.toLowerCase().includes(q))
    );
  }, [availableDayDishes, directBillSearch]);

  const directBillTotalPaise = useMemo(() => {
    return directBillCart.reduce((acc, it) => acc + (it.pricePaise * it.qty), 0);
  }, [directBillCart]);

  // Auth Guard
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    setCurrentUser(user);
  }, [router]);

  // Load overview, running orders, and tables
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch real-time overview metrics & timeline for selected range
      const res = await apiRequest(`/admin/overview?range=${encodeURIComponent(selectedRange)}&date=${encodeURIComponent(selectedRange)}`);
      setData(res);

      // Fetch running (UNPAID / Active) orders
      try {
        const ordRes = await fetch('/api/orders?unpaidOnly=true');
        if (ordRes.ok) {
          const ordList = await ordRes.json();
          const savedSettled = typeof window !== 'undefined' ? localStorage.getItem('ithipooram_settled_order_ids') : null;
          const settledSet = new Set<string>(savedSettled ? JSON.parse(savedSettled) : []);

          setRunningOrders((prev) => {
            const activeFresh = (Array.isArray(ordList) ? ordList : []).filter(
              (o) => !settledSet.has(o.id) && o.paymentStatus !== 'PAID'
            );
            if (activeFresh.length === 0 && prev.length > 0) {
              const stillUnsettled = prev.filter(
                (o) => !settledSet.has(o.id) && o.paymentStatus !== 'PAID'
              );
              if (stillUnsettled.length > 0) return stillUnsettled;
            }
            return activeFresh;
          });
        }
      } catch (e) {}

      // Fetch tables
      try {
        const tblRes = await fetch('/api/tables');
        if (tblRes.ok) {
          const tblList = await tblRes.json();
          if (Array.isArray(tblList)) {
            setTables(tblList);
            if (typeof window !== 'undefined') {
              localStorage.setItem('ithipooram_custom_tables', JSON.stringify(tblList));
            }
          }
        }
      } catch (e) {}
      // Fetch active menu items for Waiter Order Desk
      try {
        const menuRes = await fetch('/api/menu');
        if (menuRes.ok) {
          const mData = await menuRes.json();
          if (Array.isArray(mData)) {
            setMenuCategories(mData);
          }
        }
      } catch (e) {}
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 4000);
    return () => clearInterval(interval);
  }, [selectedRange]);

  // Waiter Order Handlers
  const handleOpenWaiterOrderModal = () => {
    if (tables.length > 0 && !waiterSelectedTable) {
      setWaiterSelectedTable(tables[0].tableCode || 'T1');
    }
    setWaiterNotice(null);
    fetch('/api/menu', { cache: 'no-store' })
      .then((r) => r.json())
      .then((mData) => {
        if (Array.isArray(mData)) setMenuCategories(mData);
      })
      .catch(() => {});
    setIsWaiterOrderModalOpen(true);
  };

  const handleWaiterAddItem = (item: any) => {
    setWaiterCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      const itemPricePaise = item.pricePaise !== undefined ? item.pricePaise : (item.priceInr !== undefined ? Math.round(item.priceInr * 100) : 0);
      return [...prev, { id: item.id, name: item.name, malayalamName: item.malayalamName, pricePaise: itemPricePaise, qty: 1 }];
    });
  };

  const handleWaiterRemoveItem = (itemId: string) => {
    setWaiterCart((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (existing && existing.qty > 1) {
        return prev.map((i) => (i.id === itemId ? { ...i, qty: i.qty - 1 } : i));
      }
      return prev.filter((i) => i.id !== itemId);
    });
  };

  const handleSubmitWaiterOrder = async () => {
    if (!waiterSelectedTable) {
      alert('Please select a registered table.');
      return;
    }
    if (waiterCart.length === 0) {
      alert('Please select at least one dish for the order.');
      return;
    }

    try {
      setWaiterSubmitting(true);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableCode: waiterSelectedTable.toUpperCase(),
          items: waiterCart.map((i) => ({
            id: i.id,
            name: i.name,
            malayalamName: i.malayalamName,
            pricePaise: i.pricePaise,
            quantity: i.qty,
          })),
          notes: 'Waiter Counter Order',
        }),
      });

      if (res.ok) {
        setWaiterNotice(`✓ Order placed for Table ${waiterSelectedTable}! Sent to Kitchen (KDS) & Billing.`);
        setWaiterCart([]);
        await loadDashboardData();
        setTimeout(() => {
          setIsWaiterOrderModalOpen(false);
          setWaiterNotice(null);
        }, 1200);
      } else {
        alert('Failed to place order.');
      }
    } catch (e: any) {
      alert('Error placing order: ' + e.message);
    } finally {
      setWaiterSubmitting(false);
    }
  };

  // Quick Direct Bill Handlers
  const handleOpenDirectBillModal = () => {
    setDirectBillNotice(null);
    setDirectBillSearch('');
    setIsPreviewingDirectBill(false);
    setDirectBillOrderType('TAKEAWAY');
    setDirectBillTableCode('');
    fetch('/api/menu', { cache: 'no-store' })
      .then((r) => r.json())
      .then((mData) => {
        if (Array.isArray(mData)) setMenuCategories(mData);
      })
      .catch(() => {});
    setIsDirectBillModalOpen(true);
  };

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
          pricePaise: item.pricePaise !== undefined ? item.pricePaise : (item.priceInr !== undefined ? Math.round(item.priceInr * 100) : 0),
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

  const handleOpenHomeDirectAuth = () => {
    if (directBillCart.length === 0) {
      alert('Please select at least one dish.');
      return;
    }
    setHomeAuthPin('');
    setHomeAuthPinError(null);
    setIsDirectBillModalOpen(false);
    setIsHomeDirectAuthOpen(true);
  };

  const handleConfirmHomeDirectAuth = async () => {
    if (!homeAuthPin || homeAuthPin.length < 4) {
      setHomeAuthPinError(
        homeAuthorizer.type === 'ADMIN'
          ? 'Enter 4-digit Master Security PIN'
          : `Enter 4-digit PIN for ${homeAuthorizer.name}`
      );
      return;
    }

    try {
      setIsPrintingDirectBill(true);
      setHomeAuthPinError(null);

      const res = await fetch('/api/billing/quick-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: directBillCart,
          paymentMode: directBillPaymentMode,
          orderType: directBillOrderType,
          tableCode: directBillTableCode,
          tableName: directBillOrderType === 'TAKEAWAY' ? 'Takeaway' : (directBillTableCode ? `Table ${directBillTableCode}` : 'Dine-In'),
          cashierName: homeAuthorizer.name,
          cashierId: homeAuthorizer.id,
          authType: homeAuthorizer.type,
          pin: homeAuthPin,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to authorize bill');
      }

      setPrintedDirectReceiptText(data.thermalReceipt);
      setLastSettledInvoice(data.invoice || {
        invoiceNumber: data.invoiceNumber,
        grandTotalPaise: data.grandTotalPaise,
        paymentMode: directBillPaymentMode,
        items: [...directBillCart],
        cashierName: homeAuthorizer.name,
        dateStr: data.dateStr,
        timeStr: data.timeStr,
      });

      // Close auth modal and direct bill modal, and open bill preview!
      setIsHomeDirectAuthOpen(false);
      setIsDirectBillModalOpen(false);
      setIsPreviewingDirectBill(true);

      const totalInr = (data.grandTotalPaise / 100).toFixed(2);
      const printStatusText = data.btPrintStatus === 'SUCCESS' ? '✓ Printed via SEZNIK Bluetooth' : '✓ Bill Generated & Ready';
      setDirectBillNotice(`${printStatusText} (Inv #${data.invoiceNumber} • ₹${totalInr})`);

      // Refresh overview dashboard so real-time sales graph & KPIs immediately reflect this sale
      loadDashboardData();
    } catch (err: any) {
      setHomeAuthPinError(err.message || 'Authorization failed');
    } finally {
      setIsPrintingDirectBill(false);
    }
  };

  const handleDirectBillPrint = handleOpenHomeDirectAuth;

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ithipooram_user');
      localStorage.removeItem('ithipooram_token');
    }
    router.replace('/login');
  };

  
  // Confirm customer QR order (moves to ACCEPTED and sends to KDS)
  const handleConfirmOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action: 'CONFIRM', cashierName: 'Cashier' }),
      });
      if (res.ok) {
        await loadDashboardData();
      }
    } catch (e) {
      alert('Failed to confirm order');
    }
  };

  // Reject fake QR order (discards with 0 food wasted)
  const handleRejectOrder = async (orderId: string) => {
    if (!confirm('Decline this order as unverified / fake table?')) return;
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action: 'REJECT', cashierName: 'Cashier' }),
      });
      if (res.ok) {
        await loadDashboardData();
      }
    } catch (e) {
      alert('Failed to reject order');
    }
  };

  // Close Business Day (Generates Excel & Archives)
  const handleExecuteDayClose = async () => {
    if (!dayClosePin || dayClosePin.length < 4) {
      setDayClosePinError('Enter 4-digit Master Security PIN');
      return;
    }
    try {
      setDayCloseLoading(true);
      setDayClosePinError(null);
      const res = await fetch('/api/admin/day-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin: dayClosePin }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setDayCloseSummary(data.summary);

        // Instant Excel Download directly in user browser
        if (data.summary?.excelContent) {
          const blob = new Blob([data.summary.excelContent], { type: 'application/vnd.ms-excel' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = data.summary.excelFileName || `Daily_Report_${new Date().toISOString().slice(0, 10)}.xls`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }

        await loadDashboardData();
      } else {
        setDayClosePinError(data.error || data.message || 'Failed to close day');
      }
    } catch (e: any) {
      setDayClosePinError(e.message || 'Error closing day');
    } finally {
      setDayCloseLoading(false);
    }
  };

  const formatRupees = (paise: number = 0) => `₹ ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  // Metric computations from live database + resilient local storage for settled bills
  const settledFromStorage = useMemo(() => {
    if (typeof window === 'undefined') return { count: 0, totalPaise: 0 };
    try {
      const saved = localStorage.getItem('ithipooram_settled_invoices');
      if (saved) {
        const list: any[] = JSON.parse(saved);
        const todayStr = new Date().toDateString();
        const todayBills = list.filter((inv) => new Date(inv.settledAt || Date.now()).toDateString() === todayStr);
        const totalPaise = todayBills.reduce((acc, inv) => acc + (inv.grandTotalPaise || 0), 0);
        return { count: todayBills.length, totalPaise };
      }
    } catch (e) {}
    return { count: 0, totalPaise: 0 };
  }, [data]);

  const todaySalesPaise = Math.max(data?.kpis?.grossSalesPaise || 0, settledFromStorage.totalPaise);
  const todayOrdersCount = Math.max(data?.kpis?.paidOrdersCount || 0, settledFromStorage.count);
  const pendingQrOrders = runningOrders.filter((o) => o.fulfillmentStatus === 'PENDING_CONFIRMATION');
  const runningOrdersCount = runningOrders.length;
  const toCollectPaise = runningOrders.reduce((sum, o) => sum + (o.grandTotalPaise || o.subtotalPaise || 0), 0);
  const aovPaise = todayOrdersCount > 0 ? Math.round(todaySalesPaise / todayOrdersCount) : (todaySalesPaise || 0);

  // Available free tables (only show table numbers/codes when admin adds tables)
  const freeTables = useMemo(() => {
    const occupiedCodes = new Set(runningOrders.map((o) => (o.tableCode || '').toUpperCase()));
    return tables.filter((t) => !occupiedCodes.has((t.tableCode || '').toUpperCase()));
  }, [tables, runningOrders]);

  // Real-Time Dynamic Graph Computations
  const graphTimeline = useMemo(() => {
    if (data?.timeline && Array.isArray(data.timeline) && data.timeline.length > 0) {
      return data.timeline;
    }
    return [
      { label: '09:00', salesPaise: 0, ordersCount: 0, aovPaise: 0 },
      { label: '12:00', salesPaise: 0, ordersCount: 0, aovPaise: 0 },
      { label: '15:00', salesPaise: 0, ordersCount: 0, aovPaise: 0 },
      { label: '18:00', salesPaise: 0, ordersCount: 0, aovPaise: 0 },
      { label: '21:00', salesPaise: 0, ordersCount: 0, aovPaise: 0 },
      { label: '23:59', salesPaise: 0, ordersCount: 0, aovPaise: 0 },
    ];
  }, [data?.timeline]);

  const graphValues = useMemo(() => {
    return graphTimeline.map((item: any) => {
      if (chartMetric === 'sales') return Math.round((item.salesPaise || 0) / 100);
      if (chartMetric === 'orders') return item.ordersCount || 0;
      return Math.round((item.aovPaise || 0) / 100);
    });
  }, [graphTimeline, chartMetric]);

  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; val: number; label?: string } | null>(null);

  const maxGraphValue = useMemo(() => {
    const m = Math.max(...graphValues);
    if (m > 0) {
      if (chartMetric === 'orders') {
        return Math.max(m, 4);
      }
      return Math.ceil((m * 1.2) / 50) * 50;
    }
    return chartMetric === 'orders' ? 5 : 1000;
  }, [graphValues, chartMetric]);

  const yAxisTicks = useMemo(() => {
    if (chartMetric === 'orders') {
      const top = maxGraphValue;
      const step = Math.max(1, Math.round(top / 4));
      return [step * 4, step * 3, step * 2, step, 0];
    }
    return [
      maxGraphValue,
      Math.round(maxGraphValue * 0.75),
      Math.round(maxGraphValue * 0.5),
      Math.round(maxGraphValue * 0.25),
      0,
    ];
  }, [maxGraphValue, chartMetric]);

  const formatTick = (val: number) => {
    if (chartMetric === 'orders') return `${val}`;
    if (val >= 1000) return `₹ ${(val / 1000).toFixed(1)}k`;
    return `₹ ${val}`;
  };

  const svgCoordinates = useMemo(() => {
    const width = 480;
    const height = 150;
    const paddingX = 15;
    const bottomY = 140;
    const topY = 15;
    const len = graphValues.length;

    const points = graphValues.map((val: number, idx: number) => {
      const x = paddingX + (idx / Math.max(1, len - 1)) * (width - 2 * paddingX);
      const ratio = maxGraphValue > 0 ? val / maxGraphValue : 0;
      const y = bottomY - ratio * (bottomY - topY);
      return { x, y, val, label: graphTimeline[idx]?.label };
    });

    if (points.length === 0) return { pathD: '', areaD: '', points: [] as { x: number; y: number; val: number; label?: string }[] };

    const pathD = points.map((p: { x: number; y: number }, idx: number) => (idx === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ');
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    const areaD = `${pathD} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;

    return { pathD, areaD, points };
  }, [graphValues, maxGraphValue, graphTimeline]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0A0C10] flex flex-col md:flex-row font-sans selection:bg-zinc-800 selection:text-white">
      
      {/* ============================================================== */}
      {/* 1. LEFT SIDEBAR (PREMIUM BLACK, WHITE & GREY THEME)             */}
      {/* ============================================================== */}
      <aside className="hidden md:flex md:w-64 lg:w-72 bg-[#0C0E12] text-zinc-300 flex-col justify-between border-r border-zinc-800 shrink-0 select-none">
        
        {/* Top Brand Logo - Occupies Maximum Space ("Executive Admin Console" text removed) */}
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
              title="Sign out of terminal"
              className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-white transition shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Items (Home, Table, Items, Reports, More) */}
        <nav className="p-4 space-y-1.5 flex-1">
          {/* 1. Home (Active) */}
          <Link
            href="/"
            className="flex items-center space-x-3 px-3.5 py-3 rounded-2xl bg-white text-black font-extrabold text-sm shadow-md transition"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </Link>

          {/* 2. Table Option */}
          <Link
            href="/qr"
            className="flex items-center justify-between px-3.5 py-3 rounded-2xl text-zinc-400 hover:bg-zinc-900 hover:text-white font-bold text-sm transition"
          >
            <div className="flex items-center space-x-3">
              <Grid3X3 className="w-4 h-4" />
              <span>Table</span>
            </div>
            {tables.length > 0 && (
              <span className="text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                {tables.length}
              </span>
            )}
          </Link>

          {/* 3. Billing Option (Synced to Table Orders & POS Settlement) */}
          <Link
            href="/billing"
            className="flex items-center justify-between px-3.5 py-3 rounded-2xl text-zinc-400 hover:bg-zinc-900 hover:text-white font-bold text-sm transition"
          >
            <div className="flex items-center space-x-3">
              <Receipt className="w-4 h-4" />
              <span>Billing</span>
            </div>
            {runningOrdersCount > 0 && (
              <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                {runningOrdersCount}
              </span>
            )}
          </Link>

          {/* 4. Items (Live Menu) */}
          <Link
            href="/menu"
            className="flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-zinc-400 hover:bg-zinc-900 hover:text-white font-bold text-sm transition"
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Items</span>
          </Link>

          {/* Kitchen Display (KDS) */}
          <Link
            href="/kitchen"
            className="flex items-center justify-between px-3.5 py-3 rounded-2xl text-zinc-400 hover:bg-zinc-900 hover:text-white font-bold text-sm transition"
          >
            <div className="flex items-center space-x-3">
              <ChefHat className="w-4 h-4 text-orange-400" />
              <span>Kitchen (KDS)</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
          </Link>

          {/* 5. More */}
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

        {/* Bottom Actions: Print Bill & + Add Order Button & Restaurant Profile */}
        <div className="p-4 border-t border-zinc-800/80 space-y-2">
          <button
            onClick={handleOpenDirectBillModal}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-white hover:bg-zinc-100 text-black font-black text-xs shadow-md transition active:scale-98 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>Print Bill</span>
          </button>

          <button
            onClick={handleOpenWaiterOrderModal}
            className="w-full flex items-center justify-center py-2.5 px-4 rounded-2xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs shadow-sm transition active:scale-98 cursor-pointer"
          >
            <span>+ Add Order</span>
          </button>

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
            <button 
              onClick={handleSignOut}
              title="Sign Out"
              className="text-zinc-500 hover:text-white p-1"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. MOBILE TOP BAR HEADER (Large Brand Name, Starts from Left)  */}
      {/* ============================================================== */}
      <header className="md:hidden bg-[#0C0E12] text-white px-4 py-3 border-b border-zinc-800 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center justify-start">
          <img 
            src="/brand-calligraphy-uploaded.png" 
            alt="ഇത്തിപ്പൂരം" 
            className="h-12 sm:h-14 w-auto object-contain invert brightness-200"
          />
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleOpenDirectBillModal}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-100 text-black font-black text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer active:scale-95"
            title="Direct Quick Billing & Thermal Print"
          >
            <Printer className="w-3.5 h-3.5 text-black" />
            <span>Print Bill</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setWaiterNotice(null);
              setIsWaiterOrderModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs flex items-center space-x-1.5 shadow-xs cursor-pointer active:scale-95"
            title="Create Customer Table Order"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>Add Order</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 3. MAIN WORKSPACE AREA (Complete Scroll Down)                   */}
      {/* ============================================================== */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 overflow-y-auto pb-48 sm:pb-36">
        
        {/* Top Header Label with Large Home and English Date & Day */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-200/80">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight">Home</h1>
              {/* Prominent Day & Date Badge in English Only */}
              <div className="flex items-center space-x-2 text-xs font-extrabold text-zinc-800 bg-white px-3.5 py-1.5 rounded-2xl border border-zinc-300/80 shadow-xs">
                <Calendar className="w-4 h-4 text-black shrink-0" />
                <span>
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              href="/kitchen"
              className="px-3.5 py-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 text-xs font-black flex items-center space-x-1.5 transition shadow-xs"
              title="Open Kitchen Display System"
            >
              <ChefHat className="w-3.5 h-3.5 text-orange-600" />
              <span>Kitchen (KDS)</span>
            </Link>

            <button
              onClick={() => {
                setDayCloseSummary(null);
                setDayClosePin('');
                setDayClosePinError(null);
                setIsDayCloseModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-white text-xs font-black flex items-center space-x-2 transition shadow-md cursor-pointer active:scale-98"
              title="Close business day and export Excel document"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Close Day of Shift</span>
            </button>

            <button
              onClick={() => loadDashboardData()}
              className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 shadow-xs transition"
              title="Refresh live metrics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3 RECTANGLES WITH SALES REPORT                                  */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Today's Orders & Today's Sales */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200 shadow-xs hover:border-zinc-300 transition">
            <div className="grid grid-cols-2 divide-x divide-zinc-200">
              <div className="pr-4">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  TODAY&apos;S ORDERS
                </span>
                <div className="text-2xl sm:text-3xl font-black text-black mt-2 font-mono">
                  {todayOrdersCount}
                </div>
              </div>
              <div className="pl-4">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  TODAY&apos;S SALES
                </span>
                <div className="text-2xl sm:text-3xl font-black text-black mt-2 font-mono truncate" title={formatRupees(todaySalesPaise)}>
                  {formatRupees(todaySalesPaise)}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 font-semibold">
              <span>Settled in counter POS</span>
              <span className="text-emerald-700 font-bold">● Active</span>
            </div>
          </div>

          {/* Card 2: Running Orders & To Collect */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200 shadow-xs hover:border-zinc-300 transition">
            <div className="grid grid-cols-2 divide-x divide-zinc-200">
              <div className="pr-4">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  RUNNING ORDERS
                </span>
                <div className="text-2xl sm:text-3xl font-black text-black mt-2 font-mono">
                  {runningOrdersCount}
                </div>
              </div>
              <div className="pl-4">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  TO COLLECT
                </span>
                <div className="text-2xl sm:text-3xl font-black text-black mt-2 font-mono truncate" title={formatRupees(toCollectPaise)}>
                  {formatRupees(toCollectPaise)}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 font-semibold">
              <span>Live table orders unpaid</span>
              <span className="font-mono text-zinc-700 font-bold">{runningOrdersCount} Tables Active</span>
            </div>
          </div>

          {/* Card 3: Average Order Value */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200 shadow-xs hover:border-zinc-300 transition">
            <div>
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                AVERAGE ORDER VALUE
              </span>
              <div className="text-2xl sm:text-3xl font-black text-black mt-2 font-mono">
                {formatRupees(aovPaise)}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500 font-semibold">
              <span>Per customer check</span>
              <span className="text-zinc-800 font-bold">Standard Check Avg</span>
            </div>
          </div>

        </div>

        {/* ============================================================== */}
        {/* TWO-COLUMN WORKSPACE: ANALYTICS GRAPH (LEFT) & RIGHT WIDGETS   */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* LEFT 2 COLS: Clean Responsive Analytics Graph Container */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200 shadow-xs space-y-6">
            
            {/* Graph Header: Range Dropdown & Metric Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-100">
              <div className="flex items-center space-x-2">
                <div className="relative inline-block text-left">
                  <select
                    value={selectedRange}
                    onChange={(e: any) => setSelectedRange(e.target.value)}
                    className="appearance-none bg-zinc-50 border border-zinc-200 text-xs font-extrabold text-black py-2 pl-3.5 pr-8 rounded-xl focus:outline-none focus:border-black cursor-pointer shadow-xs"
                  >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="7days">Last 7 Days</option>
                    <option value="month">This Month</option>
                    <option value="all">All time</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-600">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-bold text-black shadow-xs">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <input
                    type="date"
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedRange(e.target.value as any);
                      }
                    }}
                    className="bg-transparent font-bold text-xs text-black cursor-pointer outline-none"
                    title="Pick any specific date from calendar"
                  />
                </div>
              </div>

              {/* Metric Toggle Buttons */}
              <div className="flex items-center space-x-1 bg-zinc-100 p-1 rounded-2xl">
                <button
                  onClick={() => setChartMetric('sales')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    chartMetric === 'sales'
                      ? 'bg-white text-black shadow-xs'
                      : 'text-zinc-600 hover:text-black'
                  }`}
                >
                  Total Sales
                </button>
                <button
                  onClick={() => setChartMetric('orders')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    chartMetric === 'orders'
                      ? 'bg-white text-black shadow-xs'
                      : 'text-zinc-600 hover:text-black'
                  }`}
                >
                  Total Orders
                </button>
                <button
                  onClick={() => setChartMetric('aov')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    chartMetric === 'aov'
                      ? 'bg-white text-black shadow-xs'
                      : 'text-zinc-600 hover:text-black'
                  }`}
                >
                  Average Order Value
                </button>
              </div>
            </div>

            {/* SVG Visual Smooth Curve Graph (Connected to real-time data) */}
            <div className="flex flex-col h-64 sm:h-72 w-full pt-4 pb-2 justify-between">
              <div className="relative flex-1 w-full">
                {/* Horizontal guide lines with dynamic Y-axis ticks */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-2">
                  {yAxisTicks.map((tick, i) => (
                    <div key={i} className="flex items-center text-[10px] font-mono font-bold text-zinc-400">
                      <span className="w-14 truncate">{formatTick(tick)}</span>
                      <div className={`flex-1 border-b ${i === yAxisTicks.length - 1 ? 'border-zinc-200' : 'border-dashed border-zinc-100'}`} />
                    </div>
                  ))}
                </div>

                {/* Dynamic SVG Area & Real-Time Line */}
                <div className="ml-14 h-full relative">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 480 150">
                    <defs>
                      <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0F172A" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#0F172A" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Shaded Area Under Curve */}
                    {svgCoordinates.areaD && (
                      <path d={svgCoordinates.areaD} fill="url(#curveGradient)" />
                    )}

                    {/* Real-time Line */}
                    {svgCoordinates.pathD && (
                      <path
                        d={svgCoordinates.pathD}
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Interactive Real-time Data Points & Touch Targets */}
                    {svgCoordinates.points.map((pt: { x: number; y: number; val: number; label?: string }, i: number) => (
                      <g 
                        key={i} 
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onTouchStart={() => setHoveredPoint(pt)}
                      >
                        {/* Invisible larger touch target */}
                        <circle cx={pt.x} cy={pt.y} r={14} fill="transparent" />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={hoveredPoint?.x === pt.x ? 6 : pt.val > 0 ? 4.5 : 3}
                          fill={hoveredPoint?.x === pt.x ? '#EA580C' : pt.val > 0 ? '#0F172A' : '#94A3B8'}
                          stroke="#FFFFFF"
                          strokeWidth={hoveredPoint?.x === pt.x ? 3 : 2}
                          className="transition-all duration-150"
                        />
                      </g>
                    ))}
                  </svg>

                  {/* Dynamic Tooltip Badge */}
                  {hoveredPoint && (
                    <div 
                      className="absolute -top-7 -translate-x-1/2 bg-black text-white px-2.5 py-1 rounded-xl text-[10px] font-black shadow-lg pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-100 flex items-center space-x-1.5 z-20"
                      style={{ left: `${(hoveredPoint.x / 480) * 100}%` }}
                    >
                      <span className="text-zinc-400">{hoveredPoint.label}:</span>
                      <span className="text-white">
                        {chartMetric === 'orders' ? `${hoveredPoint.val} Orders` : `₹ ${hoveredPoint.val}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* X-Axis Labels from Real-time Timeline */}
              <div className="flex justify-between text-[11px] font-mono font-bold text-zinc-500 pl-14 pt-2 border-t border-zinc-100 shrink-0">
                {graphTimeline.map((item: any, i: number) => (
                  <span key={i} className="text-center">{item.label}</span>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Master Security + Top Selling Items */}
          <div className="space-y-6">
            
            {/* Widget 1: System Security Status Card */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200 shadow-xs relative overflow-hidden">
              <div className="flex items-center space-x-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">Master Database Security</span>
              </div>

              <h3 className="text-base font-black text-black">Terminal Protected</h3>
              <p className="text-xs font-semibold text-zinc-500 mt-1 mb-5">
                Master Security PIN active. POS screens automatically re-authenticate when phone sleeps or turns off.
              </p>

              <Link
                href="/users#security"
                className="w-full py-2.5 px-4 rounded-2xl border-2 border-black hover:bg-black hover:text-white text-black font-extrabold text-xs flex items-center justify-center space-x-2 transition shadow-xs cursor-pointer active:scale-98"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Security &amp; PIN Settings</span>
              </Link>
            </div>

            {/* Widget 2: Top Selling Items (Synced dynamically with Customer Mobile QR Orders) */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <h3 className="text-xs sm:text-sm font-extrabold text-black">Top selling items (live sync)</h3>
                <div className="flex items-center space-x-4 text-[10px] font-extrabold text-zinc-400 uppercase">
                  <span>Sold</span>
                  <span>Revenue</span>
                </div>
              </div>

              <div className="divide-y divide-zinc-100 mt-2">
                {!data?.topSellingItems || data.topSellingItems.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-400 font-medium">
                    No customer orders placed yet today.
                  </div>
                ) : (
                  data.topSellingItems.slice(0, 5).map((it: any, idx: number) => (
                    <div key={it.name || idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 truncate pr-2">
                        <span className="text-[11px] font-mono font-bold text-zinc-400 w-4">
                          {idx + 1}.
                        </span>
                        <span className="font-extrabold text-zinc-900 truncate">{it.name}</span>
                      </div>
                      <div className="flex items-center space-x-5 shrink-0 font-mono text-right">
                        <span className="text-zinc-600 font-bold w-6">{it.quantity}</span>
                        <span className="font-extrabold text-black w-20">{formatRupees(it.totalPaise)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* Day Close Modal */}
      {isDayCloseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-black">End Shift &amp; Close Business Day</h3>
              </div>
              <button
                onClick={() => setIsDayCloseModalOpen(false)}
                className="text-zinc-400 hover:text-black p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!dayCloseSummary ? (
              <div className="space-y-4">
                <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
                  Closing the business day will reconcile today&apos;s cash &amp; UPI revenue, generate the permanent multi-sheet Excel spreadsheet in <span className="font-mono text-black font-bold">reports_archive/</span>, and reset active tables for tomorrow morning.
                </p>

                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-2 text-xs font-semibold">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Gross Sales Today:</span>
                    <span className="font-mono font-bold text-black">{formatRupees(todaySalesPaise)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Total Settled Bills:</span>
                    <span className="font-mono font-bold text-black">{todayOrdersCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Active Unpaid Tables:</span>
                    <span className="font-mono font-bold text-black">{runningOrdersCount}</span>
                  </div>
                </div>

                {/* Master PIN Authorization */}
                <div className="pt-1 text-left space-y-1.5">
                  <label className="text-xs font-black text-black block">
                    Authorize with Master Security PIN:
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={dayClosePin}
                    onChange={(e) => {
                      setDayClosePin(e.target.value);
                      setDayClosePinError(null);
                    }}
                    placeholder="Master Security PIN"
                    className="w-full text-center text-sm font-mono font-black tracking-widest py-2.5 px-3 rounded-xl bg-zinc-50 border border-zinc-300 focus:outline-none focus:border-black text-black"
                  />
                  {dayClosePinError && (
                    <p className="text-[11px] text-red-600 font-bold">{dayClosePinError}</p>
                  )}
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={() => {
                      setIsDayCloseModalOpen(false);
                      setDayClosePin('');
                      setDayClosePinError(null);
                    }}
                    className="flex-1 py-3 rounded-2xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteDayClose}
                    disabled={dayCloseLoading || dayClosePin.length < 4}
                    className="flex-1 py-3 rounded-2xl bg-black hover:bg-zinc-800 text-white font-black text-xs flex items-center justify-center space-x-1.5 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {dayCloseLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Confirm &amp; Export Excel</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-black">Business Day Closed Successfully!</h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    Excel report archived as <span className="font-mono font-bold text-black">{dayCloseSummary.excelFileName}</span>
                  </p>
                </div>

                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 text-xs space-y-1 text-left">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Total Sales:</span>
                    <span className="font-mono font-bold text-black">{formatRupees(dayCloseSummary.totalSalesPaise)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Cash:</span>
                    <span className="font-mono font-bold text-black">{formatRupees(dayCloseSummary.cashPaise)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">UPI:</span>
                    <span className="font-mono font-bold text-black">{formatRupees(dayCloseSummary.upiPaise)}</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsDayCloseModalOpen(false)}
                  className="w-full py-3 rounded-2xl bg-black text-white font-black text-xs hover:bg-zinc-800"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Waiter Manual Order Desk Modal (For Dine-in Guests without QR Code) */}
      {isWaiterOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-zinc-200 flex flex-col max-h-[92dvh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 shrink-0">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsWaiterOrderModalOpen(false)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition cursor-pointer active:scale-95"
                  title="Back to Previous Screen"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <h3 className="text-base sm:text-lg font-black text-black">Manual Order</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWaiterOrderModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-black flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
              {/* Notice Banner */}
              {waiterNotice && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{waiterNotice}</span>
                </div>
              )}

              {/* 1. Select Registered Table */}
              <div>
                <label className="block text-xs font-black text-zinc-900 uppercase tracking-wider mb-2">
                  Select Table
                </label>
                {tables && tables.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tables.map((t: any) => {
                      const code = t.tableCode || t.id;
                      const isSelected = waiterSelectedTable?.toUpperCase() === code?.toUpperCase();
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setWaiterSelectedTable(code)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                            isSelected
                              ? 'bg-black text-white shadow-sm ring-2 ring-zinc-900 ring-offset-1'
                              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200'
                          }`}
                        >
                          {code} {t.displayName && t.displayName !== code ? `(${t.displayName})` : ''}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 font-bold bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                    No registered tables found. Please add tables in the Table section first.
                  </p>
                )}
              </div>

              {/* 2. Select Dishes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                    Select Dishes
                  </label>
                  <span className="text-[11px] font-mono text-zinc-400 font-bold">
                    {filteredDishes.length} items
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    value={waiterSearchQuery}
                    onChange={(e) => setWaiterSearchQuery(e.target.value)}
                    placeholder="Search present menu..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold focus:outline-none focus:border-black text-zinc-900"
                  />
                  {waiterSearchQuery && (
                    <button
                      onClick={() => setWaiterSearchQuery('')}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-black text-xs font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Dish Selection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 border border-zinc-100 rounded-2xl bg-zinc-50/50">
                {filteredDishes.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-xs text-zinc-400 font-semibold">
                    No dishes found. Go to Menu to add or activate items.
                  </div>
                ) : (
                  filteredDishes.map((dish: any) => {
                    const inCart = waiterCart.find((c) => c.id === dish.id);
                    return (
                      <div
                        key={dish.id}
                        className="p-2.5 rounded-xl bg-white border border-zinc-200 flex items-center justify-between hover:border-zinc-400 transition"
                      >
                        <div className="truncate pr-2">
                          <p className="text-xs font-extrabold text-zinc-900 truncate">{dish.name}</p>
                          {dish.malayalamName && (
                            <p className="text-[10px] text-zinc-500 truncate">{dish.malayalamName}</p>
                          )}
                          <p className="text-[11px] font-mono font-bold text-black mt-0.5">
                            ₹{Math.round((dish.pricePaise !== undefined ? dish.pricePaise : (dish.priceInr ? dish.priceInr * 100 : 0)) / 100)}
                          </p>
                        </div>

                        {inCart ? (
                          <div className="flex items-center space-x-1.5 bg-black text-white px-2 py-1 rounded-lg shrink-0">
                            <button
                              type="button"
                              onClick={() => handleWaiterRemoveItem(dish.id)}
                              className="w-5 h-5 flex items-center justify-center hover:bg-zinc-800 rounded font-black text-sm"
                            >
                              -
                            </button>
                            <span className="text-xs font-mono font-black px-1">{inCart.qty}</span>
                            <button
                              type="button"
                              onClick={() => handleWaiterAddItem(dish)}
                              className="w-5 h-5 flex items-center justify-center hover:bg-zinc-800 rounded font-black text-sm"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleWaiterAddItem(dish)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-black hover:text-white text-zinc-800 font-extrabold text-xs transition cursor-pointer shrink-0"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Order Cart Drawer */}
              {waiterCart.length > 0 && (
                <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-zinc-800 pb-1 border-b border-zinc-200">
                    <span className="flex items-center space-x-1.5">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Order Items ({waiterCart.reduce((a, b) => a + b.qty, 0)})</span>
                    </span>
                    <span className="font-mono font-black text-black">
                      Total: ₹{Math.round(waiterCartTotalPaise / 100)}
                    </span>
                  </div>

                  <div className="max-h-28 overflow-y-auto space-y-1 text-xs">
                    {waiterCart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-zinc-700">
                        <span className="truncate pr-2 font-medium">
                          {item.qty}x {item.name}
                        </span>
                        <div className="flex items-center space-x-2 shrink-0 font-mono">
                          <span className="font-bold">₹{Math.round((item.pricePaise * item.qty) / 100)}</span>
                          <button
                            type="button"
                            onClick={() => handleWaiterRemoveItem(item.id)}
                            className="text-zinc-400 hover:text-red-600 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-zinc-100 flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setWaiterCart([]);
                  setIsWaiterOrderModalOpen(false);
                }}
                className="flex-1 py-3 rounded-2xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitWaiterOrder}
                disabled={waiterSubmitting || waiterCart.length === 0}
                className="flex-2 py-3 rounded-2xl bg-black hover:bg-zinc-800 text-white font-black text-xs flex items-center justify-center space-x-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                {waiterSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 text-emerald-400" />
                )}
                <span>
                  Place Order (Table {waiterSelectedTable || 'T1'})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. DIRECT QUICK PRINT BILL (FULL SCREEN VIEW)                   */}
      {/* ============================================================== */}
      {isDirectBillModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#F8F9FA] flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-150 text-black">
          {/* Top Full Screen Navigation Bar with Back Button */}
          <header className="bg-white border-b border-zinc-200 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 shadow-xs z-10">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  setDirectBillCart([]);
                  setIsDirectBillModalOpen(false);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-black font-extrabold text-xs transition cursor-pointer active:scale-95 shadow-xs"
                title="Back to Home Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <div className="h-6 w-px bg-zinc-200 hidden sm:block" />
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center">
                  <Printer className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-black leading-tight flex items-center space-x-2">
                    <span>Direct Print Bill</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      ⚡ Instant POS
                    </span>
                  </h2>
                  <p className="text-[11px] font-semibold text-zinc-500 hidden sm:block">
                    Select dishes available today &amp; print instant customer receipt
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {directBillCart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDirectBillCart([])}
                  className="px-3 py-1.5 rounded-xl border border-zinc-200 text-zinc-600 hover:text-red-600 hover:border-red-200 text-xs font-bold transition cursor-pointer"
                >
                  Clear Cart ({directBillCart.reduce((a, b) => a + b.qty, 0)})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setDirectBillCart([]);
                  setIsDirectBillModalOpen(false);
                }}
                className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-black flex items-center justify-center transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Full Screen Body: Two Column POS Layout */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* LEFT COLUMN: Dish Selection & Search */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white p-3 sm:p-5 border-b lg:border-b-0 lg:border-r border-zinc-200 space-y-3">
              {/* Notice Banner */}
              {directBillNotice && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2">
                    <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{directBillNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') window.print();
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    Reprint
                  </button>
                </div>
              )}

              {/* Search Bar */}
              <div className="relative shrink-0">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={directBillSearch}
                  onChange={(e) => setDirectBillSearch(e.target.value)}
                  placeholder="Search available dish / വിഭവം തിരയുക..."
                  className="w-full pl-10 pr-14 py-2.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs sm:text-sm font-semibold focus:outline-none focus:border-black text-zinc-900"
                />
                {directBillSearch && (
                  <button
                    type="button"
                    onClick={() => setDirectBillSearch('')}
                    className="absolute right-3.5 top-2.5 text-zinc-400 hover:text-black text-xs font-bold cursor-pointer px-2 py-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Dishes Grid: Touch-Friendly Responsive Full Screen Layout */}
              <div className="flex-1 overflow-y-auto p-1">
                {filteredDirectBillDishes.length === 0 ? (
                  <div className="py-20 text-center text-sm text-zinc-400 font-semibold">
                    No available dishes found for today.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                    {filteredDirectBillDishes.map((dish: any) => {
                      const inCart = directBillCart.find((c) => c.id === dish.id);
                      return (
                        <div
                          key={dish.id}
                          onClick={() => handleDirectBillAddItem(dish)}
                          className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between select-none ${
                            inCart
                              ? 'bg-zinc-50 border-black ring-2 ring-black shadow-sm'
                              : 'bg-white border-zinc-200 hover:border-zinc-400 hover:shadow-xs'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs sm:text-sm font-extrabold text-zinc-900 line-clamp-1">{dish.name}</p>
                            {dish.malayalamName && (
                              <p className="text-[11px] text-zinc-500 line-clamp-1">{dish.malayalamName}</p>
                            )}
                            <p className="text-sm font-mono font-black text-black pt-1">
                              ₹{Math.round((dish.pricePaise || (dish.priceInr ? dish.priceInr * 100 : 0)) / 100)}
                            </p>
                          </div>

                          <div className="pt-2.5 mt-auto">
                            {inCart ? (
                              <div
                                className="flex items-center justify-between bg-black text-white px-2.5 py-1.5 rounded-xl shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleDirectBillRemoveItem(dish.id)}
                                  className="w-6 h-6 flex items-center justify-center hover:bg-zinc-800 rounded font-black text-base"
                                >
                                  -
                                </button>
                                <span className="text-xs font-mono font-black px-2">{inCart.qty}</span>
                                <button
                                  type="button"
                                  onClick={() => handleDirectBillAddItem(dish)}
                                  className="w-6 h-6 flex items-center justify-center hover:bg-zinc-800 rounded font-black text-base"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDirectBillAddItem(dish);
                                }}
                                className="w-full py-1.5 rounded-xl bg-zinc-100 hover:bg-black hover:text-white text-zinc-800 font-extrabold text-xs transition cursor-pointer text-center"
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Order Details, Cart Items & Checkout */}
            <div className="w-full lg:w-96 xl:w-[420px] bg-zinc-50 flex flex-col shrink-0 border-l border-zinc-200">
              {/* Cart Items Header */}
              <div className="p-4 bg-white border-b border-zinc-200 flex items-center justify-between shrink-0">
                <span className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-zinc-700">
                  <ShoppingBag className="w-4 h-4 text-black" />
                  <span>Current Bill Items ({directBillCart.reduce((a, b) => a + b.qty, 0)})</span>
                </span>
                <span className="font-mono font-black text-base text-black">
                  ₹{(directBillTotalPaise / 100).toFixed(2)}
                </span>
              </div>

              {/* Scrollable Selected Items */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {directBillCart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400 space-y-2">
                    <Receipt className="w-10 h-10 stroke-1 text-zinc-300" />
                    <p className="text-xs font-bold">No dishes selected yet.</p>
                    <p className="text-[11px] text-zinc-400">Click any dish on the left to add it to this bill.</p>
                  </div>
                ) : (
                  directBillCart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-zinc-700 bg-white p-3 rounded-2xl border border-zinc-200/80 shadow-2xs">
                      <div className="truncate pr-2">
                        <p className="font-bold text-xs text-zinc-900 truncate">{item.name}</p>
                        <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                          {item.qty} × ₹{(item.pricePaise / 100).toFixed(0)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0 font-mono">
                        <span className="font-black text-sm text-black">₹{((item.pricePaise * item.qty) / 100).toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => handleDirectBillRemoveItem(item.id)}
                          className="text-zinc-400 hover:text-red-600 p-1 transition cursor-pointer rounded-lg hover:bg-zinc-100"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Order Settings & Sticky Checkout Bar */}
              <div className="p-4 bg-white border-t border-zinc-200 space-y-3 shrink-0">
                {/* Order Type Selection */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black text-zinc-500 uppercase tracking-wider block">Order Type</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDirectBillOrderType('TAKEAWAY')}
                      className={`py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                        directBillOrderType === 'TAKEAWAY'
                          ? 'bg-black text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                      }`}
                    >
                      <span>🛍️ Takeaway</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirectBillOrderType('DINE_IN')}
                      className={`py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                        directBillOrderType === 'DINE_IN'
                          ? 'bg-black text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                      }`}
                    >
                      <span>🍽️ Dine-In</span>
                    </button>
                  </div>
                </div>

                {/* Optional Table Selector for Dine-In */}
                {directBillOrderType === 'DINE_IN' && tables.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                      Select Dine-In Table:
                    </label>
                    <select
                      value={directBillTableCode}
                      onChange={(e) => setDirectBillTableCode(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl bg-zinc-50 border border-zinc-300 font-bold text-xs text-black focus:outline-none focus:border-black cursor-pointer"
                    >
                      <option value="">Counter Table / General Dine-In</option>
                      {tables.map((t) => (
                        <option key={t.tableCode} value={t.tableCode}>
                          {t.displayName || `Table ${t.tableCode}`} ({t.roomName || 'Dining Area'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Payment Mode */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black text-zinc-500 uppercase tracking-wider block">Payment Mode</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDirectBillPaymentMode('CASH')}
                      className={`py-2 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                        directBillPaymentMode === 'CASH'
                          ? 'bg-black text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                      }`}
                    >
                      <span>💵 Cash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirectBillPaymentMode('UPI')}
                      className={`py-2 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                        directBillPaymentMode === 'UPI'
                          ? 'bg-black text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                      }`}
                    >
                      <span>📱 UPI</span>
                    </button>
                  </div>
                </div>

                {/* Authorize & Settle Button */}
                <button
                  type="button"
                  onClick={handleOpenHomeDirectAuth}
                  disabled={directBillCart.length === 0}
                  className="w-full py-3.5 px-5 rounded-2xl bg-black hover:bg-zinc-800 text-white font-black text-sm flex items-center justify-center space-x-2 shadow-lg cursor-pointer disabled:opacity-40 transition active:scale-98"
                >
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>
                    Authorize &amp; Settle {directBillCart.length > 0 ? `(₹${(directBillTotalPaise / 100).toFixed(2)})` : ''}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Direct Bill Cashier Authorization Modal (Home Screen) */}
      {isHomeDirectAuthOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-zinc-200 text-center animate-in zoom-in-95 duration-150 my-auto">
            {/* Top Back Navigation Bar */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  setIsHomeDirectAuthOpen(false);
                  setIsDirectBillModalOpen(true);
                }}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition cursor-pointer active:scale-95"
                title="Back to Direct Print Bill"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Authorization</span>
              <div className="w-12" />
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-zinc-100 text-black flex items-center justify-center mx-auto mb-2.5">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-black">Cashier Authorization</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Select authorizing user and enter PIN to settle bill (₹{(directBillTotalPaise / 100).toFixed(2)}).
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmHomeDirectAuth();
              }}
              className="mt-3.5 space-y-3"
            >
              {homeAuthPinError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold text-left">
                  {homeAuthPinError}
                </div>
              )}

              {/* Select Who is Authorizing */}
              <div className="text-left space-y-1">
                <label className="block text-[11px] font-black uppercase text-zinc-700 tracking-wider">
                  Authorizing Person:
                </label>
                <select
                  value={homeAuthorizer.id}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHomeAuthPinError(null);
                    setHomeAuthPin('');
                    if (val === 'ADMIN') {
                      setHomeAuthorizer({ id: 'ADMIN', name: 'Administrator (Master PIN)', type: 'ADMIN' });
                    } else {
                      const st = homeStaffUsers.find((s: any) => s.id === val);
                      if (st) {
                        setHomeAuthorizer({ id: st.id, name: st.fullName || st.username, type: 'STAFF' });
                      }
                    }
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-50 border-2 border-zinc-300 font-bold text-xs text-black focus:outline-none focus:border-black cursor-pointer"
                >
                  <option value="ADMIN">👑 Administrator (Master PIN)</option>
                  {homeStaffUsers.map((st: any) => (
                    <option key={st.id} value={st.id}>
                      👤 {st.fullName || st.username} ({st.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* PIN Entering Area with Native Keyboard Support (No on-screen keypad) */}
              <div className="py-2">
                <label className="block text-[11px] font-bold text-zinc-700 mb-1.5 uppercase tracking-wider">
                  {homeAuthorizer.type === 'ADMIN'
                    ? 'Enter 4-Digit Master Security PIN:'
                    : `Enter PIN for ${homeAuthorizer.name}:`}
                </label>
                <div className="relative inline-block">
                  <input
                    type="password"
                    inputMode="numeric"
                    enterKeyHint="done"
                    maxLength={6}
                    value={homeAuthPin}
                    onChange={(e) => setHomeAuthPin(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirmHomeDirectAuth();
                      }
                    }}
                    placeholder="••••"
                    className="w-44 text-center text-3xl tracking-[0.4em] font-mono py-2.5 px-3 rounded-2xl border-2 border-black focus:outline-none bg-white text-black font-black shadow-inner"
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-zinc-500 font-semibold mt-1">
                  {homeAuthorizer.type === 'ADMIN'
                    ? 'Master Security PIN required to confirm settlement'
                    : `Each staff member must authorize with their own registered PIN`}
                </p>
              </div>

              {/* Modal Buttons */}
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  disabled={isPrintingDirectBill}
                  onClick={() => {
                    setIsHomeDirectAuthOpen(false);
                    setIsDirectBillModalOpen(true);
                  }}
                  className="flex-1 py-3 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPrintingDirectBill || homeAuthPin.length < 4}
                  className="flex-1 py-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer shadow-md transition active:scale-98"
                >
                  {isPrintingDirectBill ? 'Authorizing...' : 'Authorize & Print Bill 👁️'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Real Bill Preview Modal (Matching /billing Preview Screen) */}
      {isPreviewingDirectBill && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-zinc-200 flex flex-col max-h-[94dvh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Preview Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 shrink-0">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewingDirectBill(false)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-black text-xs font-bold transition cursor-pointer mr-1"
                  title="Back to Previous Screen"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <Receipt className="w-4 h-4 text-black" />
                <h3 className="text-sm font-black text-black">Official Bill Preview</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewingDirectBill(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-black flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Slip Preview (Exact /billing Slip Style) */}
            <div className="flex-1 overflow-y-auto py-3">
              <div className="bg-white text-black p-5 rounded-2xl border border-zinc-300 shadow-sm font-mono text-xs max-w-[340px] mx-auto space-y-3">
                <div className="text-center space-y-1">
                  <img
                    src="/brand-calligraphy-cropped.png"
                    alt="ഇത്തിപ്പൂരം"
                    className="h-10 w-auto mx-auto object-contain"
                  />
                  <p className="text-[10px] tracking-widest text-zinc-500 font-bold">VANCHIYOOR, TRIVANDRUM</p>
                </div>

                <div className="border-t border-dashed border-zinc-300 pt-2 text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Inv: {lastSettledInvoice?.invoiceNumber || 'INV-SETTLED'}</span>
                    <span>{lastSettledInvoice?.timeStr || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date: {lastSettledInvoice?.dateStr || new Date().toLocaleDateString('en-GB')}</span>
                    <span className="font-bold">
                      {directBillOrderType === 'TAKEAWAY' ? 'Takeaway' : (directBillTableCode ? `Table: ${directBillTableCode}` : 'Dine-In')}
                    </span>
                  </div>
                  <div>
                    <span>Cashier: {lastSettledInvoice?.cashierName || homeAuthorizer.name}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-zinc-300 pt-2">
                  <div className="flex justify-between font-bold text-[10px] uppercase text-zinc-500 pb-1 border-b border-zinc-200">
                    <span className="w-2/5">ITEM</span>
                    <span className="w-1/6 text-center">QTY</span>
                    <span className="w-1/5 text-right">RATE</span>
                    <span className="w-1/5 text-right">TOTAL</span>
                  </div>
                  <div className="divide-y divide-zinc-100 pt-1">
                    {directBillCart.map((it) => (
                      <div key={it.id} className="flex justify-between py-1 text-[11px]">
                        <span className="w-2/5 truncate">{it.name}</span>
                        <span className="w-1/6 text-center">{it.qty}</span>
                        <span className="w-1/5 text-right">₹{(it.pricePaise / 100).toFixed(0)}</span>
                        <span className="w-1/5 text-right font-bold">₹{((it.pricePaise * it.qty) / 100).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t-2 border-zinc-900 pt-2 space-y-1">
                  <div className="flex justify-between text-base font-black text-black">
                    <span>GRAND TOTAL:</span>
                    <span>₹{(directBillTotalPaise / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-600">
                    <span>Payment:</span>
                    <span className="font-bold uppercase">[{directBillPaymentMode}]</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-zinc-300 pt-3 text-center space-y-0.5">
                  <p className="font-bold text-xs">നന്ദി! വീണ്ടും വരിക</p>
                  <p className="text-[10px] text-zinc-500 tracking-wider">THANK YOU! VISIT AGAIN</p>
                </div>
              </div>
            </div>

            {/* Preview Footer Actions */}
            <div className="pt-3 border-t border-zinc-100 flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDirectBillCart([]);
                  setLastSettledInvoice(null);
                  setIsPreviewingDirectBill(false);
                }}
                className="py-3 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-900 cursor-pointer transition active:scale-95"
              >
                Close &amp; Done ✓
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (printedDirectReceiptText) {
                    await fetch('/api/printer/print', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        receiptText: printedDirectReceiptText,
                        receiptData: lastSettledInvoice,
                        printerName: 'B-41',
                      }),
                    }).catch(() => {});
                  }
                  if (typeof window !== 'undefined') {
                    window.print();
                  }
                }}
                disabled={isPrintingDirectBill}
                className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center space-x-2 shadow-md cursor-pointer disabled:opacity-50 transition active:scale-98"
              >
                <Printer className="w-4 h-4" />
                <span>🖨️ Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded 58mm Thermal Receipt for Browser/Direct Physical Printing */}
      {printedDirectReceiptText && (
        <div id="printable-direct-receipt" className="hidden print:block" aria-hidden="true">
          <style>{`
            @media print {
              @page {
                size: 58mm auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
                background: #fff;
                color: #000;
              }
              body * {
                visibility: hidden !important;
              }
              #printable-direct-receipt, #printable-direct-receipt * {
                visibility: visible !important;
              }
              #printable-direct-receipt {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 58mm !important;
                display: block !important;
                font-family: monospace !important;
                font-size: 11px !important;
                line-height: 1.25 !important;
                white-space: pre-wrap !important;
                padding: 4px 6px !important;
              }
            }
          `}</style>
          <pre>{printedDirectReceiptText}</pre>
        </div>
      )}
    </div>
  );
}
