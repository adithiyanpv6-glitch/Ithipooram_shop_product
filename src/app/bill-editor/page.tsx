'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Printer, 
  Save, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Check, 
  Smartphone, 
  Sliders, 
  ZoomIn, 
  ZoomOut,
  Type,
  FileText
} from 'lucide-react';

interface BillItem {
  id: string;
  name: string;
  qty: number;
  rate: number;
  total: number;
}

export default function BillEditorPage() {
  // Layout & Typography Settings (Stepped Up Large Fonts)
  const [baseFontSize, setBaseFontSize] = useState<number>(17);
  const [itemFontSize, setItemFontSize] = useState<number>(18);
  const [totalFontSize, setTotalFontSize] = useState<number>(34);
  const [metaFontSize, setMetaFontSize] = useState<number>(16);
  const [lineSpacing, setLineSpacing] = useState<'compact' | 'normal' | 'relaxed'>('relaxed');

  // Receipt Content
  const [placeName, setPlaceName] = useState<string>('Vanchiyoor, Trivandrum');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('20261115-001');
  const [dateStr, setDateStr] = useState<string>(new Date().toLocaleDateString('en-IN'));
  const [timeStr, setTimeStr] = useState<string>(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
  const [tableName, setTableName] = useState<string>('AC Room - Table 1');
  const [cashierName, setCashierName] = useState<string>('Rahul');
  const [paymentMode, setPaymentMode] = useState<string>('CASH');

  // Items
  const [items, setItems] = useState<BillItem[]>([
    { id: '1', name: 'Chicken Biryani', qty: 1, rate: 180, total: 180 },
    { id: '2', name: 'Lime Juice', qty: 2, rate: 40, total: 80 },
  ]);

  // Feedback states
  const [statusNotice, setStatusNotice] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Grand Total calculation
  const grandTotal = items.reduce((acc, it) => acc + (it.total || 0), 0);

  // Load saved settings from server on mount
  useEffect(() => {
    fetch('/api/billing/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d?.settings) {
          const s = d.settings;
          if (s.itemSize) setItemFontSize(s.itemSize);
          if (s.grandTotalSize) setTotalFontSize(s.grandTotalSize);
          if (s.metadataSize) setMetaFontSize(s.metadataSize);
          if (s.baseFontSize) setBaseFontSize(s.baseFontSize);
          if (s.placeName) setPlaceName(s.placeName);
          if (s.lineSpacing) setLineSpacing(s.lineSpacing);
        }
      })
      .catch(() => {});
  }, []);

  const handleAddItem = () => {
    const newItem: BillItem = {
      id: `it-${Date.now()}`,
      name: 'Special Dish',
      qty: 1,
      rate: 120,
      total: 120,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof BillItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };
        if (field === 'qty' || field === 'rate') {
          const q = Number(field === 'qty' ? value : it.qty) || 1;
          const r = Number(field === 'rate' ? value : it.rate) || 0;
          updated.total = q * r;
        }
        return updated;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      alert('At least 1 item is required on the receipt.');
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Save customized font sizes and settings to POS database
  const handleSaveToPOS = async () => {
    try {
      setIsSaving(true);
      const payload = {
        itemSize: itemFontSize,
        grandTotalSize: totalFontSize,
        metadataSize: metaFontSize,
        baseFontSize,
        placeName,
        lineSpacing,
      };
      const res = await fetch('/api/billing/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setStatusNotice({ text: '✓ Finalized! POS billing and receipts are now updated with these exact font sizes.', type: 'success' });
        setTimeout(() => setStatusNotice(null), 4000);
      } else {
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err: any) {
      setStatusNotice({ text: `Save error: ${err.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Test Print directly to SEZNIK Bluetooth printer
  const handlePrintToSeznik = async () => {
    try {
      setIsPrinting(true);
      setStatusNotice({ text: 'Sending bill to SEZNIK Bluetooth printer...', type: 'info' });

      const itemLines = items.map((i) => {
        const rawName = (i.name || 'Item').trim();
        const name = rawName.length > 16 ? rawName.substring(0, 16) : rawName.padEnd(16);
        const qty = String(i.qty).padStart(3);
        const rate = String(i.rate).padStart(5);
        const tot = String(i.total).padStart(5);
        return `${name} ${qty} ${rate} ${tot}`;
      }).join('\n');

      const receiptText = [
        '================================',
        '          ഇത്തിപ്പൂരം',
        '          ITHI POORAM',
        `     ${placeName}`,
        '================================',
        `Inv: ${invoiceNumber}`,
        `Date: ${dateStr}  Time: ${timeStr}`,
        `Table: ${tableName}`,
        `Cashier: ${cashierName}`,
        '--------------------------------',
        'ITEM             QTY  RATE TOTAL',
        '--------------------------------',
        itemLines,
        '--------------------------------',
        `GRAND TOTAL:           Rs.${grandTotal.toFixed(2).padStart(8)}`,
        `Payment: [${paymentMode.toUpperCase()}]`,
        '================================',
        '      നന്ദി! വീണ്ടും വരിക',
        '     Thank You! Visit Again',
        '================================',
      ].join('\n');

      const res = await fetch('/api/printer/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          receiptText, 
          receiptData: {
            invoiceNumber,
            dateStr,
            timeStr,
            tableCode: tableName,
            cashierName,
            placeName,
            paymentMode,
            grandTotal: grandTotal.toFixed(2),
            items: items.map((it) => ({
              name: it.name,
              qty: it.qty,
              rate: it.rate,
              total: it.total,
            })),
          },
          printerName: 'SEZNIK' 
        }),
      });
      const d = await res.json();

      if (d.success) {
        setStatusNotice({ text: '🖨️ Bill printed successfully on SEZNIK! Check physical paper.', type: 'success' });
        setTimeout(() => setStatusNotice(null), 4000);
      } else {
        throw new Error(d.error || 'Printer communication failed');
      }
    } catch (err: any) {
      setStatusNotice({ text: `Print failed: ${err.message}. Make sure SEZNIK is turned ON and Bluetooth is paired.`, type: 'error' });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleResetDefaults = () => {
    setItemFontSize(16);
    setTotalFontSize(28);
    setMetaFontSize(14);
    setPlaceName('Vanchiyoor, Trivandrum');
    setLineSpacing('relaxed');
    setStatusNotice({ text: 'Reset to standard large typography defaults.', type: 'info' });
    setTimeout(() => setStatusNotice(null), 2500);
  };

  return (
    <div className="min-h-screen bg-parchment-100 flex flex-col font-sans text-slatepos-950 pb-16">
      {/* Top Bar */}
      <header className="bg-slatepos-900 border-b border-slatepos-800 text-white px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center space-x-3">
          <Link
            href="/billing"
            className="p-2 rounded-xl bg-slatepos-800 hover:bg-slatepos-700 text-slatepos-300 transition cursor-pointer"
            title="Back to POS Billing"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-wide text-white uppercase flex items-center space-x-2">
              <span>Bill WYSIWYG Editor</span>
            </h1>
            <p className="text-[11px] text-slatepos-400 hidden sm:block">
              Click directly on the receipt to edit text, scale fonts, and test print physically
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slatepos-800 hover:bg-slatepos-700 text-slatepos-300 transition cursor-pointer flex items-center space-x-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={handlePrintToSeznik}
            disabled={isPrinting}
            className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition active:scale-95 cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? 'Printing...' : 'Print to SEZNIK'}</span>
          </button>

          <button
            onClick={handleSaveToPOS}
            disabled={isSaving}
            className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black bg-brand-600 hover:bg-brand-500 text-white shadow-md transition active:scale-95 cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save & Finalize'}</span>
          </button>
        </div>
      </header>

      {/* Floating Status Notification */}
      {statusNotice && (
        <div
          className={`px-4 py-2.5 text-center text-xs font-black shadow-md sticky top-[57px] z-25 flex items-center justify-center space-x-2 animate-fade-in ${
            statusNotice.type === 'success'
              ? 'bg-emerald-600 text-white'
              : statusNotice.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-blue-600 text-white'
          }`}
        >
          <span>{statusNotice.text}</span>
        </div>
      )}

      {/* Main Workspace: Left Controls + Right Live Receipt */}
      <div className="max-w-6xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Quick Font Size Scaling Card */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-parchment-200 space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-parchment-200">
              <Sliders className="w-4 h-4 text-brand-600" />
              <h2 className="text-sm font-black uppercase tracking-wider text-slatepos-950">
                Font Size Controls
              </h2>
            </div>

            {/* Presets */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slatepos-600 mb-1.5">
                Size Presets:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Normal', item: 13, meta: 12, total: 22 },
                  { label: '★ Large', item: 16, meta: 14, total: 28 },
                  { label: '🔥 XL', item: 19, meta: 16, total: 34 },
                ].map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setItemFontSize(p.item);
                      setMetaFontSize(p.meta);
                      setTotalFontSize(p.total);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer active:scale-95 ${
                      itemFontSize === p.item
                        ? 'border-brand-600 bg-brand-50 text-brand-800 shadow-2xs font-black'
                        : 'border-parchment-300 text-slatepos-700 hover:bg-parchment-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Item Font Size */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slatepos-800">
                <span>Items &amp; Dish Names:</span>
                <span className="font-mono text-brand-700 font-black">{itemFontSize}px</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setItemFontSize((v) => Math.max(12, v - 1))}
                  className="w-8 h-8 rounded-lg bg-parchment-100 hover:bg-parchment-200 text-slatepos-900 font-black flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <input
                  type="range"
                  min="12"
                  max="22"
                  value={itemFontSize}
                  onChange={(e) => setItemFontSize(Number(e.target.value))}
                  className="flex-1 accent-brand-600 cursor-pointer"
                />
                <button
                  onClick={() => setItemFontSize((v) => Math.min(22, v + 1))}
                  className="w-8 h-8 rounded-lg bg-parchment-100 hover:bg-parchment-200 text-slatepos-900 font-black flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Grand Total Amount Size */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slatepos-800">
                <span>Grand Total Amount:</span>
                <span className="font-mono text-brand-700 font-black">{totalFontSize}px</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setTotalFontSize((v) => Math.max(18, v - 2))}
                  className="w-8 h-8 rounded-lg bg-parchment-100 hover:bg-parchment-200 text-slatepos-900 font-black flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <input
                  type="range"
                  min="18"
                  max="38"
                  value={totalFontSize}
                  onChange={(e) => setTotalFontSize(Number(e.target.value))}
                  className="flex-1 accent-brand-600 cursor-pointer"
                />
                <button
                  onClick={() => setTotalFontSize((v) => Math.min(38, v + 2))}
                  className="w-8 h-8 rounded-lg bg-parchment-100 hover:bg-parchment-200 text-slatepos-900 font-black flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Table & Info Size */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-slatepos-800">
                <span>Table &amp; Cashier Info:</span>
                <span className="font-mono text-brand-700 font-black">{metaFontSize}px</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setMetaFontSize((v) => Math.max(12, v - 1))}
                  className="w-8 h-8 rounded-lg bg-parchment-100 hover:bg-parchment-200 text-slatepos-900 font-black flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <input
                  type="range"
                  min="12"
                  max="20"
                  value={metaFontSize}
                  onChange={(e) => setMetaFontSize(Number(e.target.value))}
                  className="flex-1 accent-brand-600 cursor-pointer"
                />
                <button
                  onClick={() => setMetaFontSize((v) => Math.min(20, v + 1))}
                  className="w-8 h-8 rounded-lg bg-parchment-100 hover:bg-parchment-200 text-slatepos-900 font-black flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Spacing */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slatepos-600 mb-1.5">
                Line Spacing:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['compact', 'normal', 'relaxed'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setLineSpacing(mode)}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer active:scale-95 ${
                      lineSpacing === mode
                        ? 'border-brand-600 bg-brand-50 text-brand-800 font-black'
                        : 'border-parchment-300 text-slatepos-700 hover:bg-parchment-50'
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bill Content Editor */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-parchment-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-parchment-200">
              <div className="flex items-center space-x-2">
                <Type className="w-4 h-4 text-brand-600" />
                <h2 className="text-sm font-black uppercase tracking-wider text-slatepos-950">
                  Header &amp; Information
                </h2>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slatepos-700 mb-1">
                Place Name (under calligraphy):
              </label>
              <input
                type="text"
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                className="w-full text-xs font-bold p-2.5 rounded-xl border border-parchment-300 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slatepos-700 mb-1">Table Name:</label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full text-xs font-bold p-2 rounded-xl border border-parchment-300 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slatepos-700 mb-1">Cashier Name:</label>
                <input
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="w-full text-xs font-bold p-2 rounded-xl border border-parchment-300 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slatepos-700 mb-1">Invoice Number:</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full text-xs font-mono font-bold p-2 rounded-xl border border-parchment-300 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slatepos-700 mb-1">Payment Type:</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full text-xs font-bold p-2 rounded-xl border border-parchment-300 focus:outline-none focus:border-brand-500 bg-white"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">CARD</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleAddItem}
                className="w-full py-2.5 rounded-xl text-xs font-black bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-300 flex items-center justify-center space-x-1.5 cursor-pointer transition active:scale-98"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Dish Row</span>
              </button>
            </div>
          </div>

        </div>

        {/* Live Thermal Receipt Canvas (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          
          <div className="w-full flex items-center justify-between pb-2 mb-3 text-xs text-slatepos-500 font-bold px-2">
            <span>✏️ TIP: Click any text directly on the receipt to edit it live</span>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
              className="text-brand-700 hover:text-brand-900 underline flex items-center space-x-1 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Print/Export PDF</span>
            </button>
          </div>

          {/* Embedded Print CSS for exact 58mm thermal paper output */}
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-receipt-card, #printable-receipt-card * {
                visibility: visible !important;
              }
              #printable-receipt-card {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 58mm !important;
                max-width: 58mm !important;
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
              #printable-receipt-card img {
                max-height: 18mm !important;
                width: auto !important;
                margin: 0 auto !important;
                display: block !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          {/* The Physical 58mm Thermal Bill Slip (with 3-4 lines top & 4-5 lines bottom margin) */}
          <div
            id="printable-receipt-card"
            className="bg-white text-slatepos-950 px-6 pt-10 pb-14 rounded-3xl shadow-2xl border border-parchment-300 font-mono w-full max-w-[380px] sm:max-w-[420px] transition-all"
            style={{
              lineHeight: lineSpacing === 'compact' ? '1.2' : lineSpacing === 'normal' ? '1.35' : '1.5',
            }}
          >
            {/* Top Brand Heading: Authentic Cropped Calligraphy */}
            <div className="text-center pb-2">
              <img
                src="/brand-calligraphy-cropped.png"
                alt="ഇത്തിപ്പൂരം - ITHI POORAM"
                className="h-20 w-auto max-w-[250px] mx-auto object-contain"
                style={{ filter: 'contrast(160%)' }}
              />
              {/* Only Place Name */}
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setPlaceName(e.currentTarget.textContent || 'Vanchiyoor, Trivandrum')}
                className="font-black uppercase tracking-wider text-slatepos-950 mt-1.5 focus:outline-dashed focus:outline-1 focus:outline-brand-500 rounded px-1"
                style={{ fontSize: `${metaFontSize}px` }}
              >
                {placeName}
              </div>
            </div>

            {/* Metadata (Inv, Date, Time, Table, Cashier) */}
            <div
              className="border-t-2 border-b-2 border-dashed border-slatepos-300 py-2.5 my-3 space-y-1 text-slatepos-900"
              style={{ fontSize: `${metaFontSize}px` }}
            >
              <div className="flex justify-between items-center">
                <span>
                  Inv:{' '}
                  <strong
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setInvoiceNumber(e.currentTarget.textContent || invoiceNumber)}
                    className="font-black text-slatepos-950 focus:outline-dashed focus:outline-1 focus:outline-brand-500 px-1"
                  >
                    {invoiceNumber}
                  </strong>
                </span>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => setTimeStr(e.currentTarget.textContent || timeStr)}
                  className="font-semibold text-slatepos-700 focus:outline-dashed focus:outline-1 focus:outline-brand-500 px-1"
                >
                  {timeStr}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span>
                  Date:{' '}
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setDateStr(e.currentTarget.textContent || dateStr)}
                    className="focus:outline-dashed focus:outline-1 focus:outline-brand-500 px-1"
                  >
                    {dateStr}
                  </span>
                </span>
                <span>
                  Table:{' '}
                  <strong
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setTableName(e.currentTarget.textContent || tableName)}
                    className="font-black text-slatepos-950 focus:outline-dashed focus:outline-1 focus:outline-brand-500 px-1"
                  >
                    {tableName}
                  </strong>
                </span>
              </div>

              <div>
                <span>
                  Cashier:{' '}
                  <strong
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setCashierName(e.currentTarget.textContent || cashierName)}
                    className="font-bold text-slatepos-950 focus:outline-dashed focus:outline-1 focus:outline-brand-500 px-1"
                  >
                    {cashierName}
                  </strong>
                </span>
              </div>
            </div>

            {/* Column Headers */}
            <div
              className="border-b-2 border-dashed border-slatepos-300 pb-1.5 font-black flex justify-between uppercase text-slatepos-950"
              style={{ fontSize: `${itemFontSize}px` }}
            >
              <span className="w-1/2">ITEM</span>
              <span className="w-10 text-center">QTY</span>
              <span className="w-14 text-right">RATE</span>
              <span className="w-16 text-right">TOTAL</span>
            </div>

            {/* Items List (Directly Editable) */}
            <div
              className="py-2.5 space-y-1.5 border-b-2 border-dashed border-slatepos-300"
              style={{ fontSize: `${itemFontSize}px` }}
            >
              {items.map((it) => (
                <div key={it.id} className="flex justify-between items-center group relative leading-snug">
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleUpdateItem(it.id, 'name', e.currentTarget.textContent || 'Dish')}
                    className="w-1/2 font-bold truncate pr-1 text-slatepos-950 focus:outline-dashed focus:outline-1 focus:outline-brand-500 rounded px-1"
                  >
                    {it.name}
                  </span>

                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleUpdateItem(it.id, 'qty', Number(e.currentTarget.textContent) || 1)}
                    className="w-10 text-center font-bold text-slatepos-800 focus:outline-dashed focus:outline-1 focus:outline-brand-500 rounded"
                  >
                    {it.qty}
                  </span>

                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleUpdateItem(it.id, 'rate', Number(e.currentTarget.textContent.replace('₹', '')) || 0)}
                    className="w-14 text-right font-medium text-slatepos-800 focus:outline-dashed focus:outline-1 focus:outline-brand-500 rounded"
                  >
                    ₹{it.rate}
                  </span>

                  <span className="w-16 text-right font-black text-slatepos-950">
                    ₹{it.total}
                  </span>

                  {/* Row Delete Button on Hover */}
                  <button
                    onClick={() => handleRemoveItem(it.id)}
                    className="no-print opacity-0 group-hover:opacity-100 absolute -right-6 text-red-500 hover:text-red-700 p-0.5 cursor-pointer transition"
                    title="Delete Item Row"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Grand Total & Payment Mode (NO GST / NO TAXES) */}
            <div className="py-3 border-b-2 border-dashed border-slatepos-300 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-base sm:text-lg font-black text-slatepos-950">GRAND TOTAL:</span>
                <span
                  className="font-mono font-black text-brand-700"
                  style={{ fontSize: `${totalFontSize}px` }}
                >
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>
              <div
                className="text-xs sm:text-sm font-bold text-slatepos-800 flex justify-between items-center"
              >
                <span>Payment:</span>
                <span className="uppercase font-mono text-slatepos-950 font-black">[{paymentMode}]</span>
              </div>
            </div>

            {/* Footer: Malayalam Typography & English */}
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

          {/* Quick Action Footer Buttons */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handlePrintToSeznik}
              className="px-5 py-3 rounded-2xl text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg transition active:scale-95 cursor-pointer flex items-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print This Exact Custom Bill to SEZNIK</span>
            </button>

            <button
              onClick={handleSaveToPOS}
              className="px-5 py-3 rounded-2xl text-xs sm:text-sm font-black bg-brand-600 hover:bg-brand-700 text-white shadow-lg transition active:scale-95 cursor-pointer flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>Save as Default POS Bill</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
