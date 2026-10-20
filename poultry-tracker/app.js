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
 *
 * Partners: each partner's share = their contributions / all contributions.
 * Each month's profit is split by the shares as they stand at the end of that month.
 *
 * Logins: general manager (everything), sales manager (edit daily records),
 * guest (view and comment only).
 */
(function () {
  'use strict';

  const RECORDS_KEY = 'poultry.records.v1';
  const SETTINGS_KEY = 'poultry.settings.v1';
  const PARTNERS_KEY = 'poultry.partners.v1';
  const COMMENTS_KEY = 'poultry.comments.v1';
  const USERS_KEY = 'poultry.users.v1';
  const SESSION_KEY = 'poultry.session.v1';

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

  const ROLES = {
    gm: { label: 'General Manager', perms: ['edit', 'gm'] },
    sales: { label: 'Sales Manager', perms: ['edit'] },
    guest: { label: 'Guest', perms: [] },
  };

  // Contributions from the partners' "income and Expenses" sheet.
  const SEED_PARTNERS = {
    partners: [
      { id: 'norbert', name: 'Norbert' },
      { id: 'ally', name: 'Ally' },
      { id: 'frank', name: 'Frank' },
      { id: 'isaac', name: 'Isaac' },
      { id: 'bernard', name: 'Bernard' },
    ],
    rows: [
      ['2026-04-01', 'Opening balance', '', { norbert: 28674, ally: 22500, frank: 1752, isaac: 5578, bernard: 19000 }],
      ['2026-04-30', '31st April, 2026', 'The sheet says 31st April; saved as 30th April.', { ally: 600 }],
      ['2026-04-30', '', 'This row had no date in the sheet.', { norbert: 200, isaac: 1400 }],
      ['2026-05-20', '', '', { ally: 2000, bernard: 4000 }],
      ['2026-06-18', '', '', { norbert: 400 }],
      ['2026-06-20', '', '', { ally: 500 }],
      ['2026-06-30', '', '', { bernard: 1120 }],
      ['2026-07-21', '', '', { norbert: 2500 }],
      ['2026-07-24', '', '', { norbert: 1300, ally: 1300, bernard: 1300 }],
      ['2026-08-04', '', '', { norbert: 900 }],
      ['2026-08-06', '', '', { norbert: 500, ally: 1350 }],
      ['2026-08-26', '', '', { norbert: 100, ally: 1100, frank: 100, isaac: 100, bernard: 965 }],
      ['2026-08-31', '', '', { norbert: 350, bernard: 350 }],
      ['2026-09-15', '', '', { norbert: 350 }],
      ['2026-09-17', '', '', { norbert: 1300, bernard: 350 }],
      ['2026-09-19', '', '', { ally: 150 }],
      ['2026-09-26', '', '', { norbert: 252, ally: 500, isaac: 736 }],
      ['2026-10-03', '', '', { norbert: 100, ally: 1100, frank: 100, isaac: 10358, bernard: 100 }],
      ['2026-10-05', '', '', { norbert: 150 }],
      ['2026-10-07', '', '', { isaac: 453 }],
      ['2026-10-09', '', '', { ally: 700 }],
    ].map((r, i) => ({ id: 'seed' + i, date: r[0], label: r[1], note: r[2], amounts: r[3], created: i })),
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
  let partnerData = load(PARTNERS_KEY, null) || JSON.parse(JSON.stringify(SEED_PARTNERS));
  let comments = load(COMMENTS_KEY, []);
  let users = load(USERS_KEY, null);
  // The login lasts until the app or tab is closed, so the next person always starts at the login page.
  let session = loadSession();

  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }

  function saveSession(value) {
    try {
      if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (e) { /* the login then lasts only until the page reloads */ }
  }

  function persist() {
    save(RECORDS_KEY, records);
  }

  function persistPartners() {
    save(PARTNERS_KEY, partnerData);
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

  function pct(n) {
    return round(n * 100, 2).toFixed(2) + '%';
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

  // ---------- Logins ----------

  function can(perm) {
    return !!session && ROLES[session.role].perms.includes(perm);
  }

  function randomSalt() {
    const a = new Uint8Array(12);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 256; });
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }

  // SHA-256 where the browser supports it; a simple hash otherwise (e.g. some file:// pages).
  async function hashPassword(password, salt, algo) {
    const text = salt + ':' + password;
    if (algo === 'sha256') {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 0x811c9dc5;
    for (let round = 0; round < 1000; round++) {
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
    }
    return h.toString(16);
  }

  async function makeLogin(password) {
    const algo = window.crypto && crypto.subtle ? 'sha256' : 'simple';
    const salt = randomSalt();
    return { algo, salt, hash: await hashPassword(password, salt, algo) };
  }

  async function checkLogin(role, password) {
    const u = users && users[role];
    if (!u) return false;
    if (u.algo === 'sha256' && !(window.crypto && crypto.subtle)) {
      throw new Error('Open the app from its web address (https) to log in.');
    }
    return (await hashPassword(password, u.salt, u.algo)) === u.hash;
  }

  // First-time setup only appears on the general manager's setup link (index.html#setup).
  // Everyone else only ever sees the login form.
  function isSetupLink() {
    return /^#setup$/i.test(location.hash);
  }

  function showLogin() {
    document.body.className = 'logged-out';
    $('#loginFarm').textContent = settings.farmName || 'Poultry Tracker';
    const setup = !users && isSetupLink();
    $('#setupForm').hidden = !setup;
    $('#notSetUp').hidden = !!users || setup;
    $('#loginForm').hidden = !users;
    $('#loginError').textContent = '';
    const f = $('#loginForm');
    f.elements.password.value = '';
    const last = load(SESSION_KEY + '.last', null);
    if (last) {
      f.elements.name.value = last.name || '';
      const radio = f.querySelector('input[value="' + last.role + '"]');
      if (radio) radio.checked = true;
    }
  }

  function startSession() {
    document.body.className = '';
    document.body.classList.toggle('can-edit', can('edit'));
    document.body.classList.toggle('can-gm', can('gm'));
    $('#whoAmI').textContent = (session.name ? session.name + ' · ' : '') + ROLES[session.role].label;
    fillSettings();
    resetForm();
    render();
    go('dashboard');
  }

  window.addEventListener('hashchange', () => {
    if (!session) showLogin();
  });

  $('#setupForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (users) return;
    const f = e.target;
    const pw = { gm: f.elements.gm.value, sales: f.elements.sales.value, guest: f.elements.guest.value };
    if (new Set(Object.values(pw)).size < 3) {
      toast('Use a different password for each login');
      return;
    }
    users = {};
    for (const role of Object.keys(ROLES)) users[role] = await makeLogin(pw[role]);
    save(USERS_KEY, users);
    f.reset();
    history.replaceState(null, '', location.pathname + location.search);
    showLogin();
    toast('Passwords saved. Log in as the general manager.');
  });

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const role = f.elements.role.value;
    const name = f.elements.name.value.trim();
    try {
      if (!(await checkLogin(role, f.elements.password.value))) {
        $('#loginError').textContent = 'Wrong password for ' + ROLES[role].label + '.';
        return;
      }
    } catch (err) {
      $('#loginError').textContent = err.message;
      return;
    }
    session = { role, name };
    saveSession(session);
    save(SESSION_KEY + '.last', session);
    startSession();
  });

  $('#logoutBtn').addEventListener('click', () => {
    session = null;
    saveSession(null);
    showLogin();
  });

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

  // Total contributed by each partner, counting rows dated on or before `upTo` (all rows if omitted).
  function contributions(upTo) {
    const byPartner = {};
    partnerData.partners.forEach(p => { byPartner[p.id] = 0; });
    partnerData.rows.forEach(r => {
      if (upTo && r.date > upTo) return;
      Object.keys(r.amounts || {}).forEach(id => {
        if (id in byPartner) byPartner[id] += num(r.amounts[id]);
      });
    });
    const total = Object.values(byPartner).reduce((s, v) => s + v, 0);
    const share = {};
    Object.keys(byPartner).forEach(id => { share[id] = total ? byPartner[id] / total : 0; });
    return { byPartner, total, share };
  }

  function rowTotal(r) {
    return partnerData.partners.reduce((s, p) => s + num((r.amounts || {})[p.id]), 0);
  }

  // ---------- Navigation ----------

  const VIEW_PERMS = { add: 'edit', contribution: 'gm', settings: 'gm' };

  function go(view) {
    if (VIEW_PERMS[view] && !can(VIEW_PERMS[view])) view = 'dashboard';
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    const tab = view === 'detail' ? 'records' : view === 'contribution' ? 'partners' : view;
    $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.goto === tab));
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-goto]');
    if (!btn) return;
    if (btn.dataset.goto === 'add') resetForm();
    if (btn.dataset.goto === 'contribution') resetContribForm();
    go(btn.dataset.goto);
  });

  // ---------- Comments ----------

  function commentsFor(target) {
    return comments.filter(c => c.target === target).sort((a, b) => a.time - b.time);
  }

  function renderComments(target, el) {
    const list = commentsFor(target);
    const html = list.map(c => {
      const mine = session && c.role === session.role && c.author === (session.name || '');
      const when = new Date(c.time).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return '<div class="comment"><div class="who"><span><b>' + esc(c.author || ROLES[c.role].label) + '</b> · ' + esc(ROLES[c.role].label) +
        ' · ' + esc(when) + '</span>' + (mine || can('gm') ? '<button class="del" data-del-comment="' + esc(c.id) + '">Delete</button>' : '') +
        '</div><p>' + esc(c.text) + '</p></div>';
    }).join('');
    el.innerHTML = (html || '<div class="empty">No comments yet.</div>') +
      '<form class="comment-form" data-target="' + esc(target) + '">' +
        '<textarea name="text" rows="2" placeholder="Write a comment…" required></textarea>' +
        '<div class="form-actions"><button type="submit" class="btn primary">Post comment</button></div>' +
      '</form>';
  }

  document.addEventListener('submit', e => {
    const form = e.target.closest('.comment-form');
    if (!form || !session) return;
    e.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text) return;
    comments.push({ id: uid(), target: form.dataset.target, author: session.name || '', role: session.role, text, time: Date.now() });
    save(COMMENTS_KEY, comments);
    renderComments(form.dataset.target, form.parentElement);
    render();
    toast('Comment posted');
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-del-comment]');
    if (!btn) return;
    const c = comments.find(x => x.id === btn.dataset.delComment);
    if (!c || !confirm('Delete this comment?')) return;
    comments = comments.filter(x => x.id !== c.id);
    save(COMMENTS_KEY, comments);
    renderComments(c.target, btn.closest('.comments'));
    render();
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
    html += card('Partners\' capital', money(contributions().total), '', partnerData.partners.length + ' partners');
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
        '<div class="recent-item" data-open="' + esc(r.id) + '">' +
          '<span class="d">' + esc(showDate(r.date)) + commentBadge(r.id) + '</span>' +
          '<span class="r">' + esc(money(r.salesTotal)) + '</span>' +
          '<span class="m">' + fmt(num(r.eggs), 0) + ' eggs · ' + fmt(num(r.cratesSold)) + (num(r.cratesSold) === 1 ? ' crate' : ' crates') + ' sold</span>' +
          '<span class="m r">stock ' + fmt(r.remaining, 0) + '</span>' +
        '</div>').join('')
      : '<div class="empty">No records yet.' + (can('edit') ? ' Tap <b>＋ Add</b> to record your first day.' : '') + '</div>';
  }

  function commentBadge(id) {
    const n = commentsFor('record:' + id).length;
    return n ? '<span class="cmt-count">💬' + n + '</span>' : '';
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
      tbody.innerHTML = '<tr class="static"><td colspan="17" class="text" style="text-align:center;color:var(--muted)">No records yet.</td></tr>';
      $('#sheetTable tfoot').innerHTML = '';
      return;
    }

    tbody.innerHTML = shown.map(r =>
      '<tr data-open="' + esc(r.id) + '">' +
        '<td>' + esc(showDate(r.date)) + commentBadge(r.id) + '</td>' +
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
    const byMonth = groupByMonth(rows);
    const keys = Object.keys(byMonth).sort().reverse();
    const line = (label, t) =>
      '<td>' + esc(label) + '</td><td>' + fmt(t.eggs, 0) + '</td><td>' + fmt(t.cratesSold) + '</td>' +
      '<td class="blue">' + fmt(t.sales) + '</td><td class="red">' + fmt(t.feed) + '</td><td class="red">' + fmt(t.expenses) + '</td>' +
      '<td>' + fmt(t.cashAdded) + '</td><td class="' + (t.profit < 0 ? 'neg' : 'bold') + '">' + fmt(t.profit) + '</td><td>' + fmt(t.giveaway, 0) + '</td>';

    $('#summaryTable tbody').innerHTML = keys.length
      ? keys.map(k => '<tr class="static">' + line(monthName(k), totals(byMonth[k])) + '</tr>').join('')
      : '<tr class="static"><td colspan="9" class="text" style="text-align:center;color:var(--muted)">No records yet.</td></tr>';
    $('#summaryTable tfoot').innerHTML = keys.length ? '<tr>' + line('All time', totals(rows)) + '</tr>' : '';
  }

  function groupByMonth(rows) {
    const byMonth = {};
    rows.forEach(r => {
      (byMonth[monthKey(r.date)] = byMonth[monthKey(r.date)] || []).push(r);
    });
    return byMonth;
  }

  function lastDayOfMonth(key) {
    const [y, m] = key.split('-').map(Number);
    return key + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
  }

  function renderPartners(rows) {
    const partners = partnerData.partners;
    const all = contributions();

    $('#shareBars').innerHTML = partners.length
      ? partners.slice().sort((a, b) => all.byPartner[b.id] - all.byPartner[a.id]).map(p =>
        '<div class="bar-row"><div class="top"><b>' + esc(p.name) + '</b><span>' + esc(money(all.byPartner[p.id])) + ' · ' + pct(all.share[p.id]) + '</span></div>' +
        '<div class="bar-track" role="img" aria-label="' + esc(p.name + ' ' + pct(all.share[p.id])) + '"><div class="bar-fill" style="width:' + (all.share[p.id] * 100).toFixed(2) + '%"></div></div></div>'
      ).join('')
      : '<div class="empty">No partners yet.</div>';

    // Contributions table, laid out like the sheet: one row per date, one column per partner.
    const head = '<tr><th>Date</th>' + partners.map(p => '<th>' + esc(p.name) + '</th>').join('') + '<th>Total</th></tr>';
    $('#contribTable thead').innerHTML = head;
    const list = sorted(partnerData.rows);
    $('#contribTable tbody').innerHTML = list.length
      ? list.map(r =>
        '<tr' + (can('gm') ? ' data-contrib="' + esc(r.id) + '"' : ' class="static"') + '>' +
          '<td>' + esc(r.label || showDate(r.date)) + (r.label ? '<small>' + esc(showDate(r.date)) + '</small>' : '') +
            (r.note ? '<small>' + esc(r.note) + '</small>' : '') + '</td>' +
          partners.map(p => '<td>' + blankIfZero(num((r.amounts || {})[p.id]), v => fmt(v)) + '</td>').join('') +
          '<td class="bold">' + fmt(rowTotal(r)) + '</td>' +
        '</tr>').join('')
      : '<tr class="static"><td colspan="' + (partners.length + 2) + '" class="text" style="text-align:center;color:var(--muted)">No contributions yet.</td></tr>';
    $('#contribTable tfoot').innerHTML =
      '<tr><td>TOTAL</td>' + partners.map(p => '<td>' + fmt(all.byPartner[p.id]) + '</td>').join('') + '<td>' + fmt(all.total) + '</td></tr>' +
      '<tr class="share"><td>Share %</td>' + partners.map(p => '<td>' + pct(all.share[p.id]) + '</td>').join('') + '<td>' + (all.total ? '100.00%' : '') + '</td></tr>';

    // Each partner's income per month.
    $('#incomeTable thead').innerHTML = '<tr><th>Month</th><th>Profit</th>' + partners.map(p => '<th>' + esc(p.name) + '</th>').join('') + '</tr>';
    const byMonth = groupByMonth(rows);
    const months = Object.keys(byMonth).sort().reverse();
    const thisMonth = monthKey(todayISO());
    const earned = {};
    partners.forEach(p => { earned[p.id] = 0; });
    $('#incomeTable tbody').innerHTML = months.length
      ? months.map(k => {
        const profit = totals(byMonth[k]).profit;
        const c = contributions(lastDayOfMonth(k));
        partners.forEach(p => { earned[p.id] += profit * c.share[p.id]; });
        return '<tr class="static"><td>' + esc(monthName(k)) + (k === thisMonth ? '<small>so far</small>' : '') + '</td>' +
          '<td class="' + (profit < 0 ? 'neg' : 'bold') + '">' + fmt(profit) + '</td>' +
          partners.map(p => '<td class="' + (profit < 0 ? 'red' : 'blue') + '">' + fmt(profit * c.share[p.id]) + '<small>' + pct(c.share[p.id]) + '</small></td>').join('') +
        '</tr>';
      }).join('')
      : '<tr class="static"><td colspan="' + (partners.length + 2) + '" class="text" style="text-align:center;color:var(--muted)">Add daily records to see each partner\'s income.</td></tr>';
    $('#incomeTable tfoot').innerHTML = months.length
      ? '<tr><td>All time</td><td>' + fmt(totals(rows).profit) + '</td>' + partners.map(p => '<td>' + fmt(earned[p.id]) + '</td>').join('') + '</tr>'
      : '';

    renderComments('partners', $('#partnerComments'));
    renderPartnerNames();
  }

  function render() {
    const rows = compute(records);
    $('#farmTitle').textContent = settings.farmName || 'Poultry Tracker';
    document.title = settings.farmName ? settings.farmName + ' · Poultry Tracker' : 'Poultry Tracker';
    renderDashboard(rows);
    renderRecords(rows);
    renderSummary(rows);
    renderPartners(rows);
  }

  $('#recordsMonth').addEventListener('change', render);

  // ---------- One day: details + comments ----------

  let openRecordId = null;

  function openRecord(id) {
    const r = compute(records).find(x => x.id === id);
    if (!r) return;
    openRecordId = id;
    $('#detailTitle').textContent = showDate(r.date);
    const item = (label, value, cls) => '<dt>' + esc(label) + '</dt><dd class="' + (cls || '') + '">' + esc(value) + '</dd>';
    const long = (label, value) => value ? '<dt>' + esc(label) + '</dt><dd></dd><dd class="long">' + esc(value) + '</dd>' : '';
    $('#detailList').innerHTML =
      item('No. of eggs', fmt(num(r.eggs), 0)) +
      item('Total crates', fmt(r.crates)) +
      item('Price per crate', money(num(r.cratePrice))) +
      item('Crates sold', fmt(num(r.cratesSold))) +
      item('Sales total', money(r.salesTotal)) +
      item('Income generated (month)', money(r.incomeGenerated), 'blue') +
      item('Feed bags bought', fmt(num(r.feedBags))) +
      (num(r.feedBags) ? item('Price per bag', money(num(r.bagPrice))) : '') +
      item('Feed total', money(r.feedTotal)) +
      (num(r.cashAdded) ? item('Money added', money(num(r.cashAdded)), 'blue') : '') +
      (r.expenseDesc || num(r.expenseAmt) ? item(r.expenseDesc || 'Other expense', money(num(r.expenseAmt)), 'red') : '') +
      item('Income left', money(r.incomeLeft)) +
      item('Eggs giveaway', fmt(num(r.giveaway), 0)) +
      item('Remaining eggs', fmt(r.remaining, 0), 'cyan') +
      long('Note', r.note);
    renderComments('record:' + id, $('#detailComments'));
    go('detail');
  }

  document.addEventListener('click', e => {
    const row = e.target.closest('[data-open]');
    if (row) openRecord(row.dataset.open);
  });

  $('#detailEdit').addEventListener('click', () => {
    if (openRecordId) editRecord(openRecordId);
  });

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
    if (!r || !can('edit')) return;
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
    if (!can('edit')) return;
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
    if (!can('edit')) return;
    const id = form.elements.id.value;
    const r = records.find(x => x.id === id);
    if (!r || !confirm('Delete the record for ' + showDate(r.date) + '?')) return;
    records = records.filter(x => x.id !== id);
    comments = comments.filter(c => c.target !== 'record:' + id);
    persist();
    save(COMMENTS_KEY, comments);
    render();
    toast('Record deleted');
    resetForm();
    go('records');
  });

  // ---------- Contributions (general manager) ----------

  const contribForm = $('#contribForm');

  function renderContribInputs(amounts) {
    $('#contribAmounts').innerHTML = '<legend>Amount from each partner</legend>' + partnerData.partners.map(p =>
      '<label class="field"><span>' + esc(p.name) + '</span><input type="number" name="amt-' + esc(p.id) + '" min="0" step="any" inputmode="decimal" value="' +
      (num((amounts || {})[p.id]) || '') + '"></label>').join('');
  }

  function resetContribForm() {
    contribForm.reset();
    contribForm.elements.id.value = '';
    contribForm.elements.date.value = todayISO();
    renderContribInputs({});
    $('#contribTitle').textContent = 'Add contribution';
    $('#deleteContrib').hidden = true;
    updateContribPreview();
  }

  function editContrib(id) {
    const r = partnerData.rows.find(x => x.id === id);
    if (!r || !can('gm')) return;
    contribForm.reset();
    contribForm.elements.id.value = r.id;
    contribForm.elements.date.value = r.date;
    contribForm.elements.label.value = r.label || '';
    contribForm.elements.note.value = r.note || '';
    renderContribInputs(r.amounts);
    $('#contribTitle').textContent = 'Edit contribution';
    $('#deleteContrib').hidden = false;
    updateContribPreview();
    go('contribution');
  }

  function readContribForm() {
    const amounts = {};
    partnerData.partners.forEach(p => {
      const v = num(contribForm.elements['amt-' + p.id].value);
      if (v) amounts[p.id] = v;
    });
    const id = contribForm.elements.id.value || uid();
    const existing = partnerData.rows.find(x => x.id === id);
    return {
      id,
      date: contribForm.elements.date.value,
      label: contribForm.elements.label.value.trim(),
      note: contribForm.elements.note.value.trim(),
      amounts,
      created: existing ? existing.created : Date.now(),
    };
  }

  function updateContribPreview() {
    const draft = readContribForm();
    $('#contribPreview').innerHTML = '<div>Total of this contribution<b>' + esc(money(rowTotal(draft))) + '</b></div>';
  }

  contribForm.addEventListener('input', updateContribPreview);

  document.addEventListener('click', e => {
    const row = e.target.closest('[data-contrib]');
    if (row) editContrib(row.dataset.contrib);
  });

  contribForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!can('gm')) return;
    const r = readContribForm();
    if (!r.date) { toast('Please pick a date'); return; }
    if (!rowTotal(r)) { toast('Enter an amount for at least one partner'); return; }
    const i = partnerData.rows.findIndex(x => x.id === r.id);
    if (i >= 0) partnerData.rows[i] = r; else partnerData.rows.push(r);
    persistPartners();
    render();
    toast(i >= 0 ? 'Contribution updated' : 'Contribution added');
    go('partners');
  });

  $('#deleteContrib').addEventListener('click', () => {
    if (!can('gm')) return;
    const id = contribForm.elements.id.value;
    if (!confirm('Delete this contribution?')) return;
    partnerData.rows = partnerData.rows.filter(x => x.id !== id);
    persistPartners();
    render();
    toast('Contribution deleted');
    go('partners');
  });

  // ---------- Manage partners (general manager) ----------

  const partnersForm = $('#partnersForm');

  function renderPartnerNames() {
    $('#partnerNames').innerHTML = partnerData.partners.map(p =>
      '<label class="field"><span>Partner name</span><input type="text" name="name-' + esc(p.id) + '" value="' + esc(p.name) + '" required></label>').join('');
  }

  partnersForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!can('gm')) return;
    partnerData.partners.forEach(p => {
      const v = partnersForm.elements['name-' + p.id].value.trim();
      if (v) p.name = v;
    });
    const newName = partnersForm.elements.newPartner.value.trim();
    if (newName) partnerData.partners.push({ id: uid(), name: newName });
    partnersForm.elements.newPartner.value = '';
    persistPartners();
    render();
    toast(newName ? newName + ' added as a partner' : 'Partners saved');
  });

  // ---------- Settings (general manager) ----------

  const settingsForm = $('#settingsForm');

  function fillSettings() {
    Object.keys(DEFAULT_SETTINGS).forEach(k => {
      settingsForm.elements[k].value = settings[k];
    });
  }

  settingsForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!can('gm')) return;
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

  $('#passwordForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!can('gm')) return;
    const f = e.target;
    const role = f.elements.role.value;
    users[role] = await makeLogin(f.elements.password.value);
    save(USERS_KEY, users);
    f.reset();
    toast(ROLES[role].label + ' password changed');
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
    if (!can('gm')) return;
    const { out, skipped } = importCSV(text);
    if (mergeImported(out, 'the spreadsheet')) {
      toast('Imported ' + out.length + ' days' + (skipped ? ' (' + skipped + ' rows without a date skipped)' : ''));
    }
  }));

  $('#exportJson').addEventListener('click', () => {
    download('poultry-backup-' + todayISO() + '.json',
      JSON.stringify({ app: 'poultry-tracker', version: 2, settings, records, partners: partnerData, comments, users }, null, 2), 'application/json');
  });

  $('#importJson').addEventListener('change', e => readFile(e.target, text => {
    if (!can('gm')) return;
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.records)) throw new Error('This is not a Poultry Tracker backup.');
    if (!confirm('Restore this backup? Your current records, partners, comments and settings will be replaced.')) return;
    settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
    records = data.records.filter(r => r && r.date);
    if (data.partners && Array.isArray(data.partners.rows)) partnerData = data.partners;
    comments = Array.isArray(data.comments) ? data.comments : [];
    if (data.users && data.users.gm) users = data.users;
    save(SETTINGS_KEY, settings);
    persist();
    persistPartners();
    save(COMMENTS_KEY, comments);
    save(USERS_KEY, users);
    fillSettings();
    render();
    toast('Backup restored (' + records.length + ' days)');
  }));

  $('#clearAll').addEventListener('click', () => {
    if (!can('gm')) return;
    if (!records.length) { toast('There are no records to delete'); return; }
    if (!confirm('Delete ALL ' + records.length + ' daily records? Download a backup first if you might need them.')) return;
    records = [];
    comments = comments.filter(c => !c.target.startsWith('record:'));
    persist();
    save(COMMENTS_KEY, comments);
    render();
    toast('All records deleted');
  });

  // ---------- Start ----------

  if (!load(PARTNERS_KEY, null)) persistPartners();

  if (users && session && ROLES[session.role]) startSession();
  else showLogin();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
