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
  Plus, 
  ChevronRight, 
  LogOut, 
  Menu as MenuIcon, 
  X, 
  QrCode,
  Download,
  Trash2,
  ExternalLink,
  Layers,
  CheckCircle2,
  Printer,
  Receipt,
  Edit3,
  ArrowLeft
} from 'lucide-react';
import QRCode from 'qrcode';
import { getCurrentUser } from '../../lib/api';

export default function TablesManagementPage() {
  const router = useRouter();

  // Active Room Drill-Down: null means landing page (rooms list), string means viewing that room's tables
  const [activeRoomView, setActiveRoomView] = useState<string | null>(null);

  // Filter tab: 'all' | 'occupied' | 'empty'
  const [filterTab, setFilterTab] = useState<'all' | 'occupied' | 'empty'>('all');
  
  // Tables and Running Orders state
  const [tables, setTables] = useState<any[]>([]);
  const [runningOrders, setRunningOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Add Table Modal State (Enhanced with Previous Method's Range & Room Generation)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<'batch' | 'single'>('batch');
  const [roomName, setRoomName] = useState('AC Room');
  const [tablePrefix, setTablePrefix] = useState('T');
  const [startNumber, setStartNumber] = useState('1');
  const [tableCount, setTableCount] = useState('5');
  const [singleTableCode, setSingleTableCode] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [isSeatSharing, setIsSeatSharing] = useState(false);
  const [seatLettersInput, setSeatLettersInput] = useState('A, B, C, D');
  const [isGenerating, setIsGenerating] = useState(false);

  // Edit Table Modal State
  const [editingTable, setEditingTable] = useState<any | null>(null);
  const [editTableCode, setEditTableCode] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRoomName, setEditRoomName] = useState('');
  const [editCapacity, setEditCapacity] = useState('4');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // QR Stand Preview Modal State
  const [selectedTableForQr, setSelectedTableForQr] = useState<any | null>(null);
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string>('');

  // Today's Table Orders Tracking Modal State
  const [selectedTableForOrdersModal, setSelectedTableForOrdersModal] = useState<any | null>(null);
  const [todaySettledSales, setTodaySettledSales] = useState<any[]>([]);

  // Customer Base URL for Table QRs (Defaults to local origin or active tunnel)
  const PERMANENT_PUBLIC_URL = 'http://localhost:3000';
  const [customerBaseUrl, setCustomerBaseUrl] = useState<string>(PERMANENT_PUBLIC_URL);

  useEffect(() => {
    // 1. Resolve live public URL for QR codes
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
      const activePublicOrigin = isLocalhost ? PERMANENT_PUBLIC_URL : origin;

      const saved = localStorage.getItem('ithipooram_customer_qr_base_url');
      if (saved && saved.startsWith('http')) {
        setCustomerBaseUrl(saved);
      } else {
        setCustomerBaseUrl(activePublicOrigin);
        localStorage.setItem('ithipooram_customer_qr_base_url', activePublicOrigin);
      }
    }

    // 2. Check active registered tunnel or custom domain
    fetch('/api/tunnel/register')
      .then((r) => r.json())
      .then((d) => {
        if (d?.tunnelUrl && d.tunnelUrl.startsWith('http')) {
          setCustomerBaseUrl(d.tunnelUrl);
          if (typeof window !== 'undefined') {
            localStorage.setItem('ithipooram_customer_qr_base_url', d.tunnelUrl);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Load tables & running orders
  const loadData = async () => {
    try {
      setLoading(true);

      // Fetch tables from central API (persisted to disk)
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

      // Fetch active running orders
      const ordRes = await fetch('/api/orders?unpaidOnly=true');
      if (ordRes.ok) {
        const ordList = await ordRes.json();
        const savedSettled = typeof window !== 'undefined' ? localStorage.getItem('ithipooram_settled_order_ids') : null;
        const settledSet = new Set<string>(savedSettled ? JSON.parse(savedSettled) : []);

        setRunningOrders((prev) => {
          const fresh = (Array.isArray(ordList) ? ordList : []).filter(
            (o: any) => !settledSet.has(o.id) && !settledSet.has(o.customerCode) && o.paymentStatus !== 'PAID'
          );
          if (fresh.length === 0 && prev.length > 0) {
            const still = prev.filter(
              (o: any) => !settledSet.has(o.id) && !settledSet.has(o.customerCode) && o.paymentStatus !== 'PAID'
            );
            if (still.length > 0) return still;
          }
          return fresh;
        });
      }

      // Fetch today's settled sales for day-to-day table order storage & visibility
      try {
        const setRes = await fetch('/api/admin/daily-reports?date=today&format=json');
        if (setRes.ok) {
          const sd = await setRes.json();
          setTodaySettledSales(sd.salesData || sd.reports?.billingAuthorization || []);
        }
      } catch {}
    } catch (e) {
      console.error('Failed to load tables data:', e);
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
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ithipooram_custom_tables');
      if (saved && (saved.includes('T1A') || saved.includes('t-t1a-ac') || saved.includes('AC Room'))) {
        localStorage.removeItem('ithipooram_custom_tables');
      }
    }
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [router]);

  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ithipooram_user');
      localStorage.removeItem('ithipooram_token');
    }
    router.replace('/login');
  };

  // Preview generated table codes (with fully customizable seat sharing letters like A, B, C, D)
  const previewCodes = useMemo(() => {
    // Parse user-specified seat sharing letters/codes (e.g. "A, B, C, D", "A, B", "B, C", "D")
    const rawSeats = seatLettersInput
      .split(/[,/\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const activeSeats = rawSeats.length > 0 ? rawSeats : ['A', 'B'];

    if (addMode === 'single') {
      const code = (singleTableCode || `${tablePrefix}${startNumber}`).trim().toUpperCase();
      if (isSeatSharing) {
        return activeSeats.map((seat) => ({
          code: `${code}${seat}`,
          label: `${roomName} - Table ${code} (Seat ${seat})`,
        }));
      }
      return [{ code, label: `${roomName} - Table ${code}` }];
    }

    const start = parseInt(startNumber, 10) || 1;
    const count = Math.min(30, Math.max(1, parseInt(tableCount, 10) || 1));
    const prefix = tablePrefix.trim().toUpperCase();
    const list: Array<{ code: string; label: string }> = [];

    for (let i = 0; i < count; i++) {
      const num = start + i;
      if (isSeatSharing) {
        for (const seat of activeSeats) {
          const code = `${prefix}${num}${seat}`;
          list.push({ code, label: `${roomName} - Table ${num} (Seat ${seat})` });
        }
      } else {
        const code = `${prefix}${num}`;
        list.push({ code, label: `${roomName} - Table ${num}` });
      }
    }
    return list;
  }, [addMode, singleTableCode, tablePrefix, startNumber, tableCount, roomName, isSeatSharing, seatLettersInput]);

  // Edit Table handlers
  const handleOpenEditModal = (t: any) => {
    setEditingTable(t);
    setEditTableCode(t.tableCode || '');
    setEditDisplayName(t.displayName || '');
    setEditRoomName(t.roomName || 'AC Hall');
    setEditCapacity(String(t.capacity || 4));
    setIsEditModalOpen(true);
  };

  const handleSaveEditedTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable || !editTableCode.trim()) return;

    const oldCode = editingTable.tableCode.toUpperCase();
    const newCode = editTableCode.trim().toUpperCase();

    const updatedList = tables.map((t) => {
      if (t.tableCode.toUpperCase() === oldCode) {
        return {
          ...t,
          tableCode: newCode,
          displayName: editDisplayName.trim() || `${editRoomName} - Table ${newCode}`,
          roomName: editRoomName.trim(),
          capacity: parseInt(editCapacity, 10) || 4,
        };
      }
      return t;
    });

    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: updatedList, replace: true }),
      });

      if (res.ok) {
        setTables(updatedList);
        if (typeof window !== 'undefined') {
          localStorage.setItem('ithipooram_custom_tables', JSON.stringify(updatedList));
        }
        setIsEditModalOpen(false);
        setEditingTable(null);
      } else {
        alert('Failed to update table');
      }
    } catch (e) {
      alert('Error updating table');
    }
  };

  // Add tables handler (Supports both Batch and Single Table)
  const handleSaveTables = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewCodes.length === 0) return;
    setIsGenerating(true);

    try {
      const newTables = previewCodes.map((item) => ({
        tableCode: item.code,
        displayName: item.label,
        capacity: parseInt(capacity, 10) || 4,
        roomName: roomName.trim(),
      }));

      // Combine with existing (avoiding duplicate codes in same room)
      const existingFiltered = tables.filter(
        (t) => !newTables.some(
          (nt) => nt.tableCode.toUpperCase() === t.tableCode.toUpperCase() && 
                  (nt.roomName || '').toLowerCase() === (t.roomName || '').toLowerCase()
        )
      );
      const updatedList = [...existingFiltered, ...newTables];

      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: updatedList }),
      });

      if (res.ok) {
        const data = await res.json();
        const serverTables = Array.isArray(data.tables) ? data.tables : updatedList;
        setTables(serverTables);
        if (typeof window !== 'undefined') {
          localStorage.setItem('ithipooram_custom_tables', JSON.stringify(serverTables));
        }
        setIsAddModalOpen(false);
        setSingleTableCode('');
        setActiveRoomView(roomName.trim());
      } else {
        alert('Failed to save tables');
      }
    } catch (err) {
      alert('Error creating tables');
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete a table
  const handleDeleteTable = async (code: string) => {
    if (!confirm(`Are you sure you want to delete Table ${code.toUpperCase()}?`)) return;
    try {
      const res = await fetch(`/api/tables?tableCode=${encodeURIComponent(code)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const remaining = tables.filter((t) => t.tableCode.toUpperCase() !== code.toUpperCase());
        setTables(remaining);
        if (typeof window !== 'undefined') {
          localStorage.setItem('ithipooram_custom_tables', JSON.stringify(remaining));
        }
        if (selectedTableForQr?.tableCode?.toUpperCase() === code.toUpperCase()) {
          setSelectedTableForQr(null);
        }
      }
    } catch (e) {
      alert('Failed to delete table');
    }
  };

  // Open QR Stand Modal
  const handleOpenQrModal = async (tbl: any) => {
    setSelectedTableForQr(tbl);
    const code = (tbl.tableCode || '').toUpperCase();
    const targetUrl = `${customerBaseUrl}/order?table=${code}&room=${encodeURIComponent(tbl.roomName || 'Dine-In')}`;

    try {
      const qrUrl = await QRCode.toDataURL(targetUrl, {
        width: 500,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'H',
      });
      setGeneratedQrDataUrl(qrUrl);
    } catch (err) {
      console.error('Failed to generate QR:', err);
    }
  };

  // Download QR Code PNG
  const handleDownloadQr = () => {
    if (!generatedQrDataUrl || !selectedTableForQr) return;
    const a = document.createElement('a');
    a.href = generatedQrDataUrl;
    a.download = `IthiPooram_QR_Table_${selectedTableForQr.tableCode}.png`;
    a.click();
  };

  // Mapping active orders by tableCode
  const orderMap = useMemo(() => {
    const map: Record<string, any> = {};
    runningOrders.forEach((ord) => {
      const code = (ord.tableCode || '').toLowerCase();
      map[code] = ord;
    });
    return map;
  }, [runningOrders]);

  // All today's orders (both active running + settled) mapped by tableCode for day-to-day visibility
  const tableTodayOrdersMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    
    // Add running orders
    runningOrders.forEach((o) => {
      const code = (o.tableCode || '').toUpperCase();
      if (!map[code]) map[code] = [];
      map[code].push({
        id: o.id || o.customerCode,
        invoiceNumber: (o as any).invoiceNumber || o.customerCode,
        orderCode: o.customerCode,
        tableCode: code,
        status: 'UNPAID',
        grandTotalPaise: o.grandTotalPaise || 0,
        createdAt: o.createdAt || new Date().toISOString(),
        items: o.items || [],
        cashier: o.cashierName || 'Counter Cashier',
      });
    });

    // Add settled sales
    todaySettledSales.forEach((s) => {
      const code = (s.tableCode || '').toUpperCase();
      if (!map[code]) map[code] = [];
      const invNum = s.invoiceNumber || s.billNumber || s.orderCode;
      if (!map[code].some((ex) => ex.invoiceNumber === invNum || ex.orderCode === s.orderCode)) {
        map[code].push({
          id: s.id || invNum,
          invoiceNumber: invNum,
          orderCode: s.orderCode || invNum,
          tableCode: code,
          status: 'PAID',
          grandTotalPaise: s.grandTotalPaise !== undefined ? s.grandTotalPaise : ((s.grandTotalRupees || s.amountRupees || 0) * 100),
          createdAt: s.settledAt || s.printedAt || new Date().toISOString(),
          items: s.items || [],
          cashier: s.cashier || s.authorizedByStaffName || 'Cashier',
        });
      }
    });

    return map;
  }, [runningOrders, todaySettledSales]);

  // Unique rooms derived dynamically strictly from registered tables (No dummy pre-registered rooms)
  const availableRooms = useMemo(() => {
    const roomsSet = new Set<string>();
    tables.forEach((t) => {
      if (t.roomName && t.roomName.trim()) roomsSet.add(t.roomName.trim());
    });
    return Array.from(roomsSet);
  }, [tables]);

  // Tables belonging to the actively drilled-down room
  const currentRoomTables = useMemo(() => {
    if (!activeRoomView) return [];
    return tables.filter(
      (t) => (t.roomName || 'Dining Area').toLowerCase() === activeRoomView.toLowerCase()
    );
  }, [tables, activeRoomView]);

  // Filtered tables inside active room computation (by Occupancy Status)
  const filteredTables = useMemo(() => {
    return currentRoomTables.filter((t) => {
      const code = (t.tableCode || '').toLowerCase();
      const hasOrder = !!orderMap[code];

      if (filterTab === 'occupied') return hasOrder;
      if (filterTab === 'empty') return !hasOrder;
      return true; // 'all'
    });
  }, [currentRoomTables, filterTab, orderMap]);

  const roomOccupiedCount = useMemo(() => {
    return currentRoomTables.filter((t) => !!orderMap[(t.tableCode || '').toLowerCase()]).length;
  }, [currentRoomTables, orderMap]);

  const roomEmptyCount = currentRoomTables.length - roomOccupiedCount;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#0A0C10] flex flex-col md:flex-row font-sans selection:bg-zinc-800 selection:text-white">
      
      {/* ============================================================== */}
      {/* 1. LEFT SIDEBAR                                                 */}
      {/* ============================================================== */}
      <aside className="hidden md:flex md:w-64 lg:w-72 bg-[#0C0E12] text-zinc-300 flex-col justify-between border-r border-zinc-800 shrink-0 select-none">
        
        {/* Top Brand Logo - Occupies Maximum Space */}
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
            className="flex items-center space-x-3 px-3.5 py-3 rounded-2xl bg-white text-black font-extrabold text-sm shadow-md transition"
          >
            <Grid3X3 className="w-4 h-4" />
            <span>Table</span>
          </Link>

          {/* Dedicated Billing Link */}
          <Link
            href="/billing"
            className="flex items-center justify-between px-3.5 py-3 rounded-2xl text-zinc-400 hover:bg-zinc-900 hover:text-white font-bold text-sm transition"
          >
            <div className="flex items-center space-x-3">
              <Receipt className="w-4 h-4" />
              <span>Billing</span>
            </div>
            {runningOrders.length > 0 && (
              <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                {runningOrders.length}
              </span>
            )}
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
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. TOP MOBILE HEADER                                            */}
      {/* ============================================================== */}
      <div className="md:hidden bg-[#0C0E12] text-white p-4 flex items-center justify-between border-b border-zinc-800 sticky top-0 z-40">
        <Link href="/">
          <img 
            src="/brand-calligraphy-uploaded.png" 
            alt="ഇത്തിപ്പൂരം" 
            className="h-8 w-auto object-contain invert brightness-200"
          />
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-xl bg-zinc-800 text-zinc-200"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#0C0E12] border-b border-zinc-800 p-4 space-y-2 text-sm font-bold">
          <Link href="/" className="block py-2 text-zinc-300">Home</Link>
          <Link href="/qr" className="block py-2 text-white font-black">Table</Link>
          <Link href="/billing" className="block py-2 text-zinc-300">Billing</Link>
          <Link href="/menu" className="block py-2 text-zinc-300">Items</Link>
          <Link href="/users" className="block py-2 text-zinc-300">More</Link>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MAIN WORKSPACE                                               */}
      {/* ============================================================== */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-5 pb-36 sm:pb-32 overflow-y-auto">
        
        {/* ============================================================ */}
        {/* VIEW 1: LANDING PAGE — ROW 1 ADD TABLE + ROOMS LIST DOWN-WISE*/}
        {/* ============================================================ */}
        {activeRoomView === null && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center space-x-3">
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
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-black">Table Management</h1>
                <p className="text-xs font-semibold text-zinc-400 mt-0.5">
                  Select a room below to view its tables, manage seats, or print table QR stands
                </p>
              </div>
            </div>

            {/* ROW 1: ADD TABLE CARD (Covers the full first row) */}
            <button
              type="button"
              onClick={() => {
                setRoomName(availableRooms[0] || 'AC Room');
                setIsAddModalOpen(true);
              }}
              className="w-full text-left bg-black hover:bg-zinc-900 text-white p-5 rounded-2xl border-2 border-black shadow-md transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99]"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <Plus className="w-6 h-6 text-white stroke-[3]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white">Add Table</h2>
                  <p className="text-xs text-zinc-300 font-medium mt-0.5 leading-relaxed">
                    Register new tables, assign to a room (e.g. AC Room, Living Room), and auto-generate QR codes
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </button>

            {/* BELOW ROW 1: ROOMS LISTED ONE AFTER ANOTHER DOWN-WISE (Like More Option) */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  Rooms ({availableRooms.length})
                </span>
                <span className="text-[11px] font-semibold text-zinc-400">
                  {tables.length} Total Tables
                </span>
              </div>

              {availableRooms.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-zinc-200 rounded-2xl p-8 text-center text-zinc-500 space-y-2">
                  <Grid3X3 className="w-10 h-10 mx-auto text-zinc-300" />
                  <p className="text-sm font-black text-zinc-800">No rooms or tables registered yet</p>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Tables and rooms will only appear after you add them. Click &ldquo;Add Table&rdquo; above to register your hotel rooms and tables.
                  </p>
                </div>
              ) : (
                availableRooms.map((room) => {
                  const roomTables = tables.filter(
                    (t) => (t.roomName || 'Dining Area').toLowerCase() === room.toLowerCase()
                  );
                  const occupied = roomTables.filter((t) => !!orderMap[(t.tableCode || '').toLowerCase()]).length;
                  const empty = roomTables.length - occupied;

                  return (
                    <button
                      key={room}
                      type="button"
                      onClick={() => {
                        setActiveRoomView(room);
                        setFilterTab('all');
                      }}
                      className="w-full text-left bg-white hover:bg-zinc-50 p-5 rounded-2xl border-2 border-zinc-200 hover:border-black shadow-xs transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99]"
                    >
                      <div className="space-y-1.5 flex-1 pr-3">
                        <div className="flex items-center space-x-2.5">
                          <Layers className="w-5 h-5 text-black shrink-0" />
                          <h2 className="text-base sm:text-lg font-black text-black">{room}</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-500">
                          <span className="font-bold text-zinc-800">
                            {roomTables.length} {roomTables.length === 1 ? 'Table' : 'Tables'}
                          </span>
                          <span>•</span>
                          {occupied > 0 ? (
                            <span className="text-blue-600 font-bold">{occupied} Occupied</span>
                          ) : (
                            <span className="text-emerald-600 font-bold">All Available</span>
                          )}
                          {occupied > 0 && empty > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-zinc-500">{empty} Empty</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-xs font-bold text-zinc-400 group-hover:text-black transition hidden xs:inline">
                          View Tables
                        </span>
                        <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-black group-hover:translate-x-1 transition-all" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: ROOM DRILL-DOWN (Tables ONLY visible inside room)     */}
        {/* ============================================================ */}
        {activeRoomView !== null && (
          <div className="space-y-5">
            {/* Room Navigation Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setActiveRoomView(null)}
                  className="px-3 py-1.5 rounded-xl border border-zinc-300 hover:border-black bg-white hover:bg-zinc-100 text-black font-black text-xs flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Rooms</span>
                </button>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-black flex items-center space-x-2">
                    <span>{activeRoomView}</span>
                  </h1>
                  <p className="text-xs font-semibold text-zinc-400">
                    {currentRoomTables.length} tables registered in {activeRoomView}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                {/* Add Table inside this Room */}
                <button
                  onClick={() => {
                    setRoomName(activeRoomView);
                    setIsAddModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-2xl bg-black hover:bg-zinc-800 text-white font-extrabold text-xs flex items-center space-x-1.5 shadow-sm transition active:scale-98 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Add Table</span>
                </button>

                {/* Filter Pills for this room: All, Occupied, Empty */}
                <div className="inline-flex items-center p-1 bg-zinc-200/70 rounded-2xl text-xs font-bold text-zinc-600">
                  <button
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1 rounded-xl transition ${
                      filterTab === 'all'
                        ? 'bg-white text-blue-600 font-extrabold shadow-xs'
                        : 'hover:text-black'
                    }`}
                  >
                    All ({currentRoomTables.length})
                  </button>
                  <button
                    onClick={() => setFilterTab('occupied')}
                    className={`px-3 py-1 rounded-xl transition ${
                      filterTab === 'occupied'
                        ? 'bg-white text-blue-600 font-extrabold shadow-xs'
                        : 'hover:text-black'
                    }`}
                  >
                    Occupied ({roomOccupiedCount})
                  </button>
                  <button
                    onClick={() => setFilterTab('empty')}
                    className={`px-3 py-1 rounded-xl transition ${
                      filterTab === 'empty'
                        ? 'bg-white text-blue-600 font-extrabold shadow-xs'
                        : 'hover:text-black'
                    }`}
                  >
                    Empty ({roomEmptyCount})
                  </button>
                </div>
              </div>
            </div>

            {/* DINE-IN TABLES GRID (Visible ONLY inside this room) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              
              {/* 1. ADD TABLE CARD FOR THIS ROOM */}
              <button
                onClick={() => {
                  setRoomName(activeRoomView);
                  setIsAddModalOpen(true);
                }}
                className="h-28 rounded-3xl border-2 border-dashed border-zinc-300 hover:border-black bg-white hover:bg-zinc-50 flex flex-col items-center justify-center p-3 text-center transition cursor-pointer group shadow-xs active:scale-98"
              >
                <div className="w-8 h-8 rounded-full border border-zinc-400 group-hover:border-black flex items-center justify-center mb-1.5 transition">
                  <Plus className="w-4 h-4 text-zinc-500 group-hover:text-black" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-700 group-hover:text-black">
                  ADD TABLE
                </span>
              </button>

              {/* 2. Registered Tables in this room */}
              {filteredTables.map((t) => {
                const code = (t.tableCode || '').toUpperCase();
                const activeOrder = orderMap[code.toLowerCase()];
                const tableOrdersToday = tableTodayOrdersMap[code] || [];
                const settledToday = tableOrdersToday.filter((o) => o.status === 'PAID');
                const todayRevenuePaise = tableOrdersToday.reduce((sum, o) => sum + (o.grandTotalPaise || 0), 0);

                return (
                  <div
                    key={t.id || code}
                    className={`min-h-[140px] rounded-3xl p-3.5 flex flex-col justify-between border transition shadow-xs relative group ${
                      activeOrder
                        ? 'bg-white border-blue-500 shadow-blue-500/10'
                        : settledToday.length > 0
                        ? 'bg-white border-emerald-400'
                        : 'bg-white border-dashed border-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-black text-black font-mono">
                          {code}
                        </span>
                        <div className="flex items-center space-x-1">
                          {activeOrder && (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" title="Active Order Present" />
                          )}
                          <button
                            onClick={() => handleOpenQrModal(t)}
                            className="p-1 text-zinc-400 hover:text-black rounded-lg hover:bg-zinc-100 transition cursor-pointer"
                            title="View / Download Table QR"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-zinc-400 font-semibold block truncate">
                          {t.capacity || 4} Seats
                        </span>
                        {settledToday.length > 0 && (
                          <span className="text-[10px] font-bold text-emerald-600">
                            ✓ {settledToday.length} Settled
                          </span>
                        )}
                      </div>

                      {/* Day-to-Day Table Orders Button */}
                      {tableOrdersToday.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedTableForOrdersModal({ ...t, orders: tableOrdersToday })}
                          className="w-full mt-2 py-1 px-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[10px] font-black flex items-center justify-between transition cursor-pointer"
                          title="View all today's orders placed on this table"
                        >
                          <span className="truncate">📋 {tableOrdersToday.length} Today</span>
                          <span className="text-emerald-700 shrink-0 font-extrabold">₹{Math.round(todayRevenuePaise / 100)}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-zinc-100">
                      {activeOrder ? (
                        <Link
                          href="/billing"
                          className="text-xs font-black text-blue-600 hover:underline flex items-center space-x-0.5 truncate"
                        >
                          <span>₹{((activeOrder.grandTotalPaise || 0) / 100).toFixed(0)} Settle &rarr;</span>
                        </Link>
                      ) : (
                        <Link
                          href="/billing"
                          className="text-xs font-bold text-zinc-600 hover:text-black flex items-center space-x-0.5"
                        >
                          <span>Assign &rarr;</span>
                        </Link>
                      )}

                      <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleOpenEditModal(t)}
                          className="p-1 text-zinc-400 hover:text-black rounded hover:bg-zinc-100 transition cursor-pointer"
                          title="Edit Table Name / Seat"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteTable(t.tableCode)}
                          className="p-1 text-zinc-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer"
                          title="Delete Table"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        )}

      </main>

      {/* ============================================================== */}
      {/* ENHANCED ADD TABLE MODAL (FUNCTIONALITY OF PREVIOUS METHOD)      */}
      {/* ============================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 space-y-5">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div>
                <h3 className="font-black text-black text-base">Add Dining Tables</h3>
                <p className="text-[11px] text-zinc-400 font-semibold">
                  Configure single tables or generate batch ranges with QRs
                </p>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                className="text-zinc-400 hover:text-black p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Selector Pill: Batch / Range vs Single Table */}
            <div className="grid grid-cols-2 p-1 bg-zinc-100 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setAddMode('batch')}
                className={`py-2 rounded-xl transition ${
                  addMode === 'batch' ? 'bg-black text-white shadow-xs' : 'text-zinc-600 hover:text-black'
                }`}
              >
                Batch / Range (e.g. 5 Tables)
              </button>
              <button
                type="button"
                onClick={() => setAddMode('single')}
                className={`py-2 rounded-xl transition ${
                  addMode === 'single' ? 'bg-black text-white shadow-xs' : 'text-zinc-600 hover:text-black'
                }`}
              >
                Single Table (e.g. T1 / ac1)
              </button>
            </div>

            <form onSubmit={handleSaveTables} className="space-y-4 text-xs">
              
              {/* Room / Dining Section Preset Pills */}
              <div>
                <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Dining Area / Room:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {['Living Room', 'AC Room', 'Dining Area', 'Family Hall', 'Garden', 'Verandah'].map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setRoomName(preset)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition ${
                        roomName === preset 
                          ? 'bg-zinc-900 text-white border-zinc-900' 
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. AC Hall, Courtyard"
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 font-semibold text-black focus:outline-none focus:border-black"
                />
              </div>

              {/* Mode Specific Inputs */}
              {addMode === 'batch' ? (
                <div className="space-y-3 p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-bold text-zinc-600 text-[10px] uppercase mb-1">
                        Prefix:
                      </label>
                      <input
                        type="text"
                        value={tablePrefix}
                        onChange={(e) => setTablePrefix(e.target.value)}
                        placeholder="T"
                        className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono font-bold text-center text-black focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-600 text-[10px] uppercase mb-1">
                        Start No:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={startNumber}
                        onChange={(e) => setStartNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono font-bold text-center text-black focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-600 text-[10px] uppercase mb-1">
                        How Many:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={tableCount}
                        onChange={(e) => setTableCount(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono font-bold text-center text-black focus:border-black"
                      />
                    </div>
                  </div>

                </div>
              ) : (
                <div>
                  <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Table Name / Code:
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={singleTableCode}
                    onChange={(e) => setSingleTableCode(e.target.value)}
                    placeholder="e.g. T1 / ac1 / TQ1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 font-mono font-bold text-black focus:outline-none focus:border-black"
                  />
                </div>
              )}

              {/* Customizable Seat Sharing Section (Editable according to user wish: A, B, C, D...) */}
              <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-2.5">
                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isSeatSharing}
                    onChange={(e) => setIsSeatSharing(e.target.checked)}
                    className="w-4 h-4 accent-black rounded cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-black text-black block">
                      Enable Seat Sharing (Sub-Tables)
                    </span>
                    <span className="text-[10px] text-zinc-500 font-semibold block">
                      Generate individual QR codes for each seat (e.g. A, B, C, D)
                    </span>
                  </div>
                </label>

                {isSeatSharing && (
                  <div className="pt-2 border-t border-zinc-200/80 space-y-2.5 animate-in fade-in-50 duration-150">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-600">
                      Choose Preset or Type Your Own Seats:
                    </label>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'A, B', desc: '2 Seats' },
                        { label: 'A, B, C', desc: '3 Seats' },
                        { label: 'A, B, C, D', desc: '4 Seats' },
                        { label: 'B, C', desc: 'Custom' },
                        { label: 'D', desc: 'Seat D' },
                        { label: '1, 2, 3, 4', desc: 'Numeric' },
                      ].map((preset) => (
                        <button
                          type="button"
                          key={preset.label}
                          onClick={() => setSeatLettersInput(preset.label)}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold border transition cursor-pointer ${
                            seatLettersInput.trim() === preset.label
                              ? 'bg-black text-white border-black shadow-xs'
                              : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                          }`}
                        >
                          {preset.label} <span className="opacity-70 font-sans">({preset.desc})</span>
                        </button>
                      ))}
                    </div>

                    {/* Custom Editable Text Box */}
                    <div>
                      <span className="block text-[10px] text-zinc-500 font-bold uppercase mb-1">
                        Editable Seat Letters / Identifiers (comma-separated):
                      </span>
                      <input
                        type="text"
                        value={seatLettersInput}
                        onChange={(e) => setSeatLettersInput(e.target.value)}
                        placeholder="e.g. A, B, C or A, B, C, D or B, C"
                        className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono font-bold text-xs text-black focus:outline-none focus:border-black bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Seating Capacity */}
              <div>
                <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Seating Capacity per Table:
                </label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 font-mono font-bold text-black focus:outline-none focus:border-black"
                />
              </div>

              {/* Live Preview of Generated Tables */}
              <div>
                <span className="block font-bold text-zinc-500 text-[11px] uppercase tracking-wider mb-1.5">
                  Tables to be created ({previewCodes.length}):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-zinc-100 rounded-xl border border-zinc-200">
                  {previewCodes.map((item) => (
                    <span
                      key={item.code}
                      className="px-2 py-0.5 rounded-lg bg-white border border-zinc-300 font-mono font-bold text-[10px] text-black shadow-2xs"
                    >
                      {item.code}
                    </span>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex justify-end space-x-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-zinc-600 font-bold hover:bg-zinc-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating || previewCodes.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-white font-black transition disabled:opacity-50 cursor-pointer shadow-xs active:scale-98"
                >
                  {isGenerating ? 'Generating QRs...' : `Create ${previewCodes.length} Table(s)`}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TABLE QR STAND PREVIEW & DOWNLOAD MODAL                         */}
      {/* ============================================================== */}
      {selectedTableForQr && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-zinc-200 text-center space-y-4">
            
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Table QR Stand
              </span>
              <button 
                onClick={() => setSelectedTableForQr(null)}
                className="text-zinc-400 hover:text-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Acrylic Stand Card */}
            <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
              <div className="flex justify-center mb-1">
                <img 
                  src="/brand-calligraphy-uploaded.png" 
                  alt="ഇത്തിപ്പൂരം" 
                  className="h-9 w-auto object-contain"
                />
              </div>

              <div className="space-y-0.5">
                <h3 className="text-xl font-black font-mono text-black">
                  {selectedTableForQr.tableCode}
                </h3>
                <span className="text-xs font-bold text-zinc-500">
                  {selectedTableForQr.displayName || selectedTableForQr.roomName || 'Dine-In Table'}
                </span>
              </div>

              {/* Scannable QR Code */}
              {generatedQrDataUrl ? (
                <div className="flex justify-center py-2">
                  <img 
                    src={generatedQrDataUrl} 
                    alt={`QR Code for Table ${selectedTableForQr.tableCode}`} 
                    className="w-44 h-44 object-contain rounded-xl border border-zinc-200 bg-white p-2 shadow-xs"
                  />
                </div>
              ) : (
                <div className="w-44 h-44 flex items-center justify-center bg-white rounded-xl mx-auto border border-zinc-200">
                  <span className="text-xs font-mono text-zinc-400">Loading QR...</span>
                </div>
              )}

              <p className="text-[11px] text-zinc-600 font-bold font-sans">
                Scan to view menu &amp; order food from your phone
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={() => window.print()}
                className="w-full py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-white font-black text-xs flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Table Stand (Cut &amp; Paste on Table)</span>
              </button>

              <button
                onClick={handleDownloadQr}
                className="w-full py-2.5 rounded-xl border border-zinc-300 hover:border-black text-black font-black text-xs flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download QR Image (PNG)</span>
              </button>

              <div className="flex space-x-2">
                <a
                  href={`${customerBaseUrl}/order?table=${selectedTableForQr.tableCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 rounded-xl border border-zinc-200 hover:border-black text-black font-bold text-xs flex items-center justify-center space-x-1 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Test Link</span>
                </a>

                <button
                  onClick={() => handleDeleteTable(selectedTableForQr.tableCode)}
                  className="px-3.5 py-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 font-bold text-xs flex items-center justify-center space-x-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* EDIT TABLE MODAL (CUSTOMIZE TABLE CODE / SEAT SUFFIX)           */}
      {/* ============================================================== */}
      {isEditModalOpen && editingTable && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-zinc-200 text-xs text-black animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-black" />
                <h3 className="text-base font-black text-black">Edit Table / Seat</h3>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingTable(null);
                }}
                className="text-zinc-400 hover:text-black p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedTable} className="space-y-4">
              <div>
                <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Table Code / Seat (e.g. T1A, T1B, T1C, T1D):
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editTableCode}
                  onChange={(e) => setEditTableCode(e.target.value)}
                  placeholder="e.g. T1A or ac1"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 font-mono font-bold text-black focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Display Label:
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="e.g. AC Hall - Table 1 (Seat A)"
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 font-medium text-black focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Room Area:
                  </label>
                  <input
                    type="text"
                    value={editRoomName}
                    onChange={(e) => setEditRoomName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-semibold text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Capacity:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-mono font-bold text-black focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingTable(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-zinc-600 font-bold hover:bg-zinc-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-black hover:bg-zinc-800 text-white font-black transition shadow-xs cursor-pointer active:scale-98"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TODAY'S TABLE ORDERS MODAL (DAY-TO-DAY ORDER STORAGE & HISTORY) */}
      {/* ============================================================== */}
      {selectedTableForOrdersModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 text-xs text-black animate-in zoom-in-95 duration-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-3 shrink-0">
              <div>
                <h3 className="text-base font-black text-black flex items-center space-x-2">
                  <span>Table {selectedTableForOrdersModal.tableCode}</span>
                  <span className="text-xs font-semibold text-zinc-500">
                    ({selectedTableForOrdersModal.roomName || 'Dining Area'})
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-400 font-medium">
                  All today&apos;s orders placed through this table ({selectedTableForOrdersModal.orders?.length || 0} Total)
                </p>
              </div>
              <button
                onClick={() => setSelectedTableForOrdersModal(null)}
                className="text-zinc-400 hover:text-black p-1.5 rounded-xl hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Orders List for this Table Today */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {(!selectedTableForOrdersModal.orders || selectedTableForOrdersModal.orders.length === 0) ? (
                <div className="py-12 text-center text-zinc-400">
                  <Receipt className="w-10 h-10 mx-auto text-zinc-300 mb-2" />
                  <p className="text-xs font-bold text-zinc-600">No orders recorded for this table today</p>
                </div>
              ) : (
                selectedTableForOrdersModal.orders.map((ord: any, idx: number) => {
                  const isPaid = ord.status === 'PAID';
                  const orderTime = ord.createdAt 
                    ? new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Today';

                  return (
                    <div 
                      key={ord.id || idx}
                      className={`p-3.5 rounded-2xl border transition ${
                        isPaid ? 'border-emerald-200 bg-emerald-50/40' : 'border-blue-200 bg-blue-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-black text-sm text-black">
                              {ord.invoiceNumber || ord.orderCode}
                            </span>
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isPaid
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-blue-600 text-white animate-pulse'
                              }`}
                            >
                              {isPaid ? 'Settled (Paid)' : 'Running (Active)'}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-semibold">
                            {orderTime} • Cashier: {ord.cashier || 'Counter'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-black">
                            ₹{((ord.grandTotalPaise || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="mt-2 space-y-1">
                        {(ord.items || []).map((it: any, iIdx: number) => (
                          <div key={iIdx} className="flex justify-between text-xs text-zinc-700">
                            <span className="truncate pr-2">
                              {it.quantity || it.qty || 1}x {it.itemNameSnapshot || it.itemName || it.name}
                            </span>
                            <span className="font-bold text-zinc-900 shrink-0">
                              ₹{Math.round(((it.lineTotalPaise || (it.pricePaise || 0) * (it.quantity || 1)) / 100))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-zinc-100 flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-zinc-500">
                Total Revenue: <span className="text-black font-black font-mono">
                  ₹{Math.round((selectedTableForOrdersModal.orders || []).reduce((s: number, o: any) => s + (o.grandTotalPaise || 0), 0) / 100)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedTableForOrdersModal(null)}
                className="px-4 py-2 rounded-xl bg-black text-white font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
