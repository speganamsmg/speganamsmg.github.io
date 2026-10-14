/* SPEGANA — panel admin: tab Form (daftar form dan pembuat form) */
(function () {
  'use strict';

  const A = window.Admin;
  const el = App.el;
  const $ = function (id) { return document.getElementById(id); };

  const TIPE = [
    ['pilihan', 'Pilihan tunggal'],
    ['centang', 'Kotak centang (boleh banyak)'],
    ['dropdown', 'Dropdown'],
    ['singkat', 'Jawaban singkat'],
    ['paragraf', 'Paragraf'],
    ['skala', 'Skala'],
    ['tanggal', 'Tanggal'],
    ['waktu', 'Jam']
  ];
  const CHOICE = ['pilihan', 'centang', 'dropdown'];

  function loadingBox() { const b = el('div', 'loading-box'); b.append(el('span', 'spin'), document.createTextNode('Memuat…')); return b; }

  let forms = [];
  let model = null;     // {form, blocks}
  let dirty = false;
  let listNames = [];   // nama daftar yang ada

  // ── Pembantu ──
  function mk(tag, cls, text) { return el(tag, cls, text); }

  function btn(label, cls, onClick, icon) {
    const b = mk('button', 'btn' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    if (icon) b.append(App.svg(icon));
    b.append(document.createTextNode(label));
    b.addEventListener('click', onClick);
    return b;
  }
  function ibtn(icon, label, onClick, danger) {
    const b = mk('button', 'icon-btn sm' + (danger ? ' danger' : ''));
    b.type = 'button'; b.title = label; b.setAttribute('aria-label', label);
    b.append(App.svg(icon));
    b.addEventListener('click', onClick);
    return b;
  }

  function field(label, control, help) {
    const w = mk('div', 'field');
    const l = mk('label', '', label);
    if (control.id) l.htmlFor = control.id;
    w.append(l, control);
    if (help) w.append(mk('span', 'help', help));
    return w;
  }
  let uid = 0;
  function nid() { return 'ef' + (++uid); }

  function input(obj, key, opts) {
    opts = opts || {};
    const i = mk(opts.area ? 'textarea' : 'input', 'input');
    i.id = nid();
    if (!opts.area) i.type = opts.type || 'text';
    if (opts.area) i.rows = opts.rows || 3;
    if (opts.max) i.maxLength = opts.max;
    if (opts.min !== undefined) i.min = opts.min;
    if (opts.maxv !== undefined) i.max = opts.maxv;
    if (opts.ph) i.placeholder = opts.ph;
    i.value = obj[key] === undefined || obj[key] === null ? '' : obj[key];
    i.addEventListener('input', function () {
      obj[key] = opts.num ? (i.value === '' ? 0 : Number(i.value)) : i.value;
      if (opts.onInput) opts.onInput();
    });
    return i;
  }

  function select(obj, key, pairs, onChange) {
    const s = mk('select', 'input');
    s.id = nid();
    pairs.forEach(function (p) { s.append(new Option(p[1], p[0])); });
    s.value = obj[key];
    s.addEventListener('change', function () {
      obj[key] = s.value;
      if (onChange) onChange();
    });
    return s;
  }

  function checkbox(obj, key, label, onChange) {
    const l = mk('label', 'check');
    const c = mk('input'); c.type = 'checkbox'; c.checked = !!obj[key];
    c.addEventListener('change', function () { obj[key] = c.checked; if (onChange) onChange(); });
    l.append(c, mk('span', '', label));
    return l;
  }

  function isoToLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function localToIso(v) {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }

  function copyText(text) {
    const fallback = function () {
      const t = mk('textarea'); t.value = text; document.body.append(t); t.select();
      try { document.execCommand('copy'); } catch (e) { /* abaikan */ }
      t.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(fallback);
    } else {
      fallback();
    }
    A.toast('Tautan disalin');
  }

  function formUrl(slug) {
    return new URL('form.html?f=' + encodeURIComponent(slug), location.href).href;
  }

  // ── Bilah format teks: tebal, miring, daftar bernomor, daftar butir ──
  function richBar(ta) {
    const bar = mk('div', 'rbar');
    const wrap = function (open, close, label, title) {
      const b = mk('button', 'rb', label); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
      b.addEventListener('click', function () {
        const a = ta.selectionStart, z = ta.selectionEnd;
        const sel = ta.value.slice(a, z) || 'teks';
        ta.setRangeText(open + sel + close, a, z, 'select');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
      });
      return b;
    };
    const lines = function (label, title, prefix) {
      const b = mk('button', 'rb', label); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
      b.addEventListener('click', function () {
        let a = ta.selectionStart, z = ta.selectionEnd;
        a = ta.value.lastIndexOf('\n', a - 1) + 1;
        const chunk = ta.value.slice(a, z) || '';
        const out = (chunk || 'butir').split('\n').map(function (ln, i) { return prefix(i) + ln; }).join('\n');
        ta.setRangeText(out, a, z, 'select');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
      });
      return b;
    };
    bar.append(
      wrap('**', '**', 'B', 'Tebal'),
      wrap('*', '*', 'I', 'Miring'),
      lines('1.', 'Daftar bernomor', function (i) { return (i + 1) + '. '; }),
      lines('•', 'Daftar butir', function () { return '- '; })
    );
    bar.children[0].style.fontWeight = '800';
    bar.children[1].style.fontStyle = 'italic';
    return bar;
  }

  // ═══════════ DAFTAR FORM ═══════════
  async function loadList() {
    const host = $('formsList');
    if (!forms.length) host.replaceChildren(loadingBox());
    try {
      await A.swr('admin.forms.list', {}, function (d) {
        forms = d.forms;
        A.state.forms = forms.map(function (f) { return { form_id: f.form_id, judul: f.judul, slug: f.slug, status: f.status, dashboard_aktif: f.dashboard_aktif }; });
        renderList();
      });
    } catch (e) {
      if (e.code !== 'AUTH') host.replaceChildren(mk('div', 'empty', e.message));
    }
  }

  function windowText(f) {
    const t = [];
    if (f.buka_pada) t.push('buka ' + App.fmtDateTime(f.buka_pada));
    if (f.tutup_pada) t.push('tutup ' + App.fmtDateTime(f.tutup_pada));
    return t.join(' · ');
  }

  function renderList() {
    const host = $('formsList');
    host.replaceChildren();
    if (!forms.length) {
      const box = mk('div', 'empty');
      box.append(mk('strong', '', 'Belum ada form.'), document.createTextNode('Buat form pertama dengan tombol di atas.'));
      host.append(box);
      return;
    }
    forms.forEach(function (f) {
      const card = mk('div', 'card fm');
      const top = mk('div', 'fm-top');
      const main = mk('div', 'row-main');
      const title = mk('div', 'row-title');
      title.append(mk('span', '', f.judul));
      title.append(mk('span', 'badge' + (f.status === 'buka' ? ' on' : ''), f.status === 'buka' ? 'Dibuka' : 'Ditutup'));
      main.append(title);
      const meta = f.jumlah_blok + ' blok · ' + f.jumlah_pertanyaan + ' pertanyaan · ' + f.aktif + ' jawaban aktif (' + f.total + ' pengiriman)';
      main.append(mk('div', 'row-meta nowrap-off', meta));
      const wt = windowText(f);
      if (wt) main.append(mk('div', 'row-meta nowrap-off', wt));
      main.append(mk('div', 'row-meta nowrap-off', 'form.html?f=' + f.slug));

      const sw = mk('label', 'switch');
      sw.title = 'Buka atau tutup pengisian';
      const ck = mk('input'); ck.type = 'checkbox'; ck.checked = f.status === 'buka';
      ck.setAttribute('aria-label', 'Form "' + f.judul + '" dibuka');
      ck.addEventListener('change', function () { toggleStatus(f, ck); });
      sw.append(ck, mk('span', 'track'));
      top.append(main, sw);

      const acts = mk('div', 'fm-acts');
      acts.append(
        btn('Edit', 'btn-primary', function () { openEditor(f.form_id); }, 'edit'),
        btn('Salin tautan', '', function () { copyText(formUrl(f.slug)); }, 'copy'),
        btn('Pasang di beranda', '', function () { A.selectTab('items'); A.openItemDialog('form', null, f.form_id); }, 'plus'),
        btn('Lihat hasil', '', function () { A.selectTab('results'); window.dispatchEvent(new CustomEvent('open-results', { detail: f.form_id })); }, 'chart')
      );
      const sheet = mk('a', 'btn');
      sheet.href = f.sheet_url; sheet.target = '_blank'; sheet.rel = 'noopener noreferrer';
      sheet.append(App.svg('sheet'), document.createTextNode('Jawaban di Sheets'));
      acts.append(sheet,
        btn('Duplikat', '', function () { duplicate(f); }, 'copy'),
        btn('Hapus', 'btn-danger', function () { removeForm(f); }, 'trash'));
      card.append(top, acts);
      host.append(card);
    });
  }

  async function toggleStatus(f, ck) {
    const want = ck.checked;
    ck.disabled = true;
    try {
      const v = await A.call('admin.form.get', { form_id: f.form_id });
      v.form.status = want ? 'buka' : 'tutup';
      await A.call('admin.form.save', { form: v.form, blocks: v.blocks });
      A.toast(want ? 'Form dibuka' : 'Form ditutup');
      await loadList();
    } catch (e) {
      ck.checked = !want; ck.disabled = false;
      if (e.code !== 'AUTH') A.toast(e.message, true);
    }
  }

  async function duplicate(f) {
    try {
      const v = await A.call('admin.form.get', { form_id: f.form_id });
      v.form.form_id = '';
      v.form.slug = '';
      v.form.judul = (v.form.judul + ' (salinan)').slice(0, 120);
      v.form.status = 'tutup';
      v.blocks.forEach(function (b) {
        b.block_id = '';
        b.questions.forEach(function (q) { q.q_id = ''; });
      });
      await A.call('admin.form.save', { form: v.form, blocks: v.blocks });
      A.toast('Form diduplikat dalam keadaan ditutup');
      await loadList();
    } catch (e) {
      if (e.code !== 'AUTH') A.toast(e.message, true);
    }
  }

  async function removeForm(f) {
    if (!window.confirm('Hapus form "' + f.judul + '"? Tombolnya di halaman utama ikut hilang. Lembar jawaban di Google Sheets tetap disimpan.')) return;
    try {
      const d = await A.call('admin.form.delete', { form_id: f.form_id });
      A.setItems(d.items);
      A.toast('Form dihapus');
      await loadList();
    } catch (e) {
      if (e.code !== 'AUTH') A.toast(e.message, true);
    }
  }

  // ═══════════ PEMBUAT FORM ═══════════
  function newQuestion() {
    return {
      q_id: '', tipe: 'pilihan', teks: '', wajib: false, pilihan: ['Ya', 'Tidak'], acak: false,
      min_pilih: 0, maks_pilih: 0, skala_min: 1, skala_maks: 5, skala_label_min: '', skala_label_maks: '',
      tampil: true, tampil_dashboard: true, kategori: ''
    };
  }
  function newBlock() {
    return { block_id: '', judul: '', teks_bacaan: '', gambar: '', tampil: true, questions: [newQuestion()] };
  }
  function newModel() {
    return {
      form: {
        form_id: '', slug: '', judul: '', deskripsi: '', label_blok: 'Soal', mode_tampilan: 'per_blok', navigasi: 'bebas',
        identitas: 'anonim', id_daftar: '', mode_daftar: 'tertutup', status: 'buka', buka_pada: '', tutup_pada: '',
        kuota_per_nama: 1, batas_perangkat: 0, batas_total: 0, tampil_status_nama: true, pesan_selesai: '', dashboard_aktif: false
      },
      blocks: [newBlock()]
    };
  }

  async function openEditor(formId) {
    try {
      const results = await Promise.all([
        formId ? A.call('admin.form.get', { form_id: formId }) : Promise.resolve(newModel()),
        A.call('admin.names.lists')
      ]);
      model = results[0];
      listNames = results[1].lists.map(function (l) { return l.list_id; });
    } catch (e) {
      if (e.code !== 'AUTH') A.toast(e.message, true);
      return;
    }
    dirty = false;
    $('formsListView').hidden = true;
    $('formEditor').hidden = false;
    renderEditor();
    window.scrollTo(0, 0);
  }

  function closeEditor(force) {
    if (!force && dirty && !window.confirm('Ada perubahan yang belum disimpan. Tinggalkan editor?')) return;
    model = null; dirty = false;
    $('formEditor').hidden = true;
    $('formEditor').replaceChildren();
    $('formsListView').hidden = false;
    loadList();
  }

  function markDirty() { dirty = true; }

  function renderEditor() {
    const root = $('formEditor');
    const keepY = window.scrollY;
    root.replaceChildren();
    const f = model.form;

    const head = mk('div', 'ed-head');
    head.append(btn('Kembali', '', function () { closeEditor(false); }, 'back'),
      mk('h2', '', f.form_id ? 'Edit form' : 'Form baru'));
    root.append(head);

    // Informasi
    const info = mk('section', 'card');
    info.append(mk('h3', '', 'Informasi form'));
    info.append(field('Judul', input(f, 'judul', { max: 120 })));
    const ta = input(f, 'deskripsi', { area: true, rows: 4, max: 2000 });
    const dw = field('Deskripsi (tampil di atas form)', ta);
    dw.insertBefore(richBar(ta), ta);
    info.append(dw);
    const slugIn = input(f, 'slug', { max: 40, ph: 'otomatis dari judul' });
    info.append(field('Alamat form', slugIn, 'Huruf kecil, angka, tanda hubung. Mengubahnya membuat tautan lama tidak berlaku.'));
    info.append(field('Status', select(f, 'status', [['buka', 'Dibuka untuk diisi'], ['tutup', 'Ditutup']])));
    root.append(info);

    // Tampilan
    const tp = mk('section', 'card');
    tp.append(mk('h3', '', 'Tampilan pengisian'));
    const g = mk('div', 'grid2');
    g.append(
      field('Cara menampilkan', select(f, 'mode_tampilan', [['per_blok', 'Satu blok per halaman'], ['satu_halaman', 'Semua dalam satu halaman']])),
      field('Navigasi antar blok', select(f, 'navigasi', [['bebas', 'Bebas (tombol nomor, bisa loncat)'], ['berurutan', 'Berurutan (harus lengkap dulu)']])),
      field('Sebutan blok', input(f, 'label_blok', { max: 30 }), 'Contoh: Soal, Bagian, Pernyataan.')
    );
    tp.append(g);
    const pm = input(f, 'pesan_selesai', { area: true, rows: 2, max: 1000 });
    tp.append(field('Pesan setelah mengirim', pm, 'Kosongkan untuk memakai pesan bawaan.'));
    root.append(tp);

    // Dashboard hasil
    const dc = mk('section', 'card');
    dc.append(mk('h3', '', 'Dashboard hasil'));
    dc.append(checkbox(f, 'dashboard_aktif', 'Aktifkan dashboard publik untuk form ini'));
    dc.append(mk('p', 'help', 'Bila aktif, siapa pun yang punya tautannya bisa melihat ringkasan jawaban (tanpa nama responden dan tanpa jawaban teks). Pilih soal mana yang tampil di bagian pertanyaan. Pasang tombolnya di beranda lewat tab Item, Tambah dashboard.'));
    root.append(dc);

    // Identitas dan batas
    const idc = mk('section', 'card');
    idc.append(mk('h3', '', 'Responden dan batasan'));
    const idHost = mk('div');
    const drawId = function () {
      idHost.replaceChildren();
      const row = mk('div', 'grid2');
      row.append(field('Identitas responden', select(f, 'identitas', [
        ['anonim', 'Anonim (tanpa nama)'],
        ['wajib_nama', 'Wajib menulis nama'],
        ['pilih_daftar', 'Memilih nama dari daftar']
      ], drawId)));
      if (f.identitas === 'pilih_daftar') {
        const names = listNames.slice();
        if (f.id_daftar && names.indexOf(f.id_daftar) < 0) names.push(f.id_daftar);
        const pairs = names.length ? names.map(function (n) { return [n, n]; }) : [['', 'Belum ada daftar (buat di tab Daftar nama)']];
        if (!f.id_daftar && names.length) f.id_daftar = names[0];
        row.append(field('Daftar nama', select(f, 'id_daftar', pairs)));
        row.append(field('Jika nama tidak ada di daftar', select(f, 'mode_daftar', [
          ['tertutup', 'Tidak boleh (hanya dari daftar)'],
          ['terbuka', 'Boleh menambah nama sendiri']
        ])));
      }
      idHost.append(row);
      const lim = mk('div', 'grid2');
      if (f.identitas !== 'anonim') {
        lim.append(field('Kesempatan kirim per nama', input(f, 'kuota_per_nama', { type: 'number', num: true, min: 1, maxv: 50 }),
          'Jika dikirim lebih dari sekali, jawaban terakhir yang berlaku.'));
      }
      lim.append(
        field('Batas kirim per perangkat', input(f, 'batas_perangkat', { type: 'number', num: true, min: 0, maxv: 1000 }), '0 = tanpa batas.'),
        field('Batas total responden', input(f, 'batas_total', { type: 'number', num: true, min: 0, maxv: 100000 }), '0 = tanpa batas.')
      );
      idHost.append(lim);
    };
    drawId();
    idc.append(idHost);
    const win = mk('div', 'grid2');
    const bk = mk('input', 'input'); bk.type = 'datetime-local'; bk.id = nid(); bk.value = isoToLocal(f.buka_pada);
    bk.addEventListener('input', function () { f.buka_pada = localToIso(bk.value); });
    const tt = mk('input', 'input'); tt.type = 'datetime-local'; tt.id = nid(); tt.value = isoToLocal(f.tutup_pada);
    tt.addEventListener('input', function () { f.tutup_pada = localToIso(tt.value); });
    win.append(field('Mulai dibuka (opsional)', bk), field('Otomatis ditutup (opsional)', tt));
    idc.append(win);
    root.append(idc);

    // Blok
    const blocksHost = mk('div', 'blocks');
    model.blocks.forEach(function (b, bi) { blocksHost.append(renderBlock(b, bi)); });
    root.append(blocksHost);
    root.append(btn('Tambah blok', '', function () { model.blocks.push(newBlock()); markDirty(); renderEditor(); }, 'plus'));

    // Simpan
    const bar = mk('div', 'save-bar');
    const msg = mk('span', 'save-msg'); msg.setAttribute('role', 'alert');
    const save = btn('Simpan form', 'btn-primary', function () { doSave(save, msg); });
    bar.append(msg, save);
    root.append(bar);

    window.scrollTo(0, keepY);
  }

  // ── Penyalinan (memudahkan menyusun banyak blok yang mirip) ──
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function stripIds(b) { b.block_id = ''; b.questions.forEach(function (q) { q.q_id = ''; }); return b; }

  // Menaikkan angka terakhir pada judul ("Pasal 4" -> "Pasal 5") dan angka yang sama pada teks pertanyaan.
  function bumpNumber(block, step) {
    const m = /^(.*?)(\d+)(\D*)$/.exec(block.judul || '');
    if (!m) return block;
    const old = m[2];
    const now = String(Number(old) + step);
    block.judul = m[1] + now + m[3];
    const word = /(\S+)\s*$/.exec(m[1]);
    if (word) {
      const esc = word[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('(' + esc + '\\s*)' + old + '(?!\\d)', 'gi');
      block.questions.forEach(function (q) { q.teks = String(q.teks || '').replace(re, '$1' + now); });
    }
    return block;
  }

  function duplicateBlock(bi, times) {
    const src = model.blocks[bi];
    const copies = [];
    for (let k = 1; k <= times; k++) copies.push(bumpNumber(stripIds(clone(src)), k));
    Array.prototype.splice.apply(model.blocks, [bi + 1, 0].concat(copies));
    markDirty(); renderEditor();
    A.toast(times === 1 ? 'Blok diduplikat' : times + ' blok diduplikat');
  }

  function duplicateQuestion(b, qi) {
    const c = clone(b.questions[qi]); c.q_id = '';
    b.questions.splice(qi + 1, 0, c);
    markDirty(); renderEditor();
  }

  function copyQuestionToOthers(b, qi) {
    const word = model.form.label_blok || 'Soal';
    const others = model.blocks.filter(function (x) { return x !== b; });
    if (!others.length) { A.toast('Belum ada ' + word.toLowerCase() + ' lain', true); return; }
    if (!window.confirm('Salin pertanyaan ini ke ' + others.length + ' ' + word.toLowerCase() + ' lain (ditambahkan di akhir)?')) return;
    others.forEach(function (x) { const c = clone(b.questions[qi]); c.q_id = ''; x.questions.push(c); });
    markDirty(); renderEditor();
    A.toast('Pertanyaan disalin ke ' + others.length + ' ' + word.toLowerCase());
  }

  function applyChoicesToSameType(q) {
    let n = 0;
    model.blocks.forEach(function (b) { b.questions.forEach(function (x) { if (x !== q && x.tipe === q.tipe) { x.pilihan = q.pilihan.slice(); n++; } }); });
    if (!n) { A.toast('Tidak ada pertanyaan sejenis lain', true); return; }
    if (!window.confirm('Samakan pilihan jawaban di ' + n + ' pertanyaan sejenis lainnya dengan yang ini?')) { return; }
    markDirty(); renderEditor();
    A.toast('Pilihan disamakan di ' + n + ' pertanyaan');
  }

  function renderBlock(b, bi) {
    const label = model.form.label_blok || 'Soal';
    const card = mk('section', 'card blk' + (b.tampil ? '' : ' is-off'));
    const head = mk('div', 'blk-head');
    head.append(mk('h3', '', label + ' ' + (bi + 1)));
    const tools = mk('div', 'blk-tools');
    const sw = mk('label', 'switch'); sw.title = 'Tampilkan blok ini pada form';
    const ck = mk('input'); ck.type = 'checkbox'; ck.checked = b.tampil;
    ck.setAttribute('aria-label', 'Tampilkan blok ' + (bi + 1));
    ck.addEventListener('change', function () { b.tampil = ck.checked; markDirty(); card.classList.toggle('is-off', !b.tampil); });
    sw.append(ck, mk('span', 'track'));
    tools.append(sw,
      ibtn('up', 'Naikkan blok', function () { move(model.blocks, bi, -1); }),
      ibtn('down', 'Turunkan blok', function () { move(model.blocks, bi, 1); }),
      ibtn('copy', 'Duplikat ' + label.toLowerCase(), function () { duplicateBlock(bi, 1); }),
      ibtn('trash', 'Hapus blok', function () {
        if (!window.confirm('Hapus ' + label + ' ' + (bi + 1) + ' beserta pertanyaannya? Jawaban lama di Sheets tetap tersimpan.')) return;
        model.blocks.splice(bi, 1); markDirty(); renderEditor();
      }, true));
    head.append(tools);
    card.append(head);

    card.append(field('Judul blok (opsional)', input(b, 'judul', { max: 120 })));
    const ta = input(b, 'teks_bacaan', { area: true, rows: 5, max: 20000 });
    const tw = field('Teks bacaan (opsional)', ta, 'Contoh: kutipan pasal atau penjelasan yang dibaca dulu sebelum menjawab.');
    tw.insertBefore(richBar(ta), ta);
    card.append(tw);
    card.append(field('Gambar (opsional, alamat https)', input(b, 'gambar', { type: 'url', max: 500, ph: 'https://… atau link Google Drive' })));

    const qh = mk('div', 'qs');
    b.questions.forEach(function (q, qi) { qh.append(renderQuestion(b, q, qi)); });
    card.append(qh);
    const foot = mk('div', 'blk-foot');
    foot.append(
      btn('Tambah pertanyaan', '', function () { b.questions.push(newQuestion()); markDirty(); renderEditor(); }, 'plus'),
      btn('Duplikat beberapa kali', 'sm', function () {
        const v = window.prompt('Berapa salinan ' + label.toLowerCase() + ' ini yang dibuat? (1 sampai 20)\nAngka pada judul dinaikkan otomatis (Pasal 4 → Pasal 5, 6, …).', '4');
        if (v === null) return;
        const n = Math.floor(Number(v));
        if (!(n >= 1 && n <= 20)) { A.toast('Isi angka 1 sampai 20', true); return; }
        duplicateBlock(bi, n);
      }, 'copy'));
    card.append(foot);
    return card;
  }

  function move(arr, i, d) {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    markDirty(); renderEditor();
  }

  function renderQuestion(b, q, qi) {
    const card = mk('div', 'qcard' + (q.tampil ? '' : ' is-off'));
    const top = mk('div', 'q-top');
    top.append(mk('span', 'q-no', String(qi + 1)));
    const tools = mk('div', 'blk-tools');
    tools.append(
      ibtn('up', 'Naikkan pertanyaan', function () { move(b.questions, qi, -1); }),
      ibtn('down', 'Turunkan pertanyaan', function () { move(b.questions, qi, 1); }),
      ibtn('copy', 'Duplikat pertanyaan', function () { duplicateQuestion(b, qi); }),
      ibtn('trash', 'Hapus pertanyaan', function () {
        if (b.questions.length === 1 && !window.confirm('Ini pertanyaan terakhir di blok. Hapus?')) return;
        b.questions.splice(qi, 1); markDirty(); renderEditor();
      }, true));
    top.append(tools);
    card.append(top);

    card.append(field('Pertanyaan', input(q, 'teks', { area: true, rows: 2, max: 500 })));
    const typeSel = select(q, 'tipe', TIPE, function () {
      if (CHOICE.indexOf(q.tipe) >= 0 && !q.pilihan.length) q.pilihan = ['Ya', 'Tidak'];
      markDirty(); renderEditor();
    });
    card.append(field('Jenis jawaban', typeSel));

    if (CHOICE.indexOf(q.tipe) >= 0) {
      const ta = mk('textarea', 'input'); ta.id = nid(); ta.rows = Math.min(12, Math.max(3, q.pilihan.length + 1));
      ta.value = q.pilihan.join('\n');
      ta.addEventListener('input', function () { q.pilihan = ta.value.split('\n'); });
      const w = field('Pilihan jawaban (satu per baris)', ta);
      const presets = mk('div', 'presets');
      [['Ya / Tidak', ['Ya', 'Tidak']], ['Setuju / Tidak setuju', ['Setuju', 'Tidak setuju']], ['Benar / Salah', ['Benar', 'Salah']]].forEach(function (p) {
        presets.append(btn(p[0], 'sm', function () { q.pilihan = p[1].slice(); ta.value = q.pilihan.join('\n'); markDirty(); }));
      });
      presets.append(btn('Samakan di semua pertanyaan sejenis', 'sm', function () { applyChoicesToSameType(q); }));
      w.append(presets);
      card.append(w);
      card.append(checkbox(q, 'acak', 'Acak urutan pilihan (berbeda untuk tiap perangkat)'));
      if (q.tipe === 'centang') {
        const g = mk('div', 'grid2');
        g.append(
          field('Pilih minimal', input(q, 'min_pilih', { type: 'number', num: true, min: 0, maxv: 100 })),
          field('Pilih maksimal', input(q, 'maks_pilih', { type: 'number', num: true, min: 0, maxv: 100 }), '0 = tanpa batas.')
        );
        card.append(g);
      }
    } else if (q.tipe === 'skala') {
      const g = mk('div', 'grid2');
      g.append(
        field('Mulai dari', select(q, 'skala_min', [[0, '0'], [1, '1']].map(function (x) { return [String(x[0]), x[1]]; }), function () { q.skala_min = Number(q.skala_min); })),
        field('Sampai', input(q, 'skala_maks', { type: 'number', num: true, min: 2, maxv: 10 })),
        field('Label awal', input(q, 'skala_label_min', { max: 40, ph: 'Sangat tidak setuju' })),
        field('Label akhir', input(q, 'skala_label_maks', { max: 40, ph: 'Sangat setuju' }))
      );
      card.append(g);
    }

    if (q.tipe === 'singkat' || q.tipe === 'paragraf') {
      const kt = input(q, 'kategori', { area: true, rows: 4, max: 2000, ph: 'Redaksi: redaksi, kalimat, bahasa\nSanksi: sanksi, denda' });
      card.append(field('Pengelompokan jawaban (opsional)', kt, 'Satu kelompok per baris: Nama: kata1, kata2. Jawaban yang memuat salah satu kata masuk ke kelompok itu. Dashboard hanya menampilkan persentase tiap kelompok, bukan isi jawaban. Dikosongkan = dikelompokkan otomatis menurut kata yang sering muncul. Di tab Hasil ada saran kata kunci.'));
    }

    const flags = mk('div', 'flags');
    flags.append(
      checkbox(q, 'wajib', 'Wajib dijawab'),
      checkbox(q, 'tampil', 'Tampilkan pada form', function () { card.classList.toggle('is-off', !q.tampil); }),
      checkbox(q, 'tampil_dashboard', 'Tampilkan hasilnya di dashboard publik')
    );
    card.append(flags);
    card.append(btn('Salin ke semua ' + (model.form.label_blok || 'Soal') + ' lain', 'sm', function () { copyQuestionToOthers(b, qi); }, 'copy'));
    return card;
  }

  async function doSave(button, msg) {
    msg.textContent = '';
    msg.classList.remove('ok');
    A.setBusy(button, true);
    try {
      const wasNew = !model.form.form_id;
      model.blocks.forEach(function (b) {
        b.questions.forEach(function (q) {
          if (q.tipe === 'skala') { q.skala_min = Number(q.skala_min); q.skala_maks = Number(q.skala_maks); }
        });
      });
      const v = await A.call('admin.form.save', { form: model.form, blocks: model.blocks });
      model = v; dirty = false;
      renderEditor();
      loadList();
      A.toast(wasNew ? 'Form dibuat. Pasang di beranda dari daftar form.' : 'Form tersimpan');
      const m = document.querySelector('#formEditor .save-msg');
      if (m) { m.textContent = 'Tersimpan.'; m.classList.add('ok'); }
    } catch (e) {
      if (e.code !== 'AUTH') { msg.textContent = e.message; msg.scrollIntoView({ block: 'center' }); }
    } finally {
      A.setBusy(button, false);
    }
  }

  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  $('formEditor').addEventListener('input', markDirty);
  $('formEditor').addEventListener('change', markDirty);
  $('newForm').addEventListener('click', function () { openEditor(''); });
  A.onTab('forms', function () { if (!model) loadList(); });
})();
