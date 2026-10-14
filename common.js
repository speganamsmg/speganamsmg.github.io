/* SPEGANA — fungsi bersama (halaman publik dan admin) */
(function () {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const App = (window.App = {});

  // ── Pembantu DOM ──
  App.el = function (tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  // Ikon SVG kecil. Semua isinya konstanta di bawah, bukan input pengguna.
  const PATHS = {
    link: '<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    chevleft: '<path d="M15 6l-6 6 6 6"/>',
    chevright: '<path d="M9 6l6 6-6 6"/>',
    arrow: '<path d="M7 17L17 7M8 7h9v9"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    form: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    install: '<rect x="6" y="3" width="12" height="18" rx="3"/><path d="M12 8v6M9 11.5l3 3 3-3"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.700 9.700 0 0 0 4.200-.9M9.900 9.900a3 3 0 0 0 4.200 4.200"/>',
    logout: '<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 8l4 4-4 4M20 12H9"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.700 1.700 0 0 0 .3 1.800l.1.1a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 1 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.100a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.1a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z"/>',
    users: '<circle cx="9" cy="8" r="3.500"/><path d="M2 20a7 7 0 0 1 14 0M16 4.500a3.500 3.500 0 0 1 0 7M18 14.500a7 7 0 0 1 4 5.500"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.500 6h.01M3.500 12h.01M3.500 18h.01"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.300 5.700M20 4v7h-7"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M9 8h6M9 12h6"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7 6.3 21l6.3-6.3a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    sheet: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>'
  };

  App.svg = function (name, cls) {
    const t = document.createElement('template');
    t.innerHTML =
      '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      (PATHS[name] || '') + '</svg>';
    return t.content.firstElementChild;
  };

  // ── Alamat ──
  // Tautan Google Drive (…/file/d/ID/view, open?id=ID, uc?id=ID) diubah jadi alamat gambar langsung.
  App.imgUrl = function (u) {
    u = String(u || '').trim();
    const m = u.match(/^https:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?(?:[^#]*&)?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,})/);
    return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1600' : u;
  };
  App.safeUrl = function (u) {
    try {
      const x = new URL(String(u || ''));
      return ['http:', 'https:', 'mailto:', 'tel:'].indexOf(x.protocol) >= 0 ? x.href : '';
    } catch (e) {
      return '';
    }
  };

  function safeHttps(u) {
    try {
      const x = new URL(String(u || ''));
      return x.protocol === 'https:' ? x.href : '';
    } catch (e) {
      return '';
    }
  }

  // ── Ikon item: bawaan, emoji, gambar, atau pustaka ikon ──
  App.icon = function (item) {
    const box = App.el('span', 'icon');
    box.setAttribute('aria-hidden', 'true');
    const jenis = item.ikon_jenis;
    const isi = String(item.ikon_isi || '');

    if (jenis === 'emoji' && isi) {
      box.classList.add('icon-emoji');
      box.textContent = isi;
    } else if (jenis === 'gambar' && isi) {
      const src = safeHttps(App.imgUrl(isi));
      if (src) {
        const img = new Image();
        img.alt = '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.src = src;
        box.append(img);
      }
    } else if (jenis === 'pustaka' && /^[a-z0-9]{1,50}$/.test(isi)) {
      const g = App.el('span', 'glyph');
      g.style.setProperty('--icon-url', 'url("' + (CFG.ICON_CDN || '') + isi + '.svg")');
      box.append(g);
    } else {
      box.append(App.svg(item.tipe === 'folder' ? 'folder' : item.tipe === 'form' ? 'form' : item.tipe === 'dashboard' ? 'chart' : 'link'));
    }
    return box;
  };

  // ── Teks bacaan: **tebal**, *miring*, daftar bernomor (1. ...), daftar butir (- ...) ──
  // Dibangun dengan DOM (bukan innerHTML), jadi isi dari admin tidak bisa menyisipkan HTML.
  function inline(parent, text) {
    String(text).split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/).forEach(function (part) {
      if (!part) return;
      if (/^\*\*[^*]+\*\*$/.test(part)) parent.append(App.el('strong', '', part.slice(2, -2)));
      else if (/^\*[^*\s][^*]*\*$/.test(part)) parent.append(App.el('em', '', part.slice(1, -1)));
      else parent.append(document.createTextNode(part));
    });
  }

  App.rich = function (text) {
    const frag = document.createDocumentFragment();
    let para = [];
    let list = null;

    function flushPara() {
      if (!para.length) return;
      const p = document.createElement('p');
      para.forEach(function (ln, i) {
        if (i) p.append(document.createElement('br'));
        inline(p, ln);
      });
      frag.append(p);
      para = [];
    }

    String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n').forEach(function (raw) {
      const line = raw.trim();
      if (!line) { flushPara(); list = null; return; }
      let m = /^(\d+)[.)]\s+(.*)$/.exec(line);
      let tag = 'ol';
      if (!m) { m = /^[-*\u2022]\s+(.*)$/.exec(line); tag = 'ul'; }
      if (m) {
        flushPara();
        if (!list || list.tagName.toLowerCase() !== tag) {
          list = document.createElement(tag);
          if (tag === 'ol') list.start = Number(m[1]) || 1;
          frag.append(list);
        }
        const li = document.createElement('li');
        inline(li, tag === 'ol' ? m[2] : m[1]);
        list.append(li);
        return;
      }
      list = null;
      para.push(line);
    });
    flushPara();
    return frag;
  };

  App.randomId = function (n) {
    const bytes = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.prototype.map.call(bytes, function (b) { return chars[b % chars.length]; }).join('');
  };

  // Pengenal perangkat untuk batas kirim per perangkat. Tersimpan di browser.
  App.deviceId = function () {
    let id = lsGet('dev_id');
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id || '')) {
      id = App.randomId(20);
      lsSet('dev_id', id);
    }
    return id;
  };

  App.fmtDateTime = function (iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
  };

  // ── Layar pembuka berlogo ──
  App.splash = {
    t0: performance.now(),
    hide: function (minMs) {
      const s = document.getElementById('splash');
      if (!s || s.dataset.leaving) return;
      s.dataset.leaving = '1';
      const wait = Math.max(0, (minMs || 0) - (performance.now() - App.splash.t0));
      setTimeout(function () {
        s.classList.add('out');
        setTimeout(function () { s.remove(); }, 700);
      }, wait);
    }
  };
  // Jaga-jaga: layar pembuka tidak boleh menutup halaman selamanya.
  setTimeout(function () { App.splash.hide(0); }, 15000);

  // ── Server ──
  App.configured = function () {
    return /^https:\/\/script\.google\.com\//.test(CFG.API_URL || '');
  };

  function apiError(message, code) {
    const e = new Error(message);
    e.code = code;
    return e;
  }

  // ── Popup loading: muncul bila proses lebih dari sekejap, hilang bila semua proses selesai ──
  const busy = { n: 0, timer: 0, shownAt: 0, layer: null };
  function busyLayer() {
    if (!busy.layer) {
      const l = document.createElement('div');
      l.className = 'busy-layer';
      l.setAttribute('role', 'status');
      l.setAttribute('aria-label', 'Memproses');
      l.innerHTML = '<div class="busy-pop"><span class="busy-logo"></span></div>';
      document.body.append(l);
      busy.layer = l;
    }
    return busy.layer;
  }
  App.loading = {
    start: function () {
      busy.n++;
      if (busy.n === 1) {
        clearTimeout(busy.timer);
        busy.timer = setTimeout(function () {
          if (document.getElementById('splash')) return; // layar pembuka masih menutup halaman
          busyLayer().classList.add('on');
          busy.shownAt = Date.now();
        }, 220);
      }
    },
    end: function () {
      busy.n = Math.max(0, busy.n - 1);
      if (busy.n === 0) {
        clearTimeout(busy.timer);
        if (!busy.layer) return;
        const wait = Math.max(0, 400 - (Date.now() - busy.shownAt)); // tampil minimal sebentar agar tidak berkedip
        setTimeout(function () { if (busy.n === 0) busy.layer.classList.remove('on'); }, busy.layer.classList.contains('on') ? wait : 0);
      }
    }
  };

  async function readResponse(fetching) {
    let res;
    try {
      res = await fetching;
    } catch (e) {
      throw apiError('Tidak bisa terhubung ke server. Periksa koneksi internet.', 'NETWORK');
    }
    let text = '';
    try { text = await res.text(); } catch (e) { /* kosong */ }
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      // Apps Script kadang membalas halaman HTML (kuota, server sibuk, atau akun Google ganda).
      try { console.warn('Balasan bukan JSON (HTTP ' + res.status + '):', text.slice(0, 300)); } catch (e2) { /* abaikan */ }
      throw apiError('Server sedang tidak merespons dengan benar (HTTP ' + res.status + '). Coba lagi sebentar.', 'BAD_RESPONSE');
    }
    if (!json.ok) throw apiError(json.error || 'Terjadi kesalahan.', json.code || 'ERROR');
    return json.data;
  }

  // Aksi yang aman diulang otomatis kalau balasan server rusak atau jaringan putus sesaat.
  const SAFE_POST = /^(login|admin\.(list|results|forms\.list|form\.get|names\.lists|names\.get))$/;
  function transient(err) { return err && (err.code === 'BAD_RESPONSE' || err.code === 'NETWORK'); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function withRetry(fn, safe) {
    try {
      return await fn();
    } catch (err) {
      if (!safe || !transient(err)) throw err;
      await wait(700);
      return fn();
    }
  }

  function needConfig() {
    if (!App.configured()) {
      throw apiError('config.js belum diisi dengan URL Web App.', 'CONFIG');
    }
  }

  // 'no-store' mencegah browser memakai balasan lama.
  // opts.silent: tanpa popup loading (untuk pembaruan di latar belakang).
  App.get = async function (params, opts) {
    needConfig();
    const show = !(opts && opts.silent);
    if (show) App.loading.start();
    try {
      return await withRetry(function () {
        const query = new URLSearchParams(Object.assign({}, params, { t: Date.now() }));
        return readResponse(fetch(CFG.API_URL + '?' + query, { cache: 'no-store' }));
      }, true);
    } finally {
      if (show) App.loading.end();
    }
  };

  // POST memakai text/plain agar browser tidak mengirim preflight CORS yang tidak didukung Apps Script.
  App.post = async function (payload, opts) {
    needConfig();
    const show = !(opts && opts.silent);
    if (show) App.loading.start();
    try {
      return await withRetry(function () {
        return readResponse(fetch(CFG.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        }));
      }, SAFE_POST.test(String(payload && payload.action)));
    } finally {
      if (show) App.loading.end();
    }
  };

  // Tombol mata untuk melihat password.
  App.passwordEye = function (input) {
    if (input.dataset.eye) return;
    input.dataset.eye = '1';
    const box = document.createElement('div');
    box.className = 'pw-box';
    input.parentNode.insertBefore(box, input);
    box.append(input);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pw-eye';
    b.setAttribute('aria-label', 'Tampilkan password');
    b.append(App.svg('eye'));
    b.addEventListener('click', function () {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
      b.replaceChildren(App.svg(show ? 'eyeoff' : 'eye'));
      input.focus();
    });
    box.append(b);
  };

  // Hitung klik tanpa menunda pengunjung membuka link.
  App.ping = function (id) {
    if (!App.configured()) return;
    const body = JSON.stringify({ action: 'click', id: id });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(CFG.API_URL, body)) return;
    } catch (e) { /* lanjut ke fetch */ }
    try {
      fetch(CFG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* abaikan */ }
  };

  // ── Pasang ke layar utama ──
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvent = e; });
  window.addEventListener('appinstalled', function () { installEvent = null; });

  function isStandalone() {
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function installHelp() {
    const d = document.createElement('dialog');
    d.className = 'install-dlg';
    const box = document.createElement('div');
    box.className = 'in';
    const h = document.createElement('h2');
    h.textContent = 'Tambahkan ke layar utama';
    const ol = document.createElement('ol');
    const steps = isIOS()
      ? ['Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas) di Safari.', 'Gulir lalu pilih <b>Tambahkan ke Layar Utama</b>.', 'Ketuk <b>Tambah</b>.']
      : ['Buka menu browser (titik tiga di pojok).', 'Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.', 'Konfirmasi dengan <b>Instal</b>.'];
    steps.forEach(function (t) { const li = document.createElement('li'); li.innerHTML = t; ol.append(li); }); // teks tetap di atas, bukan input pengguna
    const ok = document.createElement('button');
    ok.type = 'button'; ok.className = 'btn btn-primary'; ok.textContent = 'Mengerti';
    ok.addEventListener('click', function () { d.close(); });
    box.append(h, ol, ok);
    d.append(box);
    d.addEventListener('close', function () { d.remove(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    document.body.append(d);
    d.showModal();
  }

  // Dialog konfirmasi. Mengembalikan Promise<boolean>. lines: teks biasa (bukan HTML).
  // Jendela baca (popup) untuk teks panjang, mis. teks bacaan sebuah blok.
  App.readDialog = function (o) {
    const d = document.createElement('dialog');
    d.className = 'install-dlg read-dlg';
    const box = document.createElement('div'); box.className = 'in';
    const h = document.createElement('h2'); h.textContent = o.title; box.append(h);
    const body = document.createElement('div'); body.className = 'rich read-body'; body.append(App.rich(o.text)); box.append(body);
    const row = document.createElement('div'); row.className = 'dlg-actions';
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn btn-primary'; ok.textContent = o.close || 'Tutup';
    ok.addEventListener('click', function () { d.close(); });
    row.append(ok); box.append(row); d.append(box);
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    document.body.append(d); d.showModal(); ok.focus();
  };

  // Pemberitahuan "segera hadir": ikon renovasi bergerak (roda gigi berputar + palu mengetuk).
  App.soon = function (title) {
    const NS = 'http://www.w3.org/2000/svg';
    const d = document.createElement('dialog'); d.className = 'install-dlg soon-dlg';
    const box = document.createElement('div'); box.className = 'in';
    const art = document.createElement('div'); art.className = 'soon-art'; art.setAttribute('aria-hidden', 'true');
    art.innerHTML = '<svg viewBox="0 0 120 100" class="soon-svg">' +
      '<path class="soon-ground" d="M10 90h100"/>' +
      '<g class="soon-gear-big"><path d="M60 26l5 0 2 7 6 3 7-3 4 4-3 7 3 6 7 2v6l-7 2-3 6 3 7-4 4-7-3-6 3-2 7h-5l-2-7-6-3-7 3-4-4 3-7-3-6-7-2v-6l7-2 3-6-3-7 4-4 7 3 6-3z" transform="translate(-6 -2)"/><circle cx="54" cy="58" r="9"/></g>' +
      '<g class="soon-gear-small"><path d="M92 20l3 0 1 4 4 2 4-2 2 2-2 4 2 4 4 1v3l-4 1-2 4 2 4-2 2-4-2-4 2-1 4h-3l-1-4-4-2-4 2-2-2 2-4-2-4-4-1v-3l4-1 2-4-2-4 2-2 4 2 4-2z" transform="translate(-8 4) scale(.9)"/><circle cx="92" cy="40" r="5"/></g>' +
      '<g class="soon-hammer"><rect x="20" y="70" width="5" height="26" rx="2"/><rect x="11" y="63" width="23" height="11" rx="3"/></g>' +
      '<g class="soon-spark"><path d="M30 58l-6-6M36 54l-1-8M26 64l-8-2"/></g></svg>';
    const h = document.createElement('h2'); h.textContent = 'Sistem dalam pengembangan';
    const p1 = document.createElement('p'); p1.className = 'dlg-line'; p1.textContent = title + ' belum bisa dibuka karena sedang kami siapkan.';
    const p2 = document.createElement('p'); p2.className = 'dlg-line'; p2.textContent = 'Silakan kembali lagi nanti.';
    const row = document.createElement('div'); row.className = 'dlg-actions';
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn btn-primary'; ok.textContent = 'Mengerti';
    ok.addEventListener('click', function () { d.close(); });
    row.append(ok); box.append(art, h, p1, p2, row); d.append(box);
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    document.body.append(d); d.showModal(); ok.focus();
  };

  App.confirm = function (o) {
    return new Promise(function (resolve) {
      const d = document.createElement('dialog');
      d.className = 'install-dlg';
      const box = document.createElement('div');
      box.className = 'in';
      const h = document.createElement('h2');
      h.textContent = o.title;
      box.append(h);
      (o.lines || []).forEach(function (t) {
        const p = document.createElement('p');
        p.className = 'dlg-line';
        p.textContent = t;
        box.append(p);
      });
      const row = document.createElement('div');
      row.className = 'dlg-actions';
      const no = document.createElement('button');
      no.type = 'button'; no.className = 'btn'; no.textContent = o.cancel || 'Batal';
      const yes = document.createElement('button');
      yes.type = 'button'; yes.className = 'btn btn-primary'; yes.textContent = o.ok || 'Ya';
      let result = false;
      no.addEventListener('click', function () { d.close(); });
      yes.addEventListener('click', function () { result = true; d.close(); });
      row.append(no, yes);
      box.append(row);
      d.append(box);
      d.addEventListener('close', function () { d.remove(); resolve(result); });
      document.body.append(d);
      d.showModal();
      no.focus();
    });
  };

  // Memasang perilaku tombol "pasang ke layar". Tombol disembunyikan bila sudah terpasang sebagai aplikasi.
  App.installButton = function (btn) {
    if (isStandalone()) { btn.hidden = true; return; }
    btn.hidden = false;
    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      if (installEvent) {
        const ev = installEvent;
        installEvent = null;
        ev.prompt();
        try { await ev.userChoice; } catch (err) { /* abaikan */ }
      } else {
        installHelp();
      }
    });
  };

  // Service worker: perubahan file langsung tampil tanpa muat ulang paksa, dan situs bisa dipasang.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* abaikan */ });
    });
  }

  // ── Tema ──
  function lsGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ }
  }

  App.theme = {
    resolve: function (pref) {
      if (pref === 'light' || pref === 'dark') return pref;
      return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
    apply: function (pref) {
      document.documentElement.setAttribute('data-theme', App.theme.resolve(pref));
    },
    // Tema bawaan dari pengaturan admin. Dipakai bila pengunjung belum memilih sendiri.
    setDefault: function (pref) {
      lsSet('tema_def', pref);
      if (!lsGet('tema')) App.theme.apply(pref);
    },
    toggle: function () {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      lsSet('tema', next);
      App.theme.apply(next);
    }
  };

  if (window.matchMedia) {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (!lsGet('tema')) App.theme.apply(lsGet('tema_def') || 'auto');
    });
  }
})();
