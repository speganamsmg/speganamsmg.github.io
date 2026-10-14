/* SPEGANA — halaman publik */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const el = App.el;
  const CACHE_KEY = 'pub_cache_v1';
  let data = null;

  // Tombol tema: ikon bulan dan matahari, CSS memilih yang tampil.
  const themeBtn = $('themeBtn');
  themeBtn.append(App.svg('moon', 'moon'), App.svg('sun', 'sun'));
  themeBtn.addEventListener('click', App.theme.toggle);
  $('adminLink').append(App.svg('user'));
  $('installBtn').append(App.svg('install'));
  App.installButton($('installBtn'));

  // Daftar terakhir disimpan di perangkat, jadi halaman langsung tampil
  // sementara Apps Script (yang lambat) menyiapkan data terbaru.
  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; }
  }
  function writeCache(d) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch (e) { /* abaikan */ }
  }

  function currentFolderId() {
    const m = /^#\/f\/([\w-]+)$/.exec(location.hash);
    return m ? m[1] : '';
  }

  let qrOn = true;

  // Tab audiens diatur admin (Pengaturan → Tab halaman utama). "Semua" selalu ada di depan.
  // Tab yang tidak punya item sendiri disembunyikan.
  const GRUP_BAWAAN = [
    { id: 'gtk', nama: 'Guru dan Tendik' }, { id: 'guru', nama: 'Guru' },
    { id: 'tendik', nama: 'Tendik' }, { id: 'murid', nama: 'Murid' }
  ];
  function grupList() {
    const g = data && data.settings && data.settings.grup;
    return Array.isArray(g) ? g : GRUP_BAWAAN;
  }
  function tabList() {
    const s = data && data.settings;
    const semua = !s || s.tab_semua !== 'tidak';
    const own = grupList().map(function (g) {
      return { id: g.id, nama: g.nama, ok: ['', g.id], ada: [g.id], qr: g.qr === true };
    });
    return semua ? [{ id: 'semua', nama: 'Semua', ok: null, ada: null, qr: true }].concat(own) : own;
  }
  const TAB_KEY = 'pub_tab_v2';
  let tab = 'semua';
  try { tab = localStorage.getItem(TAB_KEY) || 'semua'; } catch (e) { /* abaikan */ }

  // Folder tidak punya kategori sendiri: kategori diambil dari item (link/form/dashboard) di dalamnya, di kedalaman berapa pun.
  function leavesOf(items, folderId, acc) {
    items.forEach(function (i) {
      if (i.parent_id !== folderId) return;
      if (i.tipe === 'folder') leavesOf(items, i.id, acc); else acc.push(i);
    });
    return acc;
  }
  function isLeafMarked(i) { return i.tipe !== 'folder' && !!i.untuk; }

  function drawTabs(items, folder, onQr) {
    const box = $('audience');
    const marked = items.some(isLeafMarked);
    const visible = tabList().filter(function (t) {
      if (!t.ada) return true;
      return items.some(function (i) { return i.tipe !== 'folder' && t.ada.indexOf(i.untuk) >= 0; });
    });
    if (visible.length && !visible.some(function (t) { return t.id === tab; })) tab = visible[0].id;
    if (!marked || !visible.length) tab = 'semua'; // tidak ada item berlabel audiens: tanpa tab, semua item tampil
    box.hidden = !marked || !visible.length || !!folder || onQr;
    if (box.hidden) return;
    box.replaceChildren.apply(box, visible.map(function (t) {
      const b = el('button', 'aud-btn', t.nama); b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(t.id === tab));
      b.addEventListener('click', function () {
        tab = t.id;
        try { localStorage.setItem(TAB_KEY, tab); } catch (e) { /* abaikan */ }
        render();
      });
      return b;
    }));
  }

  function qrTile() {
    const a = el('a', 'tile tile-folder');
    a.href = '#/qr';
    a.append(App.icon({ tipe: 'folder', ikon_jenis: 'bawaan', ikon_isi: 'qr' }),
      el('span', 'label', (data && data.settings && data.settings.qr_judul) || 'Pembuat QR Code'),
      App.svg('chevron', 'trail'));
    const li = el('li'); li.append(a);
    return li;
  }

  function applySettings(s) {
    qrOn = s.qr_aktif !== 'tidak';
    if ($('qrTitle')) $('qrTitle').textContent = s.qr_judul || 'Pembuat QR Code';
    if ($('qrLead')) {
      $('qrLead').textContent = s.qr_keterangan === undefined ? 'Tempel link, lalu unduh QR-nya.' : s.qr_keterangan;
      $('qrLead').hidden = !$('qrLead').textContent;
    }
    $('title').textContent = s.judul;
    $('subtitle').textContent = s.subjudul;
    $('subtitle').hidden = !s.subjudul;
    const d = $('desc');
    d.replaceChildren();
    if (s.deskripsi) d.append(App.rich(s.deskripsi));
    d.hidden = !s.deskripsi;
    App.theme.setDefault(s.tema);
    const soc = $('social');
    if (soc) {
      const list = (Array.isArray(s.sosmed) ? s.sosmed : []).filter(function (x) { return App.safeUrl(x.url); });
      soc.replaceChildren.apply(soc, list.map(function (x) {
        const a = el('a', 'soc');
        a.href = App.safeUrl(x.url);
        a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.title = App.socialName(x.tipe);
        a.setAttribute('aria-label', App.socialName(x.tipe));
        a.append(App.socialIcon(x.tipe));
        return a;
      }));
      soc.hidden = !list.length;
    }
  }

  function tile(item, count) {
    const a = el('a', 'tile tile-' + item.tipe + (item.segera ? ' is-soon' : ''));
    let closed = false;
    if (item.segera) {
      a.href = '#'; a.setAttribute('role', 'button');
      a.addEventListener('click', function (e) { e.preventDefault(); App.soon(item.judul); });
    } else if (item.tipe === 'folder') {
      a.href = '#/f/' + item.id;
    } else if (item.tipe === 'dashboard') {
      if (!item.form || !item.form.slug) return null;
      a.href = 'dashboard.html?f=' + encodeURIComponent(item.form.slug);
    } else if (item.tipe === 'form') {
      if (!item.form || !item.form.slug) return null;
      a.href = 'form.html?f=' + encodeURIComponent(item.form.slug);
      const now = Date.now();
      closed = item.form.status !== 'buka' ||
        (item.form.buka && now < item.form.buka) || (item.form.tutup && now > item.form.tutup);
    } else {
      const u = App.safeUrl(item.url);
      if (!u) return null;
      a.href = u;
      if (/^https?:/i.test(u)) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    }
    if (!item.segera) a.addEventListener('click', function () { App.ping(item.id); });

    a.append(App.icon(item), el('span', 'label', item.judul));
    if (item.segera) {
      const soon = el('span', 'soon-badge'); soon.append(App.svg('wrench'), document.createTextNode('Segera'));
      a.append(soon);
    } else if (item.tipe === 'folder') {
      a.append(el('span', 'count', count + ' item'), App.svg('chevron', 'trail'));
    } else if (item.tipe === 'dashboard') {
      a.append(App.svg('chevron', 'trail'));
    } else if (item.tipe === 'form') {
      if (closed) a.append(el('span', 'count', 'Ditutup'));
      a.append(App.svg('chevron', 'trail'));
    } else {
      a.append(App.svg('arrow', 'trail'));
    }
    const li = el('li');
    li.append(a);
    return li;
  }

  function showState(title, text, retry) {
    const box = $('state');
    box.replaceChildren();
    const wrap = el('div', 'state');
    wrap.append(el('strong', '', title));
    if (text) wrap.append(document.createTextNode(text));
    if (retry) {
      const b = el('button', 'btn', 'Coba lagi');
      b.type = 'button';
      b.addEventListener('click', load);
      wrap.append(document.createElement('br'), b);
    }
    box.append(wrap);
  }

  function clearState() { $('state').replaceChildren(); }

  function showSkeleton() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 4; i++) {
      const li = el('li');
      li.append(el('div', 'skel'));
      frag.append(li);
    }
    $('list').replaceChildren(frag);
  }

  function render() {
    if (!data) return;
    const items = data.items;
    const folderId = currentFolderId();
    const folder = folderId
      ? items.filter(function (i) { return i.id === folderId && i.tipe === 'folder'; })[0]
      : null;

    if (folderId && !folder) { // folder sudah dihapus atau disembunyikan
      location.hash = '#/';
      return;
    }

    const onQr = location.hash === '#/qr' && qrOn;
    if (location.hash === '#/qr' && !qrOn) { location.hash = '#/'; return; }
    const crumb = $('crumb');
    crumb.hidden = !folder && !onQr;
    // Alat QR dibuka lewat tombol "folder" di halaman utama (#/qr), dan hanya bila diaktifkan admin.
    if ($('qrTool')) $('qrTool').hidden = !onQr;
    $('list').hidden = onQr;
    if (folder || onQr) {
      $('crumbTitle').textContent = onQr ? ((data.settings && data.settings.qr_judul) || 'Pembuat QR Code') : folder.judul;
      const back = $('back');
      back.href = onQr ? '#/' : (folder.parent_id ? '#/f/' + folder.parent_id : '#/');
      back.replaceChildren(App.svg('back'), document.createTextNode('Kembali'));
    }
    document.title = (onQr ? 'QR Code — ' : folder ? folder.judul + ' — ' : '') + data.settings.judul;
    drawTabs(items, folder, onQr);
    if (onQr) { clearState(); return; }

    const tabs = tabList();
    const marked = items.some(isLeafMarked);
    // Tanpa tab "Semua" dan tanpa item berlabel: semua item tampil tanpa tab; QR mengikuti tab Semua.
    const cur = (marked && tabs.filter(function (t) { return t.id === tab; })[0]) ||
      (marked ? tabs[0] : { id: 'semua', ok: null, qr: true });
    // Item biasa dicocokkan dengan kategorinya; folder tampil bila isinya (di kedalaman berapa pun) ada yang cocok.
    const leafCache = {};
    const leaves = function (id) { return leafCache[id] || (leafCache[id] = leavesOf(items, id, [])); };
    const okLeaf = function (i) { return !cur.ok || cur.ok.indexOf(i.untuk || '') >= 0; };
    const okItem = function (i) { return i.tipe === 'folder' ? (!cur.ok || leaves(i.id).some(okLeaf)) : okLeaf(i); };
    // Kelompok sebuah folder di tab Semua: kategori tunggal isinya; bila campuran, tanpa judul.
    const groupOf = function (i) {
      if (i.tipe !== 'folder') return i.untuk || '';
      const set = {};
      leaves(i.id).forEach(function (l) { if (l.untuk) set[l.untuk] = true; });
      const keys = Object.keys(set);
      return keys.length === 1 ? keys[0] : '';
    };
    const counts = {}; // jumlah isi folder = yang cocok dengan tab yang sedang dibuka
    items.forEach(function (i) { if (okItem(i)) counts[i.parent_id] = (counts[i.parent_id] || 0) + 1; });
    const here = items.filter(function (i) { return i.parent_id === folderId && okItem(i); });
    const grouped = cur.id === 'semua' && here.some(function (i) { return groupOf(i); });
    let nodes = [];
    if (!grouped) {
      nodes = here.map(function (i) { return tile(i, counts[i.id] || 0); }).filter(Boolean);
    } else {
      const add = function (list, nama) {
        const ts = list.map(function (i) { return tile(i, counts[i.id] || 0); }).filter(Boolean);
        if (!ts.length) return;
        if (nama) { const h = el('li', 'grp-head'); h.append(el('h3', '', nama)); nodes.push(h); }
        nodes = nodes.concat(ts);
      };
      add(here.filter(function (i) { return !groupOf(i); }), '');
      grupList().forEach(function (g) { add(here.filter(function (i) { return groupOf(i) === g.id; }), g.nama); });
    }
    if (!folder && qrOn && cur.qr) { // hanya di tab Semua, paling bawah, dengan judul sendiri bila item dikelompokkan
      if (grouped) { const h = el('li', 'grp-head'); h.append(el('h3', '', 'Fitur Lain')); nodes.push(h); }
      nodes.push(qrTile());
    }

    $('list').replaceChildren.apply($('list'), nodes);
    if (nodes.length) {
      clearState();
    } else if (folder) {
      showState('Folder ini masih kosong.', 'Belum ada isi yang ditampilkan di sini.');
    } else {
      showState('Belum ada tautan.', 'Halaman ini akan terisi setelah admin menambahkan tautan.');
    }
  }

  async function load() {
    const cached = readCache();
    if (cached && cached.settings && Array.isArray(cached.items)) {
      data = cached;
      applySettings(data.settings);
      render();
      App.splash.hide(700);
    } else {
      clearState();
      showSkeleton();
    }

    try {
      const fresh = await App.get({ action: 'public' }, { silent: !!cached });
      writeCache(fresh);
      if (!cached || JSON.stringify(cached) !== JSON.stringify(fresh)) {
        data = fresh;
        applySettings(fresh.settings);
        render();
      }
      App.splash.hide(1100);
    } catch (err) {
      App.splash.hide(400);
      if (cached) return; // tetap tampilkan daftar tersimpan
      $('list').replaceChildren();
      if (err.code === 'CONFIG') {
        showState('Halaman belum disambungkan.', 'Isi API_URL di config.js dengan URL Web App Apps Script.');
      } else {
        showState('Daftar tautan belum bisa dimuat.', err.message, true);
      }
    }
  }

  // Perubahan di Sheets tampil tanpa muat ulang: cek diam-diam saat tab dibuka kembali dan tiap menit.
  async function refreshQuiet() {
    if (document.hidden || !data) return;
    try {
      const fresh = await App.get({ action: 'public' }, { silent: true });
      writeCache(fresh);
      if (JSON.stringify(fresh) !== JSON.stringify(data)) {
        data = fresh;
        applySettings(fresh.settings);
        render();
      }
    } catch (e) { /* abaikan, coba lagi nanti */ }
  }
  document.addEventListener('visibilitychange', refreshQuiet);
  window.addEventListener('focus', refreshQuiet);
  setInterval(refreshQuiet, 60000);

  window.addEventListener('hashchange', function () {
    render();
    window.scrollTo(0, 0);
  });

  load();
})();
