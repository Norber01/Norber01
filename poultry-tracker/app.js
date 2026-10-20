/* Poultry Tracker — income & expenses for a poultry (egg) business.
 *
 * Every day you record what goes in (eggs collected, money added) and what
 * goes out (crates sold, eggs given away, feed bought, other expenses).
 * The running columns from the spreadsheet are calculated automatically:
 *
 *   Total Crate      = eggs collected / eggs per crate
 *   Total (sales)    = price per crate × crates sold
 *   Income Generated = running total of sales for the month
 *   Total (feed)     = feed bags × price per bag
 *   Income Left      = previous income left + sales + money added − feed − other expenses
 *   Remaining Eggs   = previous remaining + eggs collected − crates sold × eggs per crate − giveaway
 */
(function () {
  'use strict';

  const RECORDS_KEY = 'poultry.records.v1';
  const SETTINGS_KEY = 'poultry.settings.v1';

  const DEFAULT_SETTINGS = {
    farmName: '',
    currency: 'GH₵',
    birds: 0,
    eggsPerCrate: 30,
    defaultCratePrice: 40,
    defaultBagPrice: 345,
    openingEggs: 0,
    openingCash: 0,
  };

  const NUMBER_FIELDS = ['eggs', 'giveaway', 'cratePrice', 'cratesSold', 'feedBags', 'bagPrice', 'expenseAmt', 'cashAdded'];
  const TEXT_FIELDS = ['date', 'note', 'expenseDesc'];

  // ---------- Storage ----------

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      toast('Could not save on this device. Download a backup!');
      return false;
    }
  }

  let settings = Object.assign({}, DEFAULT_SETTINGS, load(SETTINGS_KEY, {}));
  let records = load(RECORDS_KEY, []);

  function persist() {
    save(RECORDS_KEY, records);
  }

  // ---------- Helpers ----------

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  function round(n, dp) {
    const f = Math.pow(10, dp);
    return Math.round(n * f) / f;
  }

  function fmt(n, dp) {
    if (dp === undefined) dp = 2;
    return round(n, dp).toLocaleString(undefined, { maximumFractionDigits: dp });
  }

  function money(n) {
    const sign = n < 0 ? '−' : '';
    return sign + settings.currency + ' ' + Math.abs(round(n, 2)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function blankIfZero(n, formatter) {
    return n ? formatter(n) : '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // dd/mm/yy like the spreadsheet
  function showDate(iso) {
    const [y, m, d] = iso.split('-');
    return Number(d) + '/' + m + '/' + y.slice(2);
  }

  function monthKey(iso) {
    return iso.slice(0, 7);
  }

  function monthName(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ---------- Calculations ----------

  function sorted(list) {
    return list.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created || 0) - (b.created || 0)));
  }

  // Returns records in date order with every spreadsheet column filled in.
  function compute(list) {
    const epc = num(settings.eggsPerCrate) || 30;
    let remaining = num(settings.openingEggs);
    let cash = num(settings.openingCash);
    let monthIncome = 0;
    let currentMonth = null;

    return sorted(list).map(r => {
      const month = monthKey(r.date);
      if (month !== currentMonth) {
        currentMonth = month;
        monthIncome = 0;
      }
      const crates = num(r.eggs) / epc;
      const salesTotal = num(r.cratePrice) * num(r.cratesSold);
      const feedTotal = num(r.feedBags) * num(r.bagPrice);
      monthIncome += salesTotal;
      remaining += num(r.eggs) - num(r.cratesSold) * epc - num(r.giveaway);
      cash += salesTotal + num(r.cashAdded) - feedTotal - num(r.expenseAmt);
      return Object.assign({}, r, {
        crates,
        salesTotal,
        feedTotal,
        incomeGenerated: monthIncome,
        incomeLeft: round(cash, 2),
        remaining: round(remaining, 2),
      });
    });
  }

  function totals(rows) {
    const t = { eggs: 0, cratesSold: 0, sales: 0, feed: 0, expenses: 0, cashAdded: 0, giveaway: 0, feedBags: 0 };
    rows.forEach(r => {
      t.eggs += num(r.eggs);
      t.cratesSold += num(r.cratesSold);
      t.sales += r.salesTotal;
      t.feed += r.feedTotal;
      t.feedBags += num(r.feedBags);
      t.expenses += num(r.expenseAmt);
      t.cashAdded += num(r.cashAdded);
      t.giveaway += num(r.giveaway);
    });
    t.profit = t.sales - t.feed - t.expenses;
    return t;
  }

  // ---------- Navigation ----------

  function go(view) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.goto === view));
    if (view === 'add' && !$('#entryForm').elements.id.value) resetForm();
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-goto]');
    if (btn) {
      if (btn.dataset.goto === 'add') resetForm();
      go(btn.dataset.goto);
    }
  });

  // ---------- Rendering ----------

  function card(label, value, cls, extra) {
    return '<div class="card ' + (cls || '') + '"><div class="label">' + esc(label) + '</div><div class="value">' + esc(value) + '</div>' +
      (extra ? '<div class="extra">' + esc(extra) + '</div>' : '') + '</div>';
  }

  function renderDashboard(rows) {
    const last = rows[rows.length - 1];
    const epc = num(settings.eggsPerCrate) || 30;
    const stock = last ? last.remaining : num(settings.openingEggs);
    const cash = last ? last.incomeLeft : num(settings.openingCash);
    const all = totals(rows);

    let html = '';
    html += card('Eggs in stock', fmt(stock, 0), stock < 0 ? 'red' : 'cyan', fmt(stock / epc) + ' crates');
    html += card('Income left', money(cash), cash < 0 ? 'red' : 'green', 'cash on hand');
    if (last) {
      const extra = settings.birds > 0 ? 'Laying rate ' + fmt((num(last.eggs) / settings.birds) * 100, 1) + '%' : fmt(last.crates) + ' crates';
      html += card('Eggs on ' + showDate(last.date), fmt(num(last.eggs), 0), '', extra);
    }
    const week = rows.slice(-7);
    if (week.length) {
      const avg = week.reduce((s, r) => s + num(r.eggs), 0) / week.length;
      html += card('Avg eggs / day', fmt(avg, 0), '', 'last ' + week.length + ' records');
    }
    html += card('All-time sales', money(all.sales), 'blue');
    html += card('All-time costs', money(all.feed + all.expenses), 'red', 'feed + other expenses');
    $('#statCards').innerHTML = html;

    const thisMonth = monthKey(last ? last.date : todayISO());
    const m = totals(rows.filter(r => monthKey(r.date) === thisMonth));
    $('#monthCards').innerHTML =
      card('Eggs collected', fmt(m.eggs, 0), '', monthName(thisMonth)) +
      card('Crates sold', fmt(m.cratesSold), '') +
      card('Sales income', money(m.sales), 'blue') +
      card('Feed cost', money(m.feed), 'red', fmt(m.feedBags) + ' bags') +
      card('Other expenses', money(m.expenses), 'red') +
      card('Profit', money(m.profit), m.profit < 0 ? 'red' : 'green');

    const recent = rows.slice(-7).reverse();
    $('#recentList').innerHTML = recent.length
      ? recent.map(r =>
        '<div class="recent-item" data-edit="' + esc(r.id) + '">' +
          '<span class="d">' + esc(showDate(r.date)) + '</span>' +
          '<span class="r">' + esc(money(r.salesTotal)) + '</span>' +
          '<span class="m">' + fmt(num(r.eggs), 0) + ' eggs · ' + fmt(num(r.cratesSold)) + (num(r.cratesSold) === 1 ? ' crate' : ' crates') + ' sold</span>' +
          '<span class="m r">stock ' + fmt(r.remaining, 0) + '</span>' +
        '</div>').join('')
      : '<div class="empty">No records yet. Tap <b>＋ Add</b> to record your first day.</div>';
  }

  function renderRecords(rows) {
    const select = $('#recordsMonth');
    const months = Array.from(new Set(rows.map(r => monthKey(r.date)))).sort().reverse();
    const chosen = select.value || months[0] || 'all';
    select.innerHTML = '<option value="all">All months</option>' +
      months.map(k => '<option value="' + k + '">' + esc(monthName(k)) + '</option>').join('');
    select.value = months.includes(chosen) || chosen === 'all' ? chosen : 'all';

    const shown = select.value === 'all' ? rows : rows.filter(r => monthKey(r.date) === select.value);
    const tbody = $('#sheetTable tbody');

    if (!shown.length) {
      tbody.innerHTML = '<tr><td colspan="17" class="text" style="text-align:center;color:var(--muted)">No records yet.</td></tr>';
      $('#sheetTable tfoot').innerHTML = '';
      return;
    }

    tbody.innerHTML = shown.map(r =>
      '<tr data-edit="' + esc(r.id) + '">' +
        '<td>' + esc(showDate(r.date)) + '</td>' +
        '<td>' + fmt(num(r.eggs), 0) + '</td>' +
        '<td>' + fmt(r.crates) + '</td>' +
        '<td>' + blankIfZero(num(r.cratePrice), fmt) + '</td>' +
        '<td>' + fmt(num(r.cratesSold)) + '</td>' +
        '<td>' + fmt(r.salesTotal) + '</td>' +
        '<td class="blue">' + fmt(r.incomeGenerated) + '</td>' +
        '<td>' + blankIfZero(num(r.feedBags), fmt) + '</td>' +
        '<td>' + blankIfZero(num(r.bagPrice) && num(r.feedBags) ? num(r.bagPrice) : 0, fmt) + '</td>' +
        '<td>' + fmt(r.feedTotal) + '</td>' +
        '<td class="text">' + esc(r.note) + '</td>' +
        '<td class="blue">' + blankIfZero(num(r.cashAdded), fmt) + '</td>' +
        '<td class="text">' + esc(r.expenseDesc) + '</td>' +
        '<td class="red">' + blankIfZero(num(r.expenseAmt), fmt) + '</td>' +
        '<td class="' + (r.incomeLeft < 0 ? 'neg' : 'bold') + '">' + fmt(r.incomeLeft) + '</td>' +
        '<td>' + fmt(num(r.giveaway), 0) + '</td>' +
        '<td class="' + (r.remaining < 0 ? 'neg' : 'cyan') + '">' + fmt(r.remaining, 0) + '</td>' +
      '</tr>').join('');

    const t = totals(shown);
    $('#sheetTable tfoot').innerHTML =
      '<tr><td>Total</td><td>' + fmt(t.eggs, 0) + '</td><td>' + fmt(t.eggs / (num(settings.eggsPerCrate) || 30)) + '</td><td></td>' +
      '<td>' + fmt(t.cratesSold) + '</td><td>' + fmt(t.sales) + '</td><td></td><td>' + fmt(t.feedBags) + '</td><td></td>' +
      '<td>' + fmt(t.feed) + '</td><td></td><td>' + blankIfZero(t.cashAdded, fmt) + '</td><td></td>' +
      '<td class="red">' + fmt(t.expenses) + '</td><td></td><td>' + fmt(t.giveaway, 0) + '</td><td></td></tr>';
  }

  function renderSummary(rows) {
    const byMonth = {};
    rows.forEach(r => {
      (byMonth[monthKey(r.date)] = byMonth[monthKey(r.date)] || []).push(r);
    });
    const keys = Object.keys(byMonth).sort().reverse();
    const line = (label, t) =>
      '<td>' + esc(label) + '</td><td>' + fmt(t.eggs, 0) + '</td><td>' + fmt(t.cratesSold) + '</td>' +
      '<td class="blue">' + fmt(t.sales) + '</td><td class="red">' + fmt(t.feed) + '</td><td class="red">' + fmt(t.expenses) + '</td>' +
      '<td>' + fmt(t.cashAdded) + '</td><td class="' + (t.profit < 0 ? 'neg' : 'bold') + '">' + fmt(t.profit) + '</td><td>' + fmt(t.giveaway, 0) + '</td>';

    $('#summaryTable tbody').innerHTML = keys.length
      ? keys.map(k => '<tr>' + line(monthName(k), totals(byMonth[k])) + '</tr>').join('')
      : '<tr><td colspan="9" class="text" style="text-align:center;color:var(--muted)">No records yet.</td></tr>';
    $('#summaryTable tfoot').innerHTML = keys.length ? '<tr>' + line('All time', totals(rows)) + '</tr>' : '';
  }

  function render() {
    const rows = compute(records);
    $('#farmTitle').textContent = settings.farmName || 'Poultry Tracker';
    document.title = settings.farmName ? settings.farmName + ' · Poultry Tracker' : 'Poultry Tracker';
    renderDashboard(rows);
    renderRecords(rows);
    renderSummary(rows);
  }

  $('#recordsMonth').addEventListener('change', render);

  // ---------- Entry form ----------

  const form = $('#entryForm');

  function lastRecord() {
    const s = sorted(records);
    return s[s.length - 1];
  }

  function resetForm() {
    form.reset();
    form.elements.id.value = '';
    form.elements.date.value = todayISO();
    const last = lastRecord();
    form.elements.cratePrice.value = last && num(last.cratePrice) ? last.cratePrice : settings.defaultCratePrice;
    form.elements.bagPrice.value = settings.defaultBagPrice;
    $('#formTitle').textContent = 'Add a day';
    $('#deleteEntry').hidden = true;
    updatePreview();
  }

  function editRecord(id) {
    const r = records.find(x => x.id === id);
    if (!r) return;
    form.reset();
    form.elements.id.value = r.id;
    TEXT_FIELDS.forEach(f => { form.elements[f].value = r[f] || ''; });
    NUMBER_FIELDS.forEach(f => { form.elements[f].value = num(r[f]) ? r[f] : ''; });
    if (!num(r.bagPrice)) form.elements.bagPrice.value = settings.defaultBagPrice;
    $('#formTitle').textContent = 'Edit ' + showDate(r.date);
    $('#deleteEntry').hidden = false;
    updatePreview();
    go('add');
  }

  document.addEventListener('click', e => {
    const row = e.target.closest('[data-edit]');
    if (row) editRecord(row.dataset.edit);
  });

  function readForm() {
    const r = { id: form.elements.id.value || uid() };
    TEXT_FIELDS.forEach(f => { r[f] = form.elements[f].value.trim(); });
    NUMBER_FIELDS.forEach(f => { r[f] = num(form.elements[f].value); });
    // A bag price on its own isn't a purchase; don't store it without bags.
    if (!r.feedBags) r.bagPrice = 0;
    const existing = records.find(x => x.id === r.id);
    r.created = existing ? existing.created : Date.now();
    return r;
  }

  function updatePreview() {
    const draft = readForm();
    if (!draft.date) draft.date = todayISO();
    const rows = compute(records.filter(x => x.id !== draft.id).concat([draft]));
    const r = rows.find(x => x.id === draft.id);
    $('#formPreview').innerHTML =
      '<div>Crates collected<b>' + fmt(r.crates) + '</b></div>' +
      '<div>Sales total<b>' + esc(money(r.salesTotal)) + '</b></div>' +
      '<div>Feed total<b>' + esc(money(r.feedTotal)) + '</b></div>' +
      '<div class="' + (r.incomeLeft < 0 ? 'warn' : '') + '">Income left<b>' + esc(money(r.incomeLeft)) + '</b></div>' +
      '<div class="' + (r.remaining < 0 ? 'warn' : '') + '">Remaining eggs<b>' + fmt(r.remaining, 0) + '</b></div>';
  }

  form.addEventListener('input', updatePreview);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const r = readForm();
    if (!r.date) {
      toast('Please pick a date');
      return;
    }
    const i = records.findIndex(x => x.id === r.id);
    if (i >= 0) records[i] = r; else records.push(r);
    persist();
    render();
    toast(i >= 0 ? 'Record updated' : 'Day saved');
    resetForm();
    go('records');
  });

  $('#cancelEdit').addEventListener('click', () => {
    resetForm();
    go('records');
  });

  $('#deleteEntry').addEventListener('click', () => {
    const id = form.elements.id.value;
    const r = records.find(x => x.id === id);
    if (!r || !confirm('Delete the record for ' + showDate(r.date) + '?')) return;
    records = records.filter(x => x.id !== id);
    persist();
    render();
    toast('Record deleted');
    resetForm();
    go('records');
  });

  // ---------- Settings ----------

  const settingsForm = $('#settingsForm');

  function fillSettings() {
    Object.keys(DEFAULT_SETTINGS).forEach(k => {
      settingsForm.elements[k].value = settings[k];
    });
  }

  settingsForm.addEventListener('submit', e => {
    e.preventDefault();
    const next = {};
    Object.keys(DEFAULT_SETTINGS).forEach(k => {
      const v = settingsForm.elements[k].value;
      next[k] = typeof DEFAULT_SETTINGS[k] === 'number' ? num(v) : v.trim();
    });
    if (!next.eggsPerCrate) next.eggsPerCrate = 30;
    if (!next.currency) next.currency = DEFAULT_SETTINGS.currency;
    settings = next;
    save(SETTINGS_KEY, settings);
    fillSettings();
    render();
    toast('Settings saved');
  });

  // ---------- CSV import / export ----------

  const CSV_HEADERS = ['Date', 'No. of Eggs', 'Total Crate', 'Price per Crate', 'No. of Crate Sold', 'Total', 'Income Generated',
    'No. of Feed Bought', 'Price per Bag', 'Total', 'Note', 'Money Added', 'Other Expenses', 'Amount', 'Income Left', 'Eggs Giveaway', 'Remaining Eggs'];

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  $('#exportCsv').addEventListener('click', () => {
    const rows = compute(records);
    const lines = [CSV_HEADERS.map(csvCell).join(',')].concat(rows.map(r => [
      showDate(r.date), num(r.eggs), round(r.crates, 4), num(r.cratePrice), num(r.cratesSold), r.salesTotal, r.incomeGenerated,
      num(r.feedBags), num(r.bagPrice), r.feedTotal, r.note, num(r.cashAdded), r.expenseDesc, num(r.expenseAmt),
      r.incomeLeft, num(r.giveaway), r.remaining,
    ].map(csvCell).join(',')));
    download('poultry-records-' + todayISO() + '.csv', '﻿' + lines.join('\r\n'), 'text/csv');
  });

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // Accepts 8/10/2026, 9/10/26 (day/month/year) or 2026-10-09.
  function parseDate(s) {
    s = String(s || '').trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (!m) return null;
    const year = m[3].length === 2 ? '20' + m[3] : m[3];
    const month = Number(m[2]), day = Number(m[1]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  // Match spreadsheet column names (from Google Sheets or this app's export) to record fields.
  function fieldForHeader(h) {
    const n = h.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (n === 'date') return 'date';
    if (/^no of eggs/.test(n)) return 'eggs';
    if (/^price per crate/.test(n)) return 'cratePrice';
    if (/^no of crates? sold/.test(n)) return 'cratesSold';
    if (/^no of feed/.test(n)) return 'feedBags';
    if (/^price per bag/.test(n)) return 'bagPrice';
    if (/^notes?$/.test(n)) return 'note';
    if (/^money added/.test(n)) return 'cashAdded';
    if (/^other expenses?/.test(n)) return 'expenseDesc';
    if (n === 'amount') return 'expenseAmt';
    if (/giveaway|give away/.test(n)) return 'giveaway';
    return null;
  }

  function importCSV(text) {
    const table = parseCSV(text).filter(r => r.some(c => c.trim() !== ''));
    const headerIdx = table.findIndex(r => r.some(c => fieldForHeader(c) === 'date'));
    if (headerIdx < 0) throw new Error('Could not find a "Date" column.');
    const map = table[headerIdx].map(fieldForHeader);
    const out = [];
    let skipped = 0;
    const now = Date.now();
    table.slice(headerIdx + 1).forEach((cells, i) => {
      const r = { id: uid(), created: now + i, note: '', expenseDesc: '' };
      NUMBER_FIELDS.forEach(f => { r[f] = 0; });
      map.forEach((field, col) => {
        if (!field) return;
        const v = (cells[col] || '').trim();
        if (field === 'date') r.date = parseDate(v);
        else if (TEXT_FIELDS.includes(field)) r[field] = v;
        else r[field] = num(v);
      });
      if (!r.feedBags) r.bagPrice = 0;
      if (r.date) out.push(r); else skipped++;
    });
    return { out, skipped };
  }

  function readFile(input, handler) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { handler(reader.result); }
      catch (err) { toast('Import failed: ' + err.message); }
      input.value = '';
    };
    reader.readAsText(file);
  }

  function mergeImported(list, label) {
    if (!list.length) { toast('No records found in that file'); return false; }
    if (records.length && confirm('Replace your ' + records.length + ' current records with the ' + list.length + ' from ' + label +
      '?\n\nPress Cancel to add them to your current records instead.')) {
      records = list;
    } else {
      records = records.concat(list);
    }
    persist();
    render();
    return true;
  }

  $('#importCsv').addEventListener('change', e => readFile(e.target, text => {
    const { out, skipped } = importCSV(text);
    if (mergeImported(out, 'the spreadsheet')) {
      toast('Imported ' + out.length + ' days' + (skipped ? ' (' + skipped + ' rows without a date skipped)' : ''));
    }
  }));

  $('#exportJson').addEventListener('click', () => {
    download('poultry-backup-' + todayISO() + '.json', JSON.stringify({ app: 'poultry-tracker', version: 1, settings, records }, null, 2), 'application/json');
  });

  $('#importJson').addEventListener('change', e => readFile(e.target, text => {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.records)) throw new Error('This is not a Poultry Tracker backup.');
    if (!confirm('Restore this backup? Your current records and settings will be replaced.')) return;
    settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
    records = data.records.filter(r => r && r.date);
    save(SETTINGS_KEY, settings);
    persist();
    fillSettings();
    render();
    toast('Backup restored (' + records.length + ' days)');
  }));

  $('#clearAll').addEventListener('click', () => {
    if (!records.length) { toast('There are no records to delete'); return; }
    if (!confirm('Delete ALL ' + records.length + ' records? Download a backup first if you might need them.')) return;
    records = [];
    persist();
    render();
    toast('All records deleted');
  });

  // ---------- Start ----------

  fillSettings();
  resetForm();
  render();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
