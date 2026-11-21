const fs = require('fs');
const path = require('path');

const imgs = JSON.parse(fs.readFileSync(path.join(__dirname, 'images_base64.json'), 'utf8'));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ithi Pooram - Live Bill Editor & Customizer</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    [contenteditable="true"]:focus {
      outline: 2px dashed #10b981 !important;
      background-color: rgba(16, 185, 129, 0.08) !important;
      border-radius: 4px;
    }
    @media print {
      body * { visibility: hidden !important; }
      #printable-receipt-card, #printable-receipt-card * { visibility: visible !important; }
      #printable-receipt-card {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 58mm !important;
        max-width: 58mm !important;
        box-shadow: none !important;
        border: none !important;
      }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body class="bg-transparent text-[var(--foreground)] antialiased p-2 sm:p-4 font-sans select-none">
  <div class="max-w-5xl mx-auto bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden">
    
    <!-- Top Action Header -->
    <div class="p-4 sm:p-5 border-b border-[var(--border)] bg-gradient-to-r from-emerald-500/10 via-transparent to-amber-500/10 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="flex items-center space-x-2">
          <span class="text-2xl">✏️</span>
          <h1 class="text-base sm:text-lg font-black tracking-tight text-[var(--foreground)]">
            Live Bill WYSIWYG Editor
          </h1>
        </div>
        <p class="text-xs text-[var(--muted-foreground)] mt-0.5">
          Click directly on the receipt to edit text, scale fonts, add items, and test print physically.
        </p>
      </div>

      <div class="flex items-center flex-wrap gap-2">
        <a 
          href="http://localhost:3000/bill-editor" 
          target="_blank" 
          rel="noopener noreferrer"
          class="px-3.5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition active:scale-95 cursor-pointer flex items-center space-x-1.5"
          title="Open in your default web browser"
        >
          <span>🌐 Open in Browser</span>
        </a>

        <button id="btn-print-seznik" class="px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition active:scale-95 cursor-pointer flex items-center space-x-1.5">
          <span>🖨️ Print to SEZNIK</span>
        </button>

        <button id="btn-apply-pos" class="px-3.5 py-2 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition active:scale-95 cursor-pointer flex items-center space-x-1.5">
          <span>💾 Save to POS</span>
        </button>
      </div>
    </div>

    <!-- Notification Banner -->
    <div id="status-banner" class="hidden p-3 text-xs font-black text-center border-b border-[var(--border)]"></div>

    <!-- Grid: Left Controls (5 cols) + Right Live Editable Slip (7 cols) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6 items-start">
      
      <!-- Left Column: Quick Steppers & Preset Controls -->
      <div class="lg:col-span-5 space-y-4">
        
        <!-- Presets -->
        <div class="p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 space-y-2">
          <label class="block text-xs font-black uppercase tracking-wider text-[var(--foreground)]">
            Font Size Presets:
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button class="preset-btn py-2 px-2 rounded-xl text-xs font-bold border border-[var(--border)] hover:bg-emerald-500/10 transition active:scale-95 cursor-pointer text-center" data-item="16" data-total="28" data-meta="14">
              Normal
            </button>
            <button class="preset-btn py-2 px-2 rounded-xl text-xs font-black border-2 border-emerald-500 bg-emerald-500/15 text-emerald-600 transition active:scale-95 cursor-pointer text-center" data-item="18" data-total="34" data-meta="16">
              ★ Large
            </button>
            <button class="preset-btn py-2 px-2 rounded-xl text-xs font-bold border border-[var(--border)] hover:bg-emerald-500/10 transition active:scale-95 cursor-pointer text-center" data-item="21" data-total="40" data-meta="18">
              🔥 XL
            </button>
          </div>
        </div>

        <!-- Typography Sliders / Steppers -->
        <div class="p-4 rounded-2xl border border-[var(--border)] bg-[var(--background)]/60 space-y-3.5">
          <h2 class="text-xs font-black uppercase tracking-wider text-[var(--foreground)]">
            Typography Scaling Controls:
          </h2>

          <!-- Items Size -->
          <div class="space-y-1">
            <div class="flex justify-between items-center text-xs font-bold">
              <span>Items &amp; Dish Names:</span>
              <span id="lbl-item-size" class="font-mono font-black text-emerald-600">17px</span>
            </div>
            <div class="flex items-center space-x-2">
              <button id="dec-item" class="w-8 h-8 rounded-lg bg-[var(--card)] border border-[var(--border)] font-black text-sm flex items-center justify-center cursor-pointer active:scale-95">-</button>
              <input type="range" id="slider-item" min="13" max="24" value="17" class="flex-1 accent-emerald-600 cursor-pointer">
              <button id="inc-item" class="w-8 h-8 rounded-lg bg-[var(--card)] border border-[var(--border)] font-black text-sm flex items-center justify-center cursor-pointer active:scale-95">+</button>
            </div>
          </div>

          <!-- Grand Total Size -->
          <div class="space-y-1">
            <div class="flex justify-between items-center text-xs font-bold">
              <span>Grand Total Amount:</span>
              <span id="lbl-total-size" class="font-mono font-black text-emerald-600">32px</span>
            </div>
            <div class="flex items-center space-x-2">
              <button id="dec-total" class="w-8 h-8 rounded-lg bg-[var(--card)] border border-[var(--border)] font-black text-sm flex items-center justify-center cursor-pointer active:scale-95">-</button>
              <input type="range" id="slider-total" min="20" max="42" value="32" class="flex-1 accent-emerald-600 cursor-pointer">
              <button id="inc-total" class="w-8 h-8 rounded-lg bg-[var(--card)] border border-[var(--border)] font-black text-sm flex items-center justify-center cursor-pointer active:scale-95">+</button>
            </div>
          </div>

          <!-- Table / Inv Info Size -->
          <div class="space-y-1">
            <div class="flex justify-between items-center text-xs font-bold">
              <span>Table, Inv &amp; Cashier:</span>
              <span id="lbl-meta-size" class="font-mono font-black text-emerald-600">15px</span>
            </div>
            <div class="flex items-center space-x-2">
              <button id="dec-meta" class="w-8 h-8 rounded-lg bg-[var(--card)] border border-[var(--border)] font-black text-sm flex items-center justify-center cursor-pointer active:scale-95">-</button>
              <input type="range" id="slider-meta" min="12" max="22" value="15" class="flex-1 accent-emerald-600 cursor-pointer">
              <button id="inc-meta" class="w-8 h-8 rounded-lg bg-[var(--card)] border border-[var(--border)] font-black text-sm flex items-center justify-center cursor-pointer active:scale-95">+</button>
            </div>
          </div>

          <!-- Spacing -->
          <div>
            <label class="block text-[11px] font-black uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
              Line Spacing:
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button class="spacing-btn py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)]" data-val="compact">Compact</button>
              <button class="spacing-btn py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)]" data-val="normal">Normal</button>
              <button class="spacing-btn py-1.5 rounded-lg text-xs font-bold border-2 border-emerald-500 bg-emerald-500/10 text-emerald-600" data-val="relaxed">Relaxed</button>
            </div>
          </div>
        </div>

        <!-- Add Dish Button -->
        <button id="btn-add-item" class="w-full py-3 rounded-2xl text-xs font-black bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center space-x-1.5 cursor-pointer transition active:scale-98">
          <span>➕ Add New Dish Line</span>
        </button>

      </div>

      <!-- Right Column: Interactive WYSIWYG Thermal Slip (7 cols) -->
      <div class="lg:col-span-7 flex flex-col items-center">
        
        <div class="w-full flex items-center justify-between pb-2 mb-2 text-xs text-[var(--muted-foreground)] font-bold px-1">
          <span>👇 Click any text below to edit directly:</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono">58MM PAPER</span>
        </div>

        <!-- The Thermal Receipt Card with 3-4 lines top & 4-5 lines bottom margin -->
        <div id="printable-receipt-card" class="bg-white text-slate-950 px-6 pt-10 pb-14 rounded-3xl shadow-2xl border border-neutral-300 font-mono w-full max-w-[380px] sm:max-w-[420px] select-text transition-all leading-relaxed">
          
          <!-- Top Calligraphy Header -->
          <div class="text-center pb-2">
            <img src="${imgs.calligraphy}" alt="ഇത്തിപ്പൂരം - ITHI POORAM" class="h-20 w-auto max-w-[250px] mx-auto object-contain" style="filter: contrast(160%);" />
            <!-- Location (Place only) - Directly Editable -->
            <div id="el-place" contenteditable="true" spellcheck="false" class="font-black uppercase tracking-wider text-black mt-1.5 px-1 rounded hover:bg-neutral-100 transition" style="font-size: 14px;">
              Vanchiyoor, Trivandrum
            </div>
          </div>

          <!-- Metadata (Inv, Date, Time, Table, Cashier) - Directly Editable -->
          <div id="el-meta-section" class="border-t-2 border-b-2 border-dashed border-neutral-400 py-2.5 my-3 space-y-1 text-neutral-900" style="font-size: 14px;">
            <div class="flex justify-between items-center">
              <span>Inv: <strong id="el-inv" contenteditable="true" spellcheck="false" class="font-black text-black px-1 rounded hover:bg-neutral-100">20261115-001</strong></span>
              <span id="el-time" contenteditable="true" spellcheck="false" class="font-semibold px-1 rounded hover:bg-neutral-100">01:20 PM</span>
            </div>
            <div class="flex justify-between items-center">
              <span>Date: <span id="el-date" contenteditable="true" spellcheck="false" class="px-1 rounded hover:bg-neutral-100">15/11/2026</span></span>
              <span>Table: <strong id="el-table" contenteditable="true" spellcheck="false" class="font-black text-black px-1 rounded hover:bg-neutral-100">AC Room - Table 1</strong></span>
            </div>
            <div>
              <span>Cashier: <strong id="el-cashier" contenteditable="true" spellcheck="false" class="font-bold text-black px-1 rounded hover:bg-neutral-100">Rahul</strong></span>
            </div>
          </div>

          <!-- Column Headers -->
          <div id="el-col-headers" class="border-b-2 border-dashed border-neutral-400 pb-1.5 font-black flex justify-between uppercase text-black" style="font-size: 16px;">
            <span class="w-1/2">ITEM</span>
            <span class="w-10 text-center">QTY</span>
            <span class="w-14 text-right">RATE</span>
            <span class="w-16 text-right">TOTAL</span>
          </div>

          <!-- Items List (Directly Editable Rows) -->
          <div id="items-container" class="py-2.5 space-y-1.5 border-b-2 border-dashed border-neutral-400" style="font-size: 16px;">
            <!-- Dynamically populated rows -->
          </div>

          <!-- Grand Total & Payment Mode (NO GST / NO TAXES) -->
          <div class="py-3 border-b-2 border-dashed border-neutral-400 space-y-1.5">
            <div class="flex justify-between items-center">
              <span class="text-base sm:text-lg font-black text-black">GRAND TOTAL:</span>
              <span id="el-grand-total" class="font-mono font-black text-emerald-800" style="font-size: 28px;">
                ₹260.00
              </span>
            </div>
            <div class="text-xs sm:text-sm font-bold text-neutral-800 flex justify-between items-center">
              <span>Payment:</span>
              <span id="el-payment" contenteditable="true" spellcheck="false" class="uppercase font-mono text-black font-black px-1 rounded hover:bg-neutral-100">[CASH]</span>
            </div>
          </div>

          <!-- Footer: Malayalam Graphic & English Thank You -->
          <div class="text-center pt-3 pb-1 space-y-1.5">
            <img src="${imgs.footer}" alt="നന്ദി! വീണ്ടും വരിക" class="h-6 sm:h-7 mx-auto object-contain my-1" style="filter: contrast(160%);" />
            <div id="el-footer-text" contenteditable="true" spellcheck="false" class="text-xs sm:text-sm font-black uppercase tracking-wider text-black px-1 rounded hover:bg-neutral-100">
              Thank You! Visit Again
            </div>
          </div>

        </div>

      </div>

    </div>

  </div>

  <script>
    // State
    const state = {
      itemSize: 18,
      totalSize: 34,
      metaSize: 16,
      spacing: 'relaxed',
      place: 'Vanchiyoor, Trivandrum',
      table: 'AC Room - Table 1',
      cashier: 'Rahul',
      payment: '[CASH]',
      items: [
        { id: 1, name: 'Chicken Biryani', qty: 1, rate: 180 },
        { id: 2, name: 'Lime Juice', qty: 2, rate: 40 }
      ]
    };

    const itemsContainer = document.getElementById('items-container');
    const elGrandTotal = document.getElementById('el-grand-total');
    const elPlace = document.getElementById('el-place');
    const elMetaSection = document.getElementById('el-meta-section');
    const elColHeaders = document.getElementById('el-col-headers');

    const sliderItem = document.getElementById('slider-item');
    const sliderTotal = document.getElementById('slider-total');
    const sliderMeta = document.getElementById('slider-meta');
    const lblItem = document.getElementById('lbl-item-size');
    const lblTotal = document.getElementById('lbl-total-size');
    const lblMeta = document.getElementById('lbl-meta-size');
    const statusBanner = document.getElementById('status-banner');

    function renderItems() {
      itemsContainer.innerHTML = '';
      let sum = 0;

      state.items.forEach((it, idx) => {
        const lineTotal = it.qty * it.rate;
        sum += lineTotal;

        const row = document.createElement('div');
        row.className = 'flex justify-between items-center group relative leading-snug';

        row.innerHTML = \`
          <span contenteditable="true" spellcheck="false" class="w-1/2 font-bold truncate pr-1 text-black px-1 rounded hover:bg-neutral-100" data-field="name" data-idx="\${idx}">\${it.name}</span>
          <span contenteditable="true" spellcheck="false" class="w-10 text-center font-bold text-neutral-800 px-1 rounded hover:bg-neutral-100" data-field="qty" data-idx="\${idx}">\${it.qty}</span>
          <span contenteditable="true" spellcheck="false" class="w-14 text-right font-medium text-neutral-800 px-1 rounded hover:bg-neutral-100" data-field="rate" data-idx="\${idx}">₹\${it.rate}</span>
          <span class="w-16 text-right font-black text-black">₹\${lineTotal}</span>
          <button class="no-print opacity-0 group-hover:opacity-100 absolute -right-6 text-red-500 hover:text-red-700 font-black text-sm p-0.5 cursor-pointer transition" data-del="\${idx}" title="Delete Row">✕</button>
        \`;

        itemsContainer.appendChild(row);
      });

      elGrandTotal.textContent = '₹' + sum.toFixed(2);

      // Attach item edit events
      itemsContainer.querySelectorAll('[contenteditable="true"]').forEach(el => {
        el.addEventListener('blur', (e) => {
          const idx = Number(e.target.dataset.idx);
          const field = e.target.dataset.field;
          const val = e.target.textContent.trim().replace('₹', '');
          if (field === 'name') state.items[idx].name = val || 'Dish';
          if (field === 'qty') state.items[idx].qty = Math.max(1, parseInt(val, 10) || 1);
          if (field === 'rate') state.items[idx].rate = Math.max(0, parseFloat(val) || 0);
          renderItems();
        });
      });

      // Attach row delete
      itemsContainer.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = Number(e.target.dataset.del);
          if (state.items.length <= 1) {
            alert('At least 1 item row is required on the bill.');
            return;
          }
          state.items.splice(idx, 1);
          renderItems();
        });
      });
    }

    function applySizes() {
      lblItem.textContent = state.itemSize + 'px';
      lblTotal.textContent = state.totalSize + 'px';
      lblMeta.textContent = state.metaSize + 'px';

      sliderItem.value = state.itemSize;
      sliderTotal.value = state.totalSize;
      sliderMeta.value = state.metaSize;

      itemsContainer.style.fontSize = state.itemSize + 'px';
      elColHeaders.style.fontSize = state.itemSize + 'px';
      elMetaSection.style.fontSize = state.metaSize + 'px';
      elPlace.style.fontSize = state.metaSize + 'px';
      elGrandTotal.style.fontSize = state.totalSize + 'px';

      let lh = '1.35';
      if (state.spacing === 'compact') lh = '1.2';
      if (state.spacing === 'relaxed') lh = '1.5';
      itemsContainer.style.lineHeight = lh;
      elMetaSection.style.lineHeight = lh;
    }

    // Sliders
    sliderItem.addEventListener('input', (e) => { state.itemSize = Number(e.target.value); applySizes(); });
    sliderTotal.addEventListener('input', (e) => { state.totalSize = Number(e.target.value); applySizes(); });
    sliderMeta.addEventListener('input', (e) => { state.metaSize = Number(e.target.value); applySizes(); });

    // Steppers
    document.getElementById('dec-item').addEventListener('click', () => { state.itemSize = Math.max(12, state.itemSize - 1); applySizes(); });
    document.getElementById('inc-item').addEventListener('click', () => { state.itemSize = Math.min(22, state.itemSize + 1); applySizes(); });
    document.getElementById('dec-total').addEventListener('click', () => { state.totalSize = Math.max(18, state.totalSize - 2); applySizes(); });
    document.getElementById('inc-total').addEventListener('click', () => { state.totalSize = Math.min(38, state.totalSize + 2); applySizes(); });
    document.getElementById('dec-meta').addEventListener('click', () => { state.metaSize = Math.max(12, state.metaSize - 1); applySizes(); });
    document.getElementById('inc-meta').addEventListener('click', () => { state.metaSize = Math.min(20, state.metaSize + 1); applySizes(); });

    // Spacing
    document.querySelectorAll('.spacing-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.spacing-btn').forEach(b => {
          b.className = 'spacing-btn py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)]';
        });
        btn.className = 'spacing-btn py-1.5 rounded-lg text-xs font-bold border-2 border-emerald-500 bg-emerald-500/10 text-emerald-600';
        state.spacing = btn.dataset.val;
        applySizes();
      });
    });

    // Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach(b => {
          b.className = 'preset-btn py-2 px-2 rounded-xl text-xs font-bold border border-[var(--border)] hover:bg-emerald-500/10 transition active:scale-95 cursor-pointer text-center';
        });
        btn.className = 'preset-btn py-2 px-2 rounded-xl text-xs font-black border-2 border-emerald-500 bg-emerald-500/15 text-emerald-600 transition active:scale-95 cursor-pointer text-center';
        state.itemSize = Number(btn.dataset.item);
        state.totalSize = Number(btn.dataset.total);
        state.metaSize = Number(btn.dataset.meta);
        applySizes();
      });
    });

    // Add item
    document.getElementById('btn-add-item').addEventListener('click', () => {
      state.items.push({
        id: Date.now(),
        name: 'Special Porotta',
        qty: 1,
        rate: 25
      });
      renderItems();
    });

    // Apply to POS
    document.getElementById('btn-apply-pos').addEventListener('click', async () => {
      statusBanner.className = 'p-3 text-xs font-black text-center bg-blue-500/15 text-blue-700 dark:text-blue-400 border-b border-blue-500/30';
      statusBanner.textContent = 'Saving to POS billing database...';
      statusBanner.classList.remove('hidden');

      try {
        const payload = {
          itemSize: state.itemSize,
          grandTotalSize: state.totalSize,
          metadataSize: state.metaSize,
          baseFontSize: state.itemSize,
          placeName: elPlace.textContent.trim() || 'Vanchiyoor, Trivandrum',
          lineSpacing: state.spacing
        };
        const res = await fetch('http://localhost:3000/api/billing/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (d.success) {
          statusBanner.className = 'p-3 text-xs font-black text-center bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-b border-emerald-500/30';
          statusBanner.textContent = '✓ Saved & Applied! All billing screens and receipts now use your customized bill layout.';
          setTimeout(() => statusBanner.classList.add('hidden'), 5000);
        } else {
          throw new Error(d.error || 'Failed');
        }
      } catch (err) {
        statusBanner.className = 'p-3 text-xs font-black text-center bg-amber-500/15 text-amber-700 dark:text-amber-400 border-b border-amber-500/30';
        statusBanner.textContent = 'Notice: ' + err.message;
      }
    });

    // Print to SEZNIK Bluetooth
    document.getElementById('btn-print-seznik').addEventListener('click', async () => {
      statusBanner.className = 'p-3 text-xs font-black text-center bg-purple-500/15 text-purple-700 dark:text-purple-400 border-b border-purple-500/30';
      statusBanner.textContent = 'Sending this custom bill to SEZNIK Bluetooth printer...';
      statusBanner.classList.remove('hidden');

      const itemLines = state.items.map(i => {
        const name = (i.name || 'Dish').padEnd(16).substring(0, 16);
        const qty = String(i.qty).padStart(3);
        const rate = String(i.rate).padStart(5);
        const tot = String(i.qty * i.rate).padStart(5);
        return name + ' ' + qty + ' ' + rate + ' ' + tot;
      }).join('\\n');

      const sum = state.items.reduce((acc, it) => acc + (it.qty * it.rate), 0);

      const receiptText = [
        '================================',
        '          ഇത്തിപ്പൂരം',
        '          ITHI POORAM',
        '     ' + (elPlace.textContent.trim() || 'Vanchiyoor, Trivandrum'),
        '================================',
        'Inv: ' + document.getElementById('el-inv').textContent.trim(),
        'Date: ' + document.getElementById('el-date').textContent.trim() + '  Time: ' + document.getElementById('el-time').textContent.trim(),
        'Table: ' + document.getElementById('el-table').textContent.trim(),
        'Cashier: ' + document.getElementById('el-cashier').textContent.trim(),
        '--------------------------------',
        'ITEM             QTY  RATE TOTAL',
        '--------------------------------',
        itemLines,
        '--------------------------------',
        'GRAND TOTAL:           Rs.' + sum.toFixed(2).padStart(8),
        'Payment: ' + document.getElementById('el-payment').textContent.trim(),
        '================================',
        '      നന്ദി! വീണ്ടും വരിക',
        '     Thank You! Visit Again',
        '================================'
      ].join('\\n');

      const receiptData = {
        invoiceNumber: document.getElementById('el-inv').textContent.trim(),
        dateStr: document.getElementById('el-date').textContent.trim(),
        timeStr: document.getElementById('el-time').textContent.trim(),
        tableCode: document.getElementById('el-table').textContent.trim(),
        cashierName: document.getElementById('el-cashier').textContent.trim(),
        placeName: elPlace.textContent.trim() || 'VANCHIYOOR, TRIVANDRUM',
        paymentMode: document.getElementById('el-payment').textContent.trim().replace(/[\\[\\]]/g, ''),
        grandTotal: sum.toFixed(2),
        items: items.map(it => ({ name: it.name, qty: it.qty, rate: it.rate, total: it.qty * it.rate }))
      };

      try {
        const res = await fetch('http://localhost:3000/api/printer/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptText, receiptData, printerName: 'SEZNIK' })
        });
        const d = await res.json();
        if (d.success) {
          statusBanner.className = 'p-3 text-xs font-black text-center bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-b border-emerald-500/30';
          statusBanner.textContent = '🖨️ Bill printed on SEZNIK! Check the physical paper output.';
          setTimeout(() => statusBanner.classList.add('hidden'), 5000);
        } else {
          throw new Error(d.error || 'Printer offline');
        }
      } catch (err) {
        statusBanner.className = 'p-3 text-xs font-black text-center bg-red-500/15 text-red-700 dark:text-red-400 border-b border-red-500/30';
        statusBanner.textContent = 'Print failed: ' + err.message;
      }
    });

    // Init
    renderItems();
    applySizes();
  </script>
</body>
</html>`;

const artifactDir = path.resolve('C:/Users/USR/.gemini/antigravity/brain/a676cd5e-91e4-4647-8f53-123482c59705');
const outPath = path.join(artifactDir, 'live_bill_editor.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Successfully written updated live_bill_editor.html to:', outPath);
