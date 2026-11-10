/* SPEGANA — mode edit langsung di halaman utama (hanya untuk admin yang sudah masuk).
   Memakai API admin yang sama dengan panel admin: admin.list, admin.saveItem, admin.reorder,
   admin.deleteItem, admin.saveSettings. Pengunjung biasa tidak melihat apa pun dari ini. */
(function () {
  'use strict';

  const Pub = window.Pub;
  if (!Pub) return;
  const el = App.el;
  const TOKEN_KEY = 'admin_token';
  const MAX_GRUP = 8;

  const st = { on: false, items: [], settings: {}, maxDepth: 3, forms: [] };

  function getToken() { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* abaikan */ } }

  async function call(action, payload, opts) {
    try {
      return await App.post(Object.assign({ action: action, token: getToken() }, payload || {}), opts);
    } catch (err) {
      if (err && err.code === 'AUTH') {
        setToken('');
        toast('Sesi admin berakhir. Masuk lagi.', true);
        setTimeout(function () { leave(); }, 900);
      }
      throw err;
    }
  }

  // ── Toast kecil ──
  let toastTimer;
  function toast(text, isError) {
    let t = document.getElementById('edToast');
    if (!t) { t = el('div', 'ed-toast'); t.id = 'edToast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.textContent = text;
    t.className = 'ed-toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'ed-toast'; }, 3000);
  }

  // ── Data ──
  function formMap() {
    const m = {};
    st.forms.forEach(function (f) { m[f.form_id] = f; });
    return m;
  }
  // Bentuk yang dipakai public.js: semua item terbuka (admin melihat semuanya), form/dashboard membawa slug.
  function toPublic() {
    const fm = formMap();
    return {
      settings: st.settings,
      items: st.items.slice().sort(function (x, y) { return x.urutan - y.urutan; }).map(function (i) {
        const o = Object.assign({}, i, { terkunci: false });
        if ((i.tipe === 'form' || i.tipe === 'dashboard') && fm[i.form_id]) o.form = { slug: fm[i.form_id].slug, status: fm[i.form_id].status };
        return o;
      })
    };
  }
  function apply(d) {
    if (d.items) st.items = d.items;
    if (d.settings) st.settings = d.settings;
    if (d.maxDepth) st.maxDepth = d.maxDepth;
    if (d.forms) st.forms = d.forms;
    Pub.setData(toPublic());
    Pub.render();
  }
  const byId = function (id) { return st.items.filter(function (i) { return i.id === id; })[0]; };
  function siblings(parentId) {
    return st.items.filter(function (i) { return i.parent_id === parentId; })
      .sort(function (a, b) { return a.urutan - b.urutan; });
  }
  function descendantIds(id) {
    const out = {};
    (function walk(x) { st.items.forEach(function (i) { if (i.parent_id === x && !out[i.id]) { out[i.id] = true; walk(i.id); } }); })(id);
    return out;
  }
  function untukNama(id) {
    const g = (st.settings.grup || []).filter(function (x) { return x.id === id; })[0];
    return g ? g.nama : id;
  }
  function payload(it, over) {
    return Object.assign({
      id: it.id, tipe: it.tipe, judul: it.judul, url: it.url, form_id: it.form_id || '',
      ikon_jenis: it.ikon_jenis, ikon_isi: it.ikon_isi,
      ikon_warna: it.ikon_warna || '', ikon_bentuk: it.ikon_bentuk || '',
      parent_id: it.parent_id, tampil: it.tampil, segera: it.segera === true,
      untuk: it.untuk || '', pakai_sandi: it.pakai_sandi === true
    }, over || {});
  }

  // ── Kartu dalam mode edit ──
  function btn(icon, label, onClick, cls) {
    const b = el('button', 'ed-btn' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.append(App.svg(icon));
    if (onClick) b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onClick(b); });
    return b;
  }

  function editTile(item, count) {
    const li = el('li', 'ed-li' + (item.tampil ? '' : ' is-off'));
    li.dataset.id = item.id;
    const a = el('a', 'tile tile-' + item.tipe);
    if (item.tipe === 'folder') {
      a.href = '#/f/' + item.id;
    } else {
      a.href = '#';
      a.setAttribute('role', 'button');
      a.addEventListener('click', function (e) { e.preventDefault(); openItem(item); });
    }
    a.append(App.icon(item), el('span', 'label', item.judul));
    const meta = [];
    if (item.tipe === 'folder') meta.push(count + ' item');
    else if (item.tipe === 'form') meta.push('Form');
    else if (item.tipe === 'dashboard') meta.push('Dashboard');
    if (item.segera) meta.push('Segera');
    if (item.pakai_sandi) meta.push('Terkunci');
    if (!item.tampil) meta.push('Disembunyikan');
    if (meta.length) a.append(el('span', 'count', meta.join(' · ')));
    if (item.tipe === 'folder') a.append(App.svg('chevron', 'trail'));
    li.append(a);

    const bar = el('div', 'ed-bar');
    const grip = btn('grip', 'Seret untuk mengubah urutan', null, 'ed-grip');
    bar.append(grip,
      btn('up', 'Naikkan', function () { nudge(item, -1); }),
      btn('down', 'Turunkan', function () { nudge(item, 1); }),
      el('span', 'ed-gap'),
      btn(item.tampil ? 'eye' : 'eyeoff', item.tampil ? 'Sembunyikan dari publik' : 'Tampilkan di publik', function (b) { toggle(item, b); }),
      btn('edit', 'Edit ' + item.judul, function () { openItem(item); }),
      btn('trash', 'Hapus ' + item.judul, function () { remove(item); }, 'danger'));
    li.append(bar);
    return li;
  }

  function addTile(folderId) {
    const li = el('li', 'ed-add');
    const row = el('div', 'ed-add-row');
    const l = el('button', 'btn', 'Link'); l.type = 'button';
    l.prepend(App.svg('plus'));
    l.addEventListener('click', function () { openItem(null, 'link', folderId); });
    const f = el('button', 'btn', 'Folder'); f.type = 'button';
    f.prepend(App.svg('plus'));
    f.addEventListener('click', function () { openItem(null, 'folder', folderId); });
    const p = el('a', 'ed-more', 'Form atau dashboard: di panel admin');
    p.href = 'admin.html'; p.target = '_blank'; p.rel = 'noopener';
    row.append(el('span', 'ed-add-t', 'Tambah di sini'), l, f);
    li.append(row, p);
    return li;
  }

  // ── Urutan ──
  // Hanya item yang sedang tampil (sesuai tab) yang bergeser; item yang tersaring menempati slot lamanya.
  async function applyOrder(folderId, visibleOrder) {
    const sib = siblings(folderId).map(function (i) { return i.id; });
    const visSet = {};
    visibleOrder.forEach(function (id) { visSet[id] = true; });
    let k = 0;
    const next = sib.map(function (id) { return visSet[id] ? visibleOrder[k++] : id; });
    if (next.join() === sib.join()) return;
    try {
      const d = await call('admin.reorder', { moves: next.map(function (id, idx) { return { id: id, parent_id: folderId, urutan: idx + 1 }; }) });
      apply(d);
      toast('Urutan disimpan');
    } catch (err) {
      if (!err || err.code !== 'AUTH') { toast(err && err.message || 'Gagal menyimpan urutan.', true); Pub.render(); }
    }
  }
  function visibleIds() {
    return Array.prototype.map.call(document.querySelectorAll('#list > li.ed-li'), function (li) { return li.dataset.id; });
  }
  function nudge(item, dir) {
    const ids = visibleIds();
    const i = ids.indexOf(item.id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    applyOrder(item.parent_id, ids);
  }

  let sortable = null;
  function loadSortable() {
    if (window.Sortable) return Promise.resolve();
    return new Promise(function (ok, no) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js';
      s.onload = function () { ok(); }; s.onerror = function () { no(new Error('x')); };
      document.head.append(s);
    });
  }
  function initSortable(ctx) {
    if (sortable) { sortable.destroy(); sortable = null; }
    if (!window.Sortable) return;
    sortable = window.Sortable.create(document.getElementById('list'), {
      draggable: '.ed-li', handle: '.ed-grip', animation: 160, ghostClass: 'ed-ghost',
      onEnd: function () { applyOrder(ctx.folderId, visibleIds()); }
    });
  }

  // ── Aksi ──
  async function toggle(item, b) {
    b.disabled = true;
    try {
      apply(await call('admin.saveItem', { item: payload(item, { tampil: !item.tampil }) }));
      toast(item.tampil ? 'Disembunyikan dari halaman publik' : 'Ditampilkan di halaman publik');
    } catch (err) { b.disabled = false; if (!err || err.code !== 'AUTH') toast(err && err.message || 'Gagal.', true); }
  }
  async function remove(item) {
    const n = item.tipe === 'folder' ? Object.keys(descendantIds(item.id)).length : 0;
    const ok = await App.confirm({
      title: 'Hapus "' + item.judul + '"?',
      lines: [item.tipe === 'folder' ? (n ? 'Folder ini beserta ' + n + ' item di dalamnya akan dihapus.' : 'Folder kosong ini akan dihapus.')
        : (item.tipe === 'form' || item.tipe === 'dashboard') ? 'Hanya tombolnya yang dihapus; form dan jawabannya tetap ada.' : 'Link ini akan dihapus.'],
      ok: 'Hapus'
    });
    if (!ok) return;
    try { apply(await call('admin.deleteItem', { id: item.id })); toast('Dihapus'); }
    catch (err) { if (!err || err.code !== 'AUTH') toast(err && err.message || 'Gagal menghapus.', true); }
  }

  // ── Dialog item (cepat) ──
  function field(labelText, control, help) {
    const w = el('div', 'ed-field');
    const l = el('label', '', labelText);
    if (control.id) l.htmlFor = control.id;
    w.append(l, control);
    if (help) w.append(el('span', 'ed-help', help));
    return w;
  }
  function textInput(id, val, ph, type) {
    const i = el('input', 'ed-input'); i.id = id; i.type = type || 'text'; i.value = val || '';
    if (ph) i.placeholder = ph;
    i.autocomplete = 'off'; i.maxLength = 500;
    return i;
  }
  function check(text, on) {
    const lab = el('label', 'ed-check');
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!on;
    lab.append(cb, el('span', '', text));
    return { lab: lab, cb: cb };
  }
  function openDialog(build) {
    const d = document.createElement('dialog');
    d.className = 'ed-dlg';
    const box = el('div', 'ed-in');
    d.append(box);
    d.addEventListener('close', function () { d.remove(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    build(box, d);
    document.body.append(d);
    d.showModal();
    return d;
  }

  function openItem(item, tipeBaru, folderId) {
    const tipe = item ? item.tipe : tipeBaru;
    const nama = { link: 'link', folder: 'folder', form: 'form', dashboard: 'dashboard' }[tipe] || tipe;
    openDialog(function (box, d) {
      box.append(el('h2', '', (item ? 'Edit ' : 'Tambah ') + nama));
      const form = el('form'); form.noValidate = true;
      const fJudul = textInput('edJudul', item ? item.judul : '', 'Judul yang tampil');
      form.append(field('Judul', fJudul));
      let fUrl = null;
      if (tipe === 'link') {
        fUrl = textInput('edUrl', item ? item.url : '', 'https://…', 'url');
        form.append(field('Alamat link', fUrl));
      } else if (tipe === 'form' || tipe === 'dashboard') {
        form.append(el('p', 'ed-help', 'Pilihan form diubah lewat panel admin.'));
      }

      // Tab
      let boxes = [];
      if (tipe !== 'folder') {
        const g = st.settings.grup || [];
        const wrap = el('div', 'ed-checks');
        const on = String(item && item.untuk || '').split(',');
        g.forEach(function (x) {
          const c = check(x.nama, on.indexOf(x.id) >= 0); c.cb.value = x.id;
          boxes.push(c.cb); wrap.append(c.lab);
        });
        if (!g.length) wrap.append(el('span', 'ed-help', 'Belum ada tab.'));
        form.append(field('Tampil di tab', wrap, 'Tidak ada yang dicentang = untuk semua tab.'));
      }

      // Folder induk
      const sel = el('select', 'ed-input'); sel.id = 'edParent';
      sel.append(new Option('Halaman utama', ''));
      const skip = item ? Object.assign(descendantIds(item.id), (function () { const o = {}; o[item.id] = true; return o; })()) : {};
      (function walk(pid, depth) {
        siblings(pid).forEach(function (i) {
          if (i.tipe !== 'folder' || skip[i.id]) return;
          sel.append(new Option(new Array(depth + 1).join('— ') + i.judul, i.id));
          walk(i.id, depth + 1);
        });
      })('', 0);
      sel.value = item ? item.parent_id : (folderId || '');
      form.append(field('Letak', sel));

      const vis = check('Tampil di halaman publik', item ? item.tampil : true);
      const soon = check('Tandai "Segera"', item ? item.segera === true : false);
      const lock = check('Kunci dengan password', item ? item.pakai_sandi === true : false);
      const pw = textInput('edSandi', '', item && item.pakai_sandi ? 'Kosongkan = pakai password yang lama' : 'Password baru (4–64 karakter)', 'password');
      pw.maxLength = 64;
      const pwWrap = field('Password', pw);
      pwWrap.hidden = !lock.cb.checked;
      lock.cb.addEventListener('change', function () { pwWrap.hidden = !lock.cb.checked; if (lock.cb.checked) pw.focus(); });
      form.append(vis.lab, soon.lab, lock.lab, pwWrap);

      const more = el('a', 'ed-more', 'Ikon dan pengaturan lengkap: panel admin');
      more.href = 'admin.html'; more.target = '_blank'; more.rel = 'noopener';
      form.append(more);

      const msg = el('p', 'ed-msg'); msg.setAttribute('role', 'alert');
      const row = el('div', 'ed-actions');
      const no = el('button', 'btn', 'Batal'); no.type = 'button';
      no.addEventListener('click', function () { d.close(); });
      const ok = el('button', 'btn btn-primary', 'Simpan'); ok.type = 'submit';
      row.append(no, ok);
      form.append(msg, row);
      box.append(form);

      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const it = item ? payload(item) : { tipe: tipe, url: '', form_id: '', ikon_jenis: 'none', ikon_isi: '', ikon_warna: '', ikon_bentuk: '' };
        it.judul = fJudul.value;
        if (fUrl) it.url = fUrl.value;
        it.parent_id = sel.value;
        it.tampil = vis.cb.checked;
        it.segera = soon.cb.checked;
        it.untuk = tipe === 'folder' ? [] : boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
        it.pakai_sandi = lock.cb.checked;
        if (it.pakai_sandi && pw.value) it.sandi = pw.value;
        ok.disabled = true; msg.textContent = '';
        try {
          apply(await call('admin.saveItem', { item: it }));
          d.close();
          toast('Tersimpan');
        } catch (err) {
          if (err && err.code === 'AUTH') d.close(); else msg.textContent = (err && err.message) || 'Gagal menyimpan.';
        } finally { ok.disabled = false; }
      });
      setTimeout(function () { fJudul.focus(); }, 30);
    });
  }

  // ── Atur tab ──
  function openTabs() {
    const rows = (st.settings.grup || []).map(function (g) { return { id: g.id, nama: g.nama, qr: g.qr === true }; });
    openDialog(function (box, d) {
      box.append(el('h2', '', 'Atur tab'));
      box.append(el('p', 'ed-help', 'Tab "Semua" selalu ada. Tab yang masih dipakai item tidak bisa dihapus: pindahkan dulu item-nya.'));
      const list = el('div', 'ed-tabrows');
      const msg = el('p', 'ed-msg'); msg.setAttribute('role', 'alert');
      function draw() {
        list.replaceChildren();
        if (!rows.length) list.append(el('p', 'ed-help', 'Belum ada tab.'));
        rows.forEach(function (r, i) {
          const row = el('div', 'ed-tabrow');
          const inp = el('input', 'ed-input'); inp.type = 'text'; inp.value = r.nama; inp.maxLength = 30;
          inp.setAttribute('aria-label', 'Nama tab ' + (i + 1));
          inp.addEventListener('input', function () { r.nama = inp.value; });
          const pakai = rows.length && r.id ? st.items.filter(function (x) { return String(x.untuk || '').split(',').indexOf(r.id) >= 0; }).length : 0;
          row.append(inp);
          if (pakai) row.append(el('span', 'ed-chip', pakai + ' item'));
          row.append(
            btn('up', 'Naikkan', function () { if (i > 0) { rows.splice(i - 1, 0, rows.splice(i, 1)[0]); draw(); } }),
            btn('down', 'Turunkan', function () { if (i < rows.length - 1) { rows.splice(i + 1, 0, rows.splice(i, 1)[0]); draw(); } }),
            btn('trash', 'Hapus tab', function () { rows.splice(i, 1); draw(); }, 'danger'));
          list.append(row);
        });
        add.disabled = rows.length >= MAX_GRUP;
      }
      const add = el('button', 'btn', 'Tambah tab'); add.type = 'button';
      add.prepend(App.svg('plus'));
      add.addEventListener('click', function () {
        if (rows.length >= MAX_GRUP) return;
        rows.push({ id: '', nama: '', qr: false }); draw();
        const ins = list.querySelectorAll('input'); ins[ins.length - 1].focus();
      });
      const row = el('div', 'ed-actions');
      const no = el('button', 'btn', 'Batal'); no.type = 'button';
      no.addEventListener('click', function () { d.close(); });
      const ok = el('button', 'btn btn-primary', 'Simpan'); ok.type = 'button';
      row.append(no, ok);
      box.append(list, add, msg, row);
      draw();
      ok.addEventListener('click', async function () {
        ok.disabled = true; msg.textContent = '';
        const s = st.settings;
        try {
          const r = await call('admin.saveSettings', {
            settings: { judul: s.judul, subjudul: s.subjudul, deskripsi: s.deskripsi, tema: s.tema,
              grup: rows.map(function (g) { return { id: g.id, nama: g.nama, qr: g.qr === true }; }) }
          });
          apply({ settings: r.settings });
          d.close();
          toast('Tab tersimpan');
        } catch (err) {
          if (err && err.code === 'AUTH') d.close(); else msg.textContent = (err && err.message) || 'Gagal menyimpan.';
        } finally { ok.disabled = false; }
      });
    });
  }

  // ── Bilah atas ──
  function banner() {
    const b = el('div', 'ed-banner'); b.id = 'edBanner';
    b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Mode edit');
    const t = el('span', 'ed-banner-t', 'Mode edit');
    const sub = el('span', 'ed-banner-s', 'Perubahan langsung tersimpan');
    const tabs = el('button', 'btn', 'Atur tab'); tabs.type = 'button';
    tabs.addEventListener('click', openTabs);
    const adm = el('a', 'btn', 'Panel admin'); adm.href = 'admin.html'; adm.target = '_blank'; adm.rel = 'noopener';
    const done = el('button', 'btn btn-primary', 'Selesai'); done.type = 'button';
    done.addEventListener('click', leave);
    b.append(el('span', 'ed-banner-l'), tabs, adm, done);
    b.firstChild.append(t, sub);
    document.body.prepend(b);
  }

  // ── Masuk / keluar ──
  function leave() {
    try { sessionStorage.removeItem('edit_on'); } catch (e) { /* abaikan */ }
    const u = new URL(location.href);
    u.searchParams.delete('edit');
    location.replace(u.pathname + u.search + u.hash);
  }

  async function enter() {
    if (st.on) return;
    if (!getToken()) {
      const okLogin = await App.askPassword({
        title: 'Masuk untuk mengedit',
        text: 'Masukkan password admin.',
        submit: async function (pw) {
          const r = await App.post({ action: 'login', password: pw });
          setToken(r.token);
        }
      });
      if (!okLogin) { leave(); return; }
    }
    let d;
    try {
      d = await call('admin.list', {});
    } catch (err) {
      if (!err || err.code !== 'AUTH') toast((err && err.message) || 'Tidak bisa memuat data admin.', true);
      return;
    }
    st.on = true;
    if (!document.getElementById('edCss')) {
      const l = document.createElement('link'); l.id = 'edCss'; l.rel = 'stylesheet'; l.href = 'edit.css?v=50'; document.head.append(l);
    }
    Pub.setEditing(true);
    document.body.classList.add('editing');
    try { sessionStorage.setItem('edit_on', '1'); } catch (e) { /* abaikan */ }
    try { await loadSortable(); } catch (e) { toast('Seret-dan-lepas tidak tersedia; pakai tombol panah.', true); }
    banner();
    Pub.editTile = editTile;
    Pub.addTile = addTile;
    Pub.afterRender = initSortable;
    Pub.onTabs = function (box) {
      const b = el('button', 'aud-btn ed-tabedit', ''); b.type = 'button';
      b.title = 'Atur tab'; b.setAttribute('aria-label', 'Atur tab');
      b.append(App.svg('edit'));
      b.addEventListener('click', openTabs);
      box.append(b);
    };
    apply(d);
  }

  // Tombol pensil di dock: tampil hanya bila admin sudah masuk di tab ini.
  const dockBtn = document.getElementById('editBtn');
  if (dockBtn) {
    dockBtn.append(App.svg('edit'));
    dockBtn.hidden = !getToken();
    dockBtn.addEventListener('click', function () { enter(); });
  }

  let want = false;
  try { want = /(?:^|[?&])edit=1(?:&|$)/.test(location.search) || sessionStorage.getItem('edit_on') === '1'; } catch (e) { /* abaikan */ }
  // Syarat: harus admin (ada token) atau sengaja membuka ?edit=1.
  if (want && (getToken() || /(?:^|[?&])edit=1(?:&|$)/.test(location.search))) enter();
  else { try { sessionStorage.removeItem('edit_on'); } catch (e) { /* abaikan */ } }
})();
