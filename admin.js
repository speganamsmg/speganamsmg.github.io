/* SPEGANA — panel admin (tahap 1: link, folder, pengaturan) */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const el = App.el;
  const TOKEN_KEY = 'admin_token';

  const state = {
    items: [],
    settings: {},
    maxDepth: 3,
    forms: [],
    editingId: null,
    editingTipe: 'link',
    sortables: []
  };

  const byId = function (id) {
    return state.items.filter(function (i) { return i.id === id; })[0];
  };

  // ── Sesi ──
  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* abaikan */ }
  }

  async function call(action, payload, opts) {
    try {
      return await App.post(Object.assign({ action: action, token: getToken() }, payload || {}), opts);
    } catch (err) {
      if (err.code === 'AUTH') {
        setToken('');
        showLogin('Sesi berakhir. Silakan masuk lagi.');
      }
      throw err;
    }
  }

  // ── Tampilan umum ──
  let toastTimer;
  function toast(message, isError) {
    const t = $('toast');
    t.textContent = message;
    t.className = 'show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, 3200);
  }

  function showLogin(message) {
    $('appView').hidden = true;
    $('loginView').hidden = false;
    $('loginMsg').textContent = message || '';
    $('pw').focus();
  }

  function showApp() {
    $('loginView').hidden = true;
    $('appView').hidden = false;
    if (!window.__prefetched) { window.__prefetched = true; setTimeout(prefetch, 400); }
  }

  function setBusy(button, busy) {
    button.disabled = busy;
    button.classList.toggle('is-busy', busy);
  }

  // ── Struktur pohon ──
  function groupByParent() {
    const map = new Map();
    state.items.forEach(function (i) {
      if (!map.has(i.parent_id)) map.set(i.parent_id, []);
      map.get(i.parent_id).push(i);
    });
    map.forEach(function (arr) { arr.sort(function (a, b) { return a.urutan - b.urutan; }); });
    return map;
  }

  function folderHeight(id, map) {
    const kids = (map.get(id) || []).filter(function (i) { return i.tipe === 'folder'; });
    return 1 + kids.reduce(function (mx, k) { return Math.max(mx, folderHeight(k.id, map)); }, 0);
  }

  function descendants(id, map) {
    const out = [];
    (map.get(id) || []).forEach(function (k) {
      out.push(k.id);
      descendants(k.id, map).forEach(function (d) { out.push(d); });
    });
    return out;
  }

  function untukNama(id) {
    const g = (state.settings.grup || []).filter(function (x) { return x.id === id; })[0];
    return g ? g.nama : id;
  }

  function payload(it, over) {
    return Object.assign({
      id: it.id, tipe: it.tipe, judul: it.judul, url: it.url, form_id: it.form_id || '',
      ikon_jenis: it.ikon_jenis, ikon_isi: it.ikon_isi,
      ikon_warna: it.ikon_warna || '', ikon_bentuk: it.ikon_bentuk || '',
      parent_id: it.parent_id, tampil: it.tampil, segera: it.segera === true, untuk: it.untuk || '', pakai_sandi: it.pakai_sandi === true
    }, over || {});
  }

  function metaText(it, map) {
    if (it.tipe === 'folder') return (map.get(it.id) || []).length + ' isi';
    if (it.tipe === 'form' || it.tipe === 'dashboard') {
      const f = state.forms.filter(function (x) { return x.form_id === it.form_id; })[0];
      if (it.tipe === 'dashboard') return f ? 'Dashboard · ' + f.judul + (f.dashboard_aktif ? '' : ' (belum diaktifkan, tidak tampil)') : 'Dashboard';
      return f ? 'Form · ' + f.judul + (f.status === 'buka' ? '' : ' (ditutup)') : 'Form';
    }
    return it.url.replace(/^(https?:\/\/|mailto:|tel:)/i, '').replace(/\/$/, '');
  }

  // ── Render pohon ──
  function iconButton(name, label, onClick, extra) {
    const b = el('button', 'icon-btn' + (extra ? ' ' + extra : ''));
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.append(App.svg(name));
    b.addEventListener('click', onClick);
    return b;
  }

  function switchFor(it) {
    const label = el('label', 'switch');
    label.title = 'Tampilkan di halaman publik';
    const input = el('input');
    input.type = 'checkbox';
    input.checked = it.tampil;
    input.setAttribute('aria-label', 'Tampilkan "' + it.judul + '" di halaman publik');
    input.addEventListener('change', function () { toggleVisible(it, input); });
    label.append(input, el('span', 'track'));
    return label;
  }

  function renderRow(it, map, level) {
    const li = el('li', 'row' + (it.tampil ? '' : ' is-hidden'));
    li.dataset.id = it.id;
    li.dataset.tipe = it.tipe;

    const head = el('div', 'row-head');
    const grip = el('span', 'grip');
    grip.title = 'Seret untuk memindahkan';
    grip.append(App.svg('grip'));

    const title = el('div', 'row-title');
    title.append(el('span', '', it.judul));
    if (!it.tampil) title.append(el('span', 'badge', 'Disembunyikan'));
    it.untuk.split(',').filter(Boolean).forEach(function (u) { title.append(el('span', 'badge', untukNama(u))); });
    if (it.segera) title.append(el('span', 'badge soon', 'Segera hadir'));
    if (it.pakai_sandi) title.append(el('span', 'badge', 'Berpassword'));
    const main = el('div', 'row-main');
    main.append(title, el('div', 'row-meta', metaText(it, map)));

    const clicks = el('span', 'clicks', it.klik + ' klik');
    clicks.title = 'Jumlah klik pengunjung';

    head.append(
      grip,
      App.icon(it),
      main,
      clicks,
      switchFor(it),
      iconButton('edit', 'Edit ' + it.judul, function () { openItemDialog(it.tipe, it); }),
      iconButton('trash', 'Hapus ' + it.judul, function () { removeItem(it, map); }, 'danger')
    );
    li.append(head);

    // Folder selalu punya daftar anak sendiri supaya bisa menjadi tujuan seret.
    if (it.tipe === 'folder') li.append(renderList(it.id, map, level + 1));
    return li;
  }

  function renderList(parentId, map, level) {
    const ul = el('ul', 'tree');
    ul.dataset.parent = parentId;
    ul.dataset.level = String(level);
    (map.get(parentId) || []).forEach(function (it) { ul.append(renderRow(it, map, level)); });
    return ul;
  }

  function renderTree() {
    state.sortables.forEach(function (s) { s.destroy(); });
    state.sortables = [];

    const host = $('tree');
    host.replaceChildren();

    if (!state.items.length) {
      const box = el('div', 'empty');
      box.append(el('strong', '', 'Belum ada item.'), document.createTextNode('Tambahkan link pertama dengan tombol di atas.'));
      host.append(box);
      return;
    }

    host.append(renderList('', groupByParent(), 0));
    initSortable();
  }

  // ── Seret dan lepas ──
  function initSortable() {
    if (typeof Sortable === 'undefined') {
      $('tree').classList.add('no-drag');
      $('treeHint').textContent = 'Pustaka seret-dan-lepas gagal dimuat. Muat ulang halaman. Folder induk tetap bisa diubah lewat tombol edit.';
      return;
    }
    $('tree').classList.remove('no-drag');
    document.querySelectorAll('#tree ul.tree').forEach(function (ul) {
      state.sortables.push(Sortable.create(ul, {
        group: 'tree',
        handle: '.grip',
        animation: 150,
        fallbackOnBody: true,
        swapThreshold: 0.65,
        ghostClass: 'drag-ghost',
        onMove: onMove,
        onEnd: onEnd
      }));
    });
  }

  function domFolderHeight(li) {
    const subs = li.querySelectorAll(':scope > ul.tree > li[data-tipe="folder"]');
    let mx = 0;
    subs.forEach(function (s) { mx = Math.max(mx, domFolderHeight(s)); });
    return 1 + mx;
  }

  // Menolak lebih awal bila folder akan melebihi batas tingkat.
  function onMove(evt) {
    const dragged = evt.dragged;
    if (dragged.dataset.tipe !== 'folder') return true;
    if (dragged.contains(evt.to)) return false;
    const listLevel = Number(evt.to.dataset.level);
    return listLevel + domFolderHeight(dragged) <= state.maxDepth;
  }

  function collectMoves() {
    const moves = [];
    document.querySelectorAll('#tree ul.tree').forEach(function (ul) {
      Array.prototype.forEach.call(ul.children, function (li, idx) {
        if (li.dataset && li.dataset.id) {
          moves.push({ id: li.dataset.id, parent_id: ul.dataset.parent, urutan: idx + 1 });
        }
      });
    });
    return moves;
  }

  async function onEnd() {
    const moves = collectMoves();
    const changed = moves.some(function (m) {
      const it = byId(m.id);
      return !it || it.parent_id !== m.parent_id || it.urutan !== m.urutan;
    });
    if (!changed) return;
    try {
      const d = await call('admin.reorder', { moves: moves });
      state.items = d.items;
      renderTree();
      toast('Urutan disimpan');
    } catch (err) {
      if (err.code === 'AUTH') return;
      toast(err.message, true);
      refresh().catch(function () {});
    }
  }

  // ── Aksi item ──
  async function toggleVisible(it, input) {
    const want = input.checked;
    input.disabled = true;
    try {
      const d = await call('admin.saveItem', { item: payload(it, { tampil: want }) });
      state.items = d.items;
      renderTree();
      toast(want ? 'Ditampilkan di halaman publik' : 'Disembunyikan dari halaman publik');
    } catch (err) {
      input.checked = !want;
      input.disabled = false;
      if (err.code !== 'AUTH') toast(err.message, true);
    }
  }

  async function removeItem(it, map) {
    const n = it.tipe === 'folder' ? descendants(it.id, map).length : 0;
    const what = it.tipe === 'folder'
      ? 'folder "' + it.judul + '"' + (n ? ' beserta ' + n + ' item di dalamnya' : '')
      : it.tipe === 'dashboard' ? 'tombol dashboard "' + it.judul + '" dari halaman utama (jawaban tetap ada)'
      : it.tipe === 'form' ? 'tombol form "' + it.judul + '" dari halaman utama (form dan jawabannya tetap ada)'
      : 'link "' + it.judul + '"';
    if (!window.confirm('Hapus ' + what + '? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      const d = await call('admin.deleteItem', { id: it.id });
      state.items = d.items;
      renderTree();
      toast('Dihapus');
    } catch (err) {
      if (err.code !== 'AUTH') toast(err.message, true);
    }
  }

  // ── Dialog tambah / edit ──
  const ICON_HINTS = {
    emoji: { ph: '😀', help: 'Pilih di bawah, atau ketik / tempel emoji apa saja.' },
    gambar: { ph: 'https://… atau link Google Drive', help: 'Bisa link gambar https atau link berbagi Google Drive (atur akses "Siapa saja yang memiliki link"). Gambar persegi paling rapi.' },
    pustaka: { ph: 'instagram', help: null },
    lucide: { ph: 'book-open', help: 'Cari di kolom pencarian lalu pilih. Atau ketik nama ikon Lucide (huruf kecil, pakai tanda hubung, mis. book-open). Daftar: lucide.dev/icons.' }
  };

  // ── Galeri besar (Lucide): katalog nama + kata kunci dimuat sekali dari CDN ──
  let lucideCat = null, lucideLoading = null, lucideLimit = 90, lucideQuery = '';
  const ID_EN = { sekolah: 'school', buku: 'book', guru: 'teacher', murid: 'student', siswa: 'student', uang: 'money', bayar: 'payment', pembayaran: 'payment',
    kalender: 'calendar', jadwal: 'schedule', surat: 'mail', pesan: 'message', telepon: 'phone', kamera: 'camera', foto: 'photo', video: 'video', musik: 'music',
    rumah: 'home', kunci: 'lock', aman: 'shield', keamanan: 'security', bintang: 'star', hati: 'heart', cinta: 'heart', lonceng: 'bell', pengumuman: 'megaphone',
    dokumen: 'document', berkas: 'file', folder: 'folder', catatan: 'note', tugas: 'task', daftar: 'list', nilai: 'grade', ujian: 'exam', laporan: 'report',
    grafik: 'chart', data: 'data', orang: 'user', pengguna: 'user', kelompok: 'users', tim: 'team', waktu: 'time', jam: 'clock', lokasi: 'map', peta: 'map',
    unduh: 'download', unggah: 'upload', cari: 'search', pengaturan: 'settings', bantuan: 'help', info: 'info', peringatan: 'alert', hadiah: 'gift', piala: 'trophy',
    makanan: 'food', kopi: 'coffee', mobil: 'car', bus: 'bus', sepeda: 'bike', kesehatan: 'health', obat: 'pill', dokter: 'stethoscope', komputer: 'computer',
    laptop: 'laptop', internet: 'wifi', ponsel: 'smartphone', printer: 'printer', gunting: 'scissors', pensil: 'pencil', tulis: 'pen', gambar: 'image', warna: 'palette',
    ide: 'lightbulb', lampu: 'lightbulb', tas: 'backpack', topi: 'graduation', wisuda: 'graduation', olahraga: 'sport', bola: 'ball', doa: 'hands', masjid: 'landmark' };

  function loadLucide() {
    if (lucideCat) return Promise.resolve(lucideCat);
    if (!lucideLoading) {
      lucideLoading = fetch(App.LUCIDE + 'tags.json').then(function (r) { if (!r.ok) throw new Error('x'); return r.json(); })
        .then(function (j) { lucideCat = Object.keys(j).sort().map(function (n) { return { n: n, t: (j[n] || []).join(' ').toLowerCase() }; }); return lucideCat; })
        .catch(function (e) { lucideLoading = null; throw e; });
    }
    return lucideLoading;
  }

  function lucideMatches(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean).map(function (w) { return ID_EN[w] || w; });
    if (!words.length) return lucideCat;
    return lucideCat.filter(function (x) {
      return words.every(function (w) { return x.n.indexOf(w) >= 0 || x.t.indexOf(w) >= 0; });
    });
  }

  async function renderLucide() {
    const g = $('iconGrid'), more = $('iconMore');
    g.hidden = false;
    if (!lucideCat) {
      g.replaceChildren(el('span', 'help', 'Memuat daftar ikon…'));
      more.hidden = true;
      try { await loadLucide(); } catch (e) {
        g.replaceChildren(el('span', 'help', 'Daftar ikon tidak bisa dimuat (perlu internet). Anda tetap bisa mengetik nama ikon di kolom bawah.'));
        return;
      }
      if ($('fIconType').value !== 'lucide') return;
    }
    const all = lucideMatches(lucideQuery);
    const shown = all.slice(0, lucideLimit);
    g.replaceChildren();
    if (!all.length) g.append(el('span', 'help', 'Tidak ada ikon yang cocok. Coba kata lain (bahasa Inggris juga bisa).'));
    shown.forEach(function (x) {
      const b = el('button', 'ip-btn');
      b.type = 'button'; b.dataset.v = x.n; b.title = x.n; b.setAttribute('aria-label', x.n);
      b.append(App.icon({ ikon_jenis: 'lucide', ikon_isi: x.n }).firstChild);
      b.addEventListener('click', function () { $('fIconValue').value = x.n; pressedSync(); refreshPreview(); });
      g.append(b);
    });
    more.hidden = all.length <= shown.length;
    more.textContent = 'Tampilkan lebih banyak (' + (all.length - shown.length) + ' lagi)';
    pressedSync();
  }

  const EMOJIS = ['📌', '📢', '📝', '📄', '📚', '🎓', '🏫', '🧑‍🏫', '👥', '🤝', '💰', '🧾', '📅', '⏰', '📷', '🎥', '🏆', '⭐', '❤️', '✅', '📞', '✉️', '🌐', '🔒', '🛠️', '🎉', '🕌', '🚀'];
  const BRANDS = ['instagram', 'whatsapp', 'youtube', 'tiktok', 'facebook', 'x', 'telegram', 'github', 'linkedin', 'google', 'googledrive', 'googleforms', 'googlesheets', 'googlemeet', 'gmail', 'zoom', 'spotify', 'discord', 'canva', 'notion', 'figma', 'shopee', 'tokopedia', 'threads'];
  const COLORS = ['#f4b942', '#ef4444', '#f97316', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#0f172a', '#ffffff'];
  const SHAPES = [['', 'Membulat'], ['bulat', 'Bulat'], ['kotak', 'Kotak']];
  const iconStyle = { warna: '', bentuk: '' };
  let previewToken = 0;

  function pressedSync() {
    const v = $('fIconValue').value.trim().toLowerCase();
    const raw = $('fIconValue').value.trim();
    $('iconGrid').querySelectorAll('.ip-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.v === v || b.dataset.v === raw));
    });
  }

  function renderGrid(jenis) {
    const g = $('iconGrid');
    $('iconSearch').hidden = jenis !== 'lucide';
    $('iconMore').hidden = true;
    if (jenis === 'lucide') { renderLucide(); return; }
    g.replaceChildren();
    let list = null;
    if (jenis === 'bawaan') list = App.ICON_CHOICES;
    else if (jenis === 'emoji') list = EMOJIS;
    else if (jenis === 'pustaka') list = BRANDS;
    g.hidden = !list;
    if (!list) return;
    list.forEach(function (v) {
      const b = el('button', 'ip-btn');
      b.type = 'button';
      b.dataset.v = v;
      b.title = v;
      b.setAttribute('aria-label', v);
      if (jenis === 'bawaan') b.append(App.svg(v));
      else if (jenis === 'emoji') b.textContent = v;
      else { b.classList.add('brand'); b.append(App.icon({ ikon_jenis: 'pustaka', ikon_isi: v }).firstChild || '', el('small', '', v)); }
      b.addEventListener('click', function () {
        $('fIconValue').value = v;
        pressedSync();
        refreshPreview();
      });
      g.append(b);
    });
    pressedSync();
  }

  function renderStyleControls() {
    const c = $('iconColors');
    c.replaceChildren();
    function sw(color, label) {
      const b = el('button', 'ip-sw' + (color ? '' : ' auto'));
      b.type = 'button';
      b.title = label;
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-pressed', String(iconStyle.warna === color));
      if (color) b.style.background = color;
      b.addEventListener('click', function () { iconStyle.warna = color; renderStyleControls(); refreshPreview(); });
      return b;
    }
    c.append(sw('', 'Warna otomatis'));
    COLORS.forEach(function (k) { c.append(sw(k, k)); });
    const custom = el('input', 'ip-custom');
    custom.type = 'color';
    custom.setAttribute('aria-label', 'Warna lain');
    custom.title = 'Warna lain';
    custom.value = iconStyle.warna || '#f4b942';
    custom.addEventListener('input', function () { iconStyle.warna = custom.value; refreshPreview(); c.querySelectorAll('.ip-sw').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); });
    c.append(custom);

    const sh = $('iconShapes');
    sh.replaceChildren();
    SHAPES.forEach(function (x) {
      const b = el('button', 'seg-btn', x[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(iconStyle.bentuk === x[0]));
      b.addEventListener('click', function () { iconStyle.bentuk = x[0]; renderStyleControls(); refreshPreview(); });
      sh.append(b);
    });
  }

  let searchTimer = null;
  $('iconSearch').addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { lucideQuery = $('iconSearch').value.trim(); lucideLimit = 90; renderLucide(); }, 200);
  });
  $('iconMore').addEventListener('click', function () { lucideLimit += 120; renderLucide(); });

  function updateIconFields() {
    const jenis = $('fIconType').value;
    const input = $('fIconValue');
    const help = $('iconHelp');
    const showInput = jenis === 'emoji' || jenis === 'gambar' || jenis === 'pustaka' || jenis === 'lucide';
    input.hidden = !showInput;
    help.hidden = !showInput;
    if (jenis === 'none' || jenis === 'bawaan') {
      if (jenis === 'none') input.value = '';
    }
    if (showInput) {
      const h = ICON_HINTS[jenis];
      input.placeholder = h.ph;
      help.replaceChildren();
      if (h.help) {
        help.textContent = h.help;
      } else {
        help.append(document.createTextNode('Pilih di bawah, atau ketik nama ikon huruf kecil (misalnya instagram). Daftar lengkap: '));
        const a = el('a', '', 'simpleicons.org');
        a.href = 'https://simpleicons.org/';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        help.append(a);
      }
    }
    renderGrid(jenis);
    renderStyleControls();
    refreshPreview();
  }

  function refreshPreview() {
    const probe = {
      tipe: state.editingTipe,
      ikon_jenis: $('fIconType').value,
      ikon_isi: $('fIconValue').value.trim(),
      ikon_warna: iconStyle.warna,
      ikon_bentuk: iconStyle.bentuk
    };
    if (probe.ikon_jenis === 'pustaka' || probe.ikon_jenis === 'lucide') probe.ikon_isi = probe.ikon_isi.toLowerCase();
    $('iconPreview').replaceChildren(App.icon(probe));
    pressedSync();

    // Keterangan hasil memuat gambar, supaya jelas kalau link Drive belum dibagikan.
    const st = $('iconState');
    const token = ++previewToken;
    if (probe.ikon_jenis === 'gambar' && probe.ikon_isi) {
      st.hidden = false;
      st.className = 'help ip-state';
      st.textContent = 'Memuat gambar…';
      App.loadImage(probe.ikon_isi, function () {
        if (token !== previewToken) return;
        st.className = 'help ip-state ok';
        st.textContent = '✓ Gambar berhasil dimuat.';
      }, function () {
        if (token !== previewToken) return;
        st.className = 'help ip-state bad';
        st.textContent = '✗ Gambar tidak bisa dimuat. Untuk Google Drive: Bagikan → Akses umum → "Siapa saja yang memiliki link" (Pelihat).';
      });
    } else if (probe.ikon_jenis === 'lucide' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(probe.ikon_isi)) {
      // Pastikan nama ikon ada; bila tidak, pratinjau kosong tanpa penjelasan.
      const im = new Image();
      im.onload = function () { if (token === previewToken) st.hidden = true; };
      im.onerror = function () {
        if (token !== previewToken) return;
        st.hidden = false; st.className = 'help ip-state bad';
        st.textContent = '✗ Ikon "' + probe.ikon_isi + '" tidak ditemukan. Pilih dari galeri atau cek ejaan.';
      };
      im.src = App.LUCIDE + 'icons/' + probe.ikon_isi + '.svg';
    } else {
      st.hidden = true;
    }
  }

  function fillParentOptions(item, tipe, preselect) {
    const map = groupByParent();
    const sel = $('fParent');
    sel.replaceChildren(new Option('Halaman utama', ''));

    const skip = new Set(item ? [item.id].concat(descendants(item.id, map)) : []);
    // Tinggi folder yang akan diletakkan: folder punya tinggi sendiri, link tidak memakai tingkat.
    const h = tipe !== 'folder' ? 0 : (item ? folderHeight(item.id, map) : 1);

    (function walk(pid, level) {
      (map.get(pid) || [])
        .filter(function (i) { return i.tipe === 'folder' && !skip.has(i.id); })
        .forEach(function (f) {
          const opt = new Option('– '.repeat(level) + f.judul, f.id);
          opt.disabled = level + 1 + h > state.maxDepth;
          sel.append(opt);
          walk(f.id, level + 1);
        });
    })('', 0);

    sel.value = item ? item.parent_id : (preselect || '');
    if (sel.value !== (item ? item.parent_id : (preselect || ''))) sel.value = '';
  }

  function openItemDialog(tipe, item, preForm) {
    state.editingId = item ? item.id : null;
    state.editingTipe = tipe;
    $('dlgTitle').textContent = (item ? 'Edit ' : 'Tambah ') + tipe;
    $('fTitle').value = item ? item.judul : '';
    const needForm = tipe === 'form' || tipe === 'dashboard';
    $('fFormWrap').hidden = !needForm;
    $('fForm').required = needForm;
    if (needForm) {
      const sel = $('fForm');
      sel.replaceChildren();
      state.forms.forEach(function (f) { sel.append(new Option(f.judul + (f.status === 'buka' ? '' : ' (ditutup)'), f.form_id)); });
      if (!state.forms.length) sel.append(new Option('Belum ada form', ''));
      sel.value = item ? item.form_id : (preForm || (state.forms[0] || {}).form_id || '');
      if (!item && !$('fTitle').value && sel.value) {
        const f = state.forms.filter(function (x) { return x.form_id === sel.value; })[0];
        if (f) $('fTitle').value = (tipe === 'dashboard' ? 'Hasil ' : '') + f.judul;
      }
    }
    $('fUrl').value = item ? item.url : '';
    $('fUntuk').closest('.field').hidden = tipe === 'folder';
    $('fUrlWrap').hidden = tipe !== 'link';
    $('fUrl').required = tipe === 'link';
    $('fIconType').value = item ? item.ikon_jenis : 'none';
    $('fIconValue').value = item ? item.ikon_isi : '';
    iconStyle.warna = item ? (item.ikon_warna || '') : '';
    iconStyle.bentuk = item ? (item.ikon_bentuk || '') : '';
    $('fVisible').checked = item ? item.tampil : true;
    fillUntuk(item ? (item.untuk || '') : '');
    $('fSoon').checked = item ? item.segera === true : false;
    const bisaSandi = tipe === 'link' || tipe === 'folder';
    $('fLockWrap').hidden = !bisaSandi;
    $('fLock').checked = bisaSandi && !!item && item.pakai_sandi === true;
    $('fSandi').value = '';
    $('fSandi').placeholder = (item && item.pakai_sandi) ? 'Kosongkan = pakai password yang lama' : 'Password baru (4–64 karakter)';
    $('fSandiWrap').hidden = !$('fLock').checked;
    $('dlgMsg').textContent = '';
    fillParentOptions(item, tipe, '');
    updateIconFields();
    $('itemDialog').showModal();
    $('fTitle').focus();
  }

  $('fLock').addEventListener('change', function () {
    $('fSandiWrap').hidden = !$('fLock').checked;
    if ($('fLock').checked) $('fSandi').focus();
  });
  App.passwordEye($('fSandi'));

  async function submitItem(e) {
    e.preventDefault();
    const btn = $('dlgSave');
    const tipe = state.editingTipe;
    const item = {
      tipe: tipe,
      judul: $('fTitle').value,
      url: tipe === 'link' ? $('fUrl').value : '',
      form_id: (tipe === 'form' || tipe === 'dashboard') ? $('fForm').value : '',
      ikon_jenis: $('fIconType').value,
      ikon_isi: $('fIconValue').value,
      ikon_warna: iconStyle.warna,
      ikon_bentuk: iconStyle.bentuk,
      parent_id: $('fParent').value,
      tampil: $('fVisible').checked,
      segera: $('fSoon').checked,
      untuk: tipe === 'folder' ? [] : readUntuk()
    };
    if (tipe === 'link' || tipe === 'folder') {
      item.pakai_sandi = $('fLock').checked;
      if (item.pakai_sandi && $('fSandi').value) item.sandi = $('fSandi').value;
    }
    if (state.editingId) item.id = state.editingId;

    setBusy(btn, true);
    $('dlgMsg').textContent = '';
    try {
      const d = await call('admin.saveItem', { item: item });
      state.items = d.items;
      renderTree();
      $('itemDialog').close();
      toast('Tersimpan');
    } catch (err) {
      if (err.code === 'AUTH') $('itemDialog').close();
      else $('dlgMsg').textContent = err.message;
    } finally {
      setBusy(btn, false);
    }
  }

  // ── Tab halaman utama ("Untuk siapa") ──
  let grupRows = [];

  // Kotak centang kategori: tidak ada yang dicentang = untuk semua.
  function fillUntuk(val) {
    const box = $('fUntuk');
    const on = String(val || '').split(',');
    box.replaceChildren();
    const list = state.settings.grup || [];
    if (!list.length) box.append(el('span', 'help', 'Belum ada tab. Tambahkan di Pengaturan → Tab halaman utama.'));
    list.forEach(function (g) {
      const lab = el('label', 'check');
      const cb = el('input'); cb.type = 'checkbox'; cb.value = g.id; cb.checked = on.indexOf(g.id) >= 0;
      lab.append(cb, el('span', '', g.nama));
      box.append(lab);
    });
  }
  function readUntuk() {
    return Array.prototype.map.call($('fUntuk').querySelectorAll('input:checked'), function (c) { return c.value; });
  }

  function renderGrupRows() {
    const box = $('grupList');
    box.replaceChildren();
    if (!grupRows.length) box.append(el('p', 'help', 'Belum ada tab selain "Semua".'));
    grupRows.forEach(function (r, i) {
      const row = el('div', 'soc-row');
      const inp = el('input', 'input');
      inp.setAttribute('aria-label', 'Nama tab'); inp.maxLength = 30; inp.placeholder = 'Nama tab, mis. Orang Tua';
      inp.value = r.nama;
      inp.addEventListener('input', function () { r.nama = inp.value; });
      function mini(icon, label, fn) {
        const b = el('button', 'icon-btn'); b.type = 'button'; b.title = label; b.setAttribute('aria-label', label);
        b.append(App.svg(icon)); b.addEventListener('click', fn); return b;
      }
      const tools = el('div', 'soc-tools');
      tools.append(
        mini('up', 'Naikkan', function () { if (i > 0) { grupRows.splice(i - 1, 0, grupRows.splice(i, 1)[0]); renderGrupRows(); } }),
        mini('down', 'Turunkan', function () { if (i < grupRows.length - 1) { grupRows.splice(i + 1, 0, grupRows.splice(i, 1)[0]); renderGrupRows(); } }),
        mini('trash', 'Hapus', function () { grupRows.splice(i, 1); renderGrupRows(); })
      );
      row.append(inp);
      if (!$('sTabSemua').checked) {
        const q = el('label', 'check');
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = r.qr === true;
        cb.addEventListener('change', function () { r.qr = cb.checked; });
        q.append(cb, el('span', '', 'Pembuat QR di tab ini'));
        row.append(q);
      }
      row.append(tools);
      box.append(row);
    });
    $('grupAdd').disabled = grupRows.length >= 8;
  }

  $('sTabSemua').addEventListener('change', renderGrupRows);
  $('grupAdd').addEventListener('click', function () {
    if (grupRows.length >= 8) return;
    grupRows.push({ id: '', nama: '', qr: false });
    renderGrupRows();
    const ins = $('grupList').querySelectorAll('input.input');
    if (ins.length) ins[ins.length - 1].focus();
  });

  // ── Media sosial & website ──
  let socRows = [];

  function renderSocRows() {
    const box = $('socList');
    box.replaceChildren();
    socRows.forEach(function (r, i) {
      const row = el('div', 'soc-row');
      const prev = el('span', 'soc-prev');
      const sel = el('select', 'input');
      sel.setAttribute('aria-label', 'Platform');
      App.SOCIALS.forEach(function (x) { sel.append(new Option(x[1], x[0])); });
      sel.append(new Option('Lainnya (nama ikon)…', 'lainnya'));
      const known = App.SOCIALS.some(function (x) { return x[0] === r.tipe; });
      sel.value = known ? r.tipe : 'lainnya';
      const slug = el('input', 'input');
      slug.setAttribute('aria-label', 'Nama ikon'); slug.placeholder = 'nama ikon, mis. snapchat'; slug.maxLength = 30;
      slug.autocapitalize = 'off'; slug.spellcheck = false;
      slug.value = known ? '' : r.tipe;
      slug.hidden = known;
      const url = el('input', 'input');
      url.setAttribute('aria-label', 'Alamat link'); url.maxLength = 500; url.autocapitalize = 'off'; url.spellcheck = false;
      url.placeholder = r.tipe === 'email' ? 'nama@contoh.com' : 'https://…';
      url.value = r.url;

      function sync() {
        r.tipe = sel.value === 'lainnya' ? slug.value.trim().toLowerCase() : sel.value;
        r.url = url.value;
        slug.hidden = sel.value !== 'lainnya';
        url.placeholder = r.tipe === 'email' ? 'nama@contoh.com' : 'https://…';
        prev.replaceChildren(App.socialIcon(r.tipe || 'web'));
      }
      sel.addEventListener('change', function () { sync(); if (sel.value === 'lainnya') slug.focus(); });
      slug.addEventListener('input', sync);
      url.addEventListener('input', sync);
      prev.append(App.socialIcon(r.tipe || 'web'));

      function mini(icon, label, fn) {
        const b = el('button', 'icon-btn'); b.type = 'button'; b.title = label; b.setAttribute('aria-label', label);
        b.append(App.svg(icon)); b.addEventListener('click', fn); return b;
      }
      const tools = el('div', 'soc-tools');
      tools.append(
        mini('up', 'Naikkan', function () { if (i > 0) { socRows.splice(i - 1, 0, socRows.splice(i, 1)[0]); renderSocRows(); } }),
        mini('down', 'Turunkan', function () { if (i < socRows.length - 1) { socRows.splice(i + 1, 0, socRows.splice(i, 1)[0]); renderSocRows(); } }),
        mini('trash', 'Hapus', function () { socRows.splice(i, 1); renderSocRows(); })
      );
      const top = el('div', 'soc-top');
      top.append(prev, sel);
      row.append(top, slug, url, tools);
      box.append(row);
    });
    $('socAdd').disabled = socRows.length >= 12;
  }

  $('socAdd').addEventListener('click', function () {
    if (socRows.length >= 12) return;
    socRows.push({ tipe: 'instagram', url: '' });
    renderSocRows();
    const ins = $('socList').querySelectorAll('.soc-row');
    const last = ins[ins.length - 1];
    if (last) last.querySelectorAll('input.input:not([hidden])')[0].focus();
  });

  // ── Pengaturan ──
  function renderSettings() {
    socRows = (state.settings.sosmed || []).map(function (x) { return { tipe: x.tipe, url: x.url }; });
    renderSocRows();
    grupRows = (state.settings.grup || []).map(function (g) { return { id: g.id, nama: g.nama, qr: g.qr === true }; });
    $('sTabSemua').checked = state.settings.tab_semua !== 'tidak';
    renderGrupRows();
    $('sTitle').value = state.settings.judul || '';
    $('sSub').value = state.settings.subjudul || '';
    $('sDesc').value = state.settings.deskripsi || '';
    $('sTheme').value = state.settings.tema || 'auto';
    $('sQrOn').checked = state.settings.qr_aktif !== 'tidak';
    $('sQrTitle').value = state.settings.qr_judul || '';
    $('sQrDesc').value = state.settings.qr_keterangan === undefined ? 'Tempel link, lalu unduh QR-nya.' : state.settings.qr_keterangan;
  }

  function setMsg(id, text, ok) {
    const m = $(id);
    m.textContent = text;
    m.classList.toggle('ok', !!ok);
  }

  async function submitSettings(e) {
    e.preventDefault();
    const btn = e.submitter || e.target.querySelector('button[type="submit"]');
    setBusy(btn, true);
    setMsg('settingsMsg', '');
    try {
      const d = await call('admin.saveSettings', {
        settings: { judul: $('sTitle').value, subjudul: $('sSub').value, deskripsi: $('sDesc').value, tema: $('sTheme').value,
          qr_aktif: $('sQrOn').checked, qr_judul: $('sQrTitle').value, qr_keterangan: $('sQrDesc').value,
          tab_semua: $('sTabSemua').checked,
          grup: grupRows.map(function (g) { return { id: g.id, nama: g.nama, qr: g.qr === true }; }),
          sosmed: socRows.filter(function (r) { return r.tipe || r.url.trim(); }).map(function (r) { return { tipe: r.tipe, url: r.url }; }) }
      });
      state.settings = d.settings;
      renderSettings();
      setMsg('settingsMsg', 'Pengaturan tersimpan.', true);
    } catch (err) {
      if (err.code !== 'AUTH') setMsg('settingsMsg', err.message);
    } finally {
      setBusy(btn, false);
    }
  }

  async function submitPassword(e) {
    e.preventDefault();
    const btn = e.submitter || e.target.querySelector('button[type="submit"]');
    setMsg('passwordMsg', '');
    if ($('pNew').value !== $('pNew2').value) {
      setMsg('passwordMsg', 'Ulangi password baru dengan teks yang sama.');
      return;
    }
    setBusy(btn, true);
    try {
      const r = await call('admin.changePassword', {
        oldPassword: $('pOld').value,
        newPassword: $('pNew').value
      });
      setToken(r.token);
      e.target.reset();
      setMsg('passwordMsg', 'Password diganti. Sesi lain sudah keluar.', true);
    } catch (err) {
      if (err.code !== 'AUTH') setMsg('passwordMsg', err.message);
    } finally {
      setBusy(btn, false);
    }
  }

  // ── Muat data ──
  function applyList(d) {
    state.items = d.items;
    state.settings = d.settings;
    state.maxDepth = d.maxDepth || 3;
    state.forms = d.forms || [];
    renderTree();
    renderSettings();
  }

  // Data admin disimpan sementara di tab ini, jadi panel langsung tampil lalu diperbarui diam-diam.
  const ADM_CACHE = 'admin_cache';
  function saveAdminCache(d) { try { sessionStorage.setItem(ADM_CACHE, JSON.stringify(d)); } catch (e) { /* abaikan */ } }
  function loadAdminCache() { try { return JSON.parse(sessionStorage.getItem(ADM_CACHE)); } catch (e) { return null; } }
  async function refresh(silent) {
    const d = await call('admin.list', {}, { silent: !!silent });
    saveAdminCache(d);
    applyList(d);
  }

  const tabHooks = {};
  function selectTab(name) {
    document.querySelectorAll('.tab').forEach(function (b) {
      const on = b.dataset.tab === name;
      b.setAttribute('aria-selected', String(on));
      $(b.getAttribute('aria-controls')).hidden = !on;
    });
    if (tabHooks[name]) tabHooks[name]();
  }

  // ── Pemasangan ──
  document.querySelectorAll('.tic').forEach(function (n) { n.replaceWith(App.svg(n.dataset.i)); });
  $('viewBtn').append(App.svg('external'));
  $('logoutBtn').append(App.svg('logout'));
  document.querySelectorAll('input[type="password"]').forEach(App.passwordEye);
  const themeBtn = $('themeBtn');
  themeBtn.append(App.svg('moon', 'moon'), App.svg('sun', 'sun'));
  themeBtn.addEventListener('click', App.theme.toggle);

  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { selectTab(b.dataset.tab); });
  });

  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = $('loginBtn');
    setBusy(btn, true);
    $('loginMsg').textContent = '';
    try {
      const r = await App.post({ action: 'login', password: $('pw').value });
      setToken(r.token);
      $('pw').value = '';
      if (r.boot) { saveAdminCache(r.boot); applyList(r.boot); } else { await refresh(); }
      showApp();
    } catch (err) {
      $('loginMsg').textContent = err.message;
    } finally {
      setBusy(btn, false);
    }
  });

  $('logoutBtn').addEventListener('click', async function () {
    try { await call('admin.logout'); } catch (e) { /* tetap keluar */ }
    setToken('');
    showLogin('');
  });

  $('addLink').addEventListener('click', function () { openItemDialog('link', null); });
  $('addFolder').addEventListener('click', function () { openItemDialog('folder', null); });
  $('addDash').addEventListener('click', function () { openItemDialog('dashboard', null); });
  $('addForm').addEventListener('click', function () { openItemDialog('form', null); });

  // ── Tempel daftar ──
  $('addBulk').addEventListener('click', function () {
    $('bulkText').value = ''; $('bulkMsg').textContent = '';
    $('bulkDialog').showModal(); $('bulkText').focus();
  });
  $('bulkCancel').addEventListener('click', function () { $('bulkDialog').close(); });
  async function runBulk(dry) {
    const btn = dry ? $('bulkCheck') : $('bulkSave');
    setBusy(btn, true); $('bulkMsg').textContent = '';
    try {
      const d = await call('admin.importItems', { text: $('bulkText').value, dry: dry });
      const info = d.dibuat + ' item baru (' + d.folder + ' folder), ' + d.dilewati + ' dilewati karena sudah ada.';
      if (dry) { $('bulkMsg').textContent = 'Siap: ' + info; return; }
      state.items = d.items; renderTree();
      $('bulkDialog').close(); toast(info);
    } catch (err) {
      if (err.code === 'AUTH') $('bulkDialog').close();
      else $('bulkMsg').textContent = err.message;
    } finally { setBusy(btn, false); }
  }
  $('bulkCheck').addEventListener('click', function () { runBulk(true); });
  $('bulkForm').addEventListener('submit', function (e) { e.preventDefault(); runBulk(false); });

  $('itemForm').addEventListener('submit', submitItem);
  $('dlgCancel').addEventListener('click', function () { $('itemDialog').close(); });
  $('itemDialog').addEventListener('click', function (e) {
    if (e.target === $('itemDialog')) $('itemDialog').close(); // klik di luar kotak dialog
  });
  $('fIconType').addEventListener('change', function () {
    $('fIconValue').value = '';
    updateIconFields();
  });
  let previewTimer;
  $('fIconValue').addEventListener('input', function () {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 250);
  });

  $('settingsForm').addEventListener('submit', submitSettings);
  $('passwordForm').addEventListener('submit', submitPassword);

  async function boot() {
    try { await boot2(); } finally { App.splash.hide(1000); }
  }

  async function boot2() {
    if (!App.configured()) {
      showLogin('config.js belum diisi dengan URL Web App.');
      $('loginBtn').disabled = true;
      return;
    }
    if (!getToken()) {
      showLogin('');
      return;
    }
    const cached = loadAdminCache();
    try {
      if (cached && cached.items) {
        applyList(cached);
        showApp();
        App.splash.hide(300);
        await refresh(true);
      } else {
        await refresh();
        showApp();
      }
    } catch (err) {
      if (err.code !== 'AUTH' && !cached) showLogin(err.message);
    }
  }

  // Tampilkan data tersimpan dulu (langsung), lalu perbarui diam-diam dari server.
  const memo = {};
  function swr(action, payload, onData) {
    const key = action + JSON.stringify(payload || {});
    const had = Object.prototype.hasOwnProperty.call(memo, key);
    const prev = memo[key];
    if (had) onData(prev);
    return call(action, payload, { silent: had }).then(function (d) {
      if (d === undefined) return d; // sesi berakhir
      memo[key] = d;
      if (!had || JSON.stringify(d) !== JSON.stringify(prev)) onData(d);
      return d;
    });
  }
  function forget(prefix) { Object.keys(memo).forEach(function (k) { if (k.indexOf(prefix) === 0) delete memo[k]; }); }
  // Menghangatkan data tab lain di latar belakang, jadi berpindah tab tidak menunggu server.
  function prefetch() {
    const quiet = { silent: true };
    call('admin.forms.list', {}, quiet).then(function (d) {
      if (d === undefined) return;
      memo['admin.forms.list{}'] = d;
      const first = d.forms[0];
      return call('admin.names.lists', {}, quiet).then(function (n) {
        if (n !== undefined) memo['admin.names.lists{}'] = n;
        if (!first) return;
        const p = { form_id: first.form_id, filter: 'aktif' };
        return call('admin.results', p, quiet).then(function (r) {
          if (r !== undefined) memo['admin.results' + JSON.stringify(p)] = r;
        });
      });
    }).catch(function () { /* hanya penghangat, abaikan */ });
  }

  // Dipakai admin-forms.js dan admin-names.js.
  window.Admin = {
    swr: swr, forget: forget, prefetch: prefetch,
    call: call, toast: toast, state: state, setBusy: setBusy,
    onTab: function (name, fn) { tabHooks[name] = fn; },
    selectTab: selectTab,
    openItemDialog: openItemDialog,
    setItems: function (items) { state.items = items; renderTree(); },
    setForms: function (forms) { state.forms = forms; renderTree(); },
    el: el
  };

  boot();
})();
