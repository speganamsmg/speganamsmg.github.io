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

  function applySettings(s) {
    $('title').textContent = s.judul;
    $('subtitle').textContent = s.subjudul;
    $('subtitle').hidden = !s.subjudul;
    const d = $('desc');
    d.replaceChildren();
    if (s.deskripsi) d.append(App.rich(s.deskripsi));
    d.hidden = !s.deskripsi;
    App.theme.setDefault(s.tema);
  }

  function tile(item, count) {
    const a = el('a', 'tile tile-' + item.tipe);
    let closed = false;
    if (item.tipe === 'folder') {
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
    a.addEventListener('click', function () { App.ping(item.id); });

    a.append(App.icon(item), el('span', 'label', item.judul));
    if (item.tipe === 'folder') {
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

    const crumb = $('crumb');
    crumb.hidden = !folder;
    if (folder) {
      $('crumbTitle').textContent = folder.judul;
      const back = $('back');
      back.href = folder.parent_id ? '#/f/' + folder.parent_id : '#/';
      back.replaceChildren(App.svg('back'), document.createTextNode('Kembali'));
    }
    document.title = (folder ? folder.judul + ' — ' : '') + data.settings.judul;

    const counts = {};
    items.forEach(function (i) { counts[i.parent_id] = (counts[i.parent_id] || 0) + 1; });

    const nodes = items
      .filter(function (i) { return i.parent_id === folderId; })
      .map(function (i) { return tile(i, counts[i.id] || 0); })
      .filter(Boolean);

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
