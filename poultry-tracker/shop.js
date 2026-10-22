/* Customer page: shows only the eggs available, the price per crate and the farm's details.
 * Reads two public documents that the managers' app keeps up to date; nothing else in the
 * database can be read without logging in. Updates live while the page is open. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const CONFIG = window.FIREBASE_CONFIG || null;
  let stock = null;
  let info = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(el);
    });
  }

  function money(n) {
    const cur = (info && info.currency) || 'GH₵';
    return cur + ' ' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  // WhatsApp needs the number with its country code; Ghana numbers starting with 0 become 233….
  function whatsappNumber(phone) {
    let digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = '233' + digits.slice(1);
    return digits;
  }

  function timeAgo(ms) {
    const mins = Math.round((Date.now() - ms) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return plural(mins, 'minute', 'minutes') + ' ago';
    const hours = Math.round(mins / 60);
    if (hours < 24) return plural(hours, 'hour', 'hours') + ' ago';
    return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  }


  function render() {
    if (!stock && !info) return;
    $('message').hidden = true;

    if (info) {
      if (info.farmName) {
        $('farmName').textContent = info.farmName;
        document.title = info.farmName + ' · Fresh Eggs';
      }
      $('priceCard').hidden = !info.pricePerCrate;
      $('price').textContent = money(info.pricePerCrate);
      $('descCard').hidden = !info.description;
      $('description').textContent = info.description || '';
      $('contact').hidden = !info.phone;
      if (info.phone) {
        $('callBtn').href = 'tel:' + String(info.phone).replace(/[^\d+]/g, '');
        $('waBtn').href = 'https://wa.me/' + whatsappNumber(info.phone) +
          '?text=' + encodeURIComponent('Hello, I would like to buy eggs.');
      }
    }

    if (stock) {
      const perCrate = stock.eggsPerCrate || 30;
      const eggs = Math.max(0, stock.eggs || 0);
      const crates = Math.floor(eggs / perCrate);
      const loose = eggs - crates * perCrate;
      const el = $('available');
      $('shop').hidden = false;
      if (crates > 0) {
        el.textContent = plural(crates, 'crate', 'crates');
        el.className = 'big ok';
        $('availableExtra').textContent = loose ? 'plus ' + plural(loose, 'egg', 'eggs') + ' (' + eggs + ' eggs in total)' : eggs + ' eggs';
      } else if (eggs > 0) {
        el.textContent = plural(eggs, 'egg', 'eggs');
        el.className = 'big ok';
        $('availableExtra').textContent = 'Less than a full crate left.';
      } else {
        el.textContent = 'Sold out';
        el.className = 'big out';
        $('availableExtra').textContent = 'Fresh eggs are collected every day. Please check back soon.';
      }
      $('crateSize').textContent = perCrate + ' eggs per crate';
      $('updated').textContent = stock.updatedAt ? 'Updated ' + timeAgo(stock.updatedAt) : '';
    }
  }

  async function start() {
    if (!CONFIG) {
      $('message').textContent = 'This page is not set up yet.';
      return;
    }
    try {
      await loadScript('vendor/firebase-app-compat.js?v=10.12.2');
      await loadScript('vendor/firebase-firestore-compat.js?v=10.12.2');
      const db = firebase.initializeApp(CONFIG).firestore();
      const emu = window.FIREBASE_EMULATOR;
      if (emu) db.useEmulator(emu.firestoreHost, emu.firestorePort);
      const fail = () => { if (!stock && !info) $('message').textContent = 'Egg availability is not available right now. Please try again later.'; };
      db.collection('public').doc('stock').onSnapshot(d => { stock = d.exists ? d.data() : null; render(); }, fail);
      db.collection('public').doc('info').onSnapshot(d => { info = d.exists ? d.data() : null; render(); }, fail);
      setInterval(render, 60000); // keep "Updated … ago" fresh
    } catch (err) {
      $('message').textContent = 'Could not load. Check your internet connection and reload.';
    }
  }

  start();
})();
