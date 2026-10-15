/* SPEGANA — halaman isi form */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const el = App.el;
  const slug = new URLSearchParams(location.search).get('f') || '';

  const themeBtn = $('themeBtn');
  themeBtn.append(App.svg('moon', 'moon'), App.svg('sun', 'sun'));
  themeBtn.addEventListener('click', App.theme.toggle);
  $('home').append(App.svg('back'), document.createTextNode('Beranda'));

  let def = null;        // {form, blocks, names}
  let pages = [];        // larik larik blok
  let page = 0;
  let furthest = 0;      // untuk navigasi berurutan
  let phase = 'load';    // load | identity | questions | done
  let nama = '';
  let ans = {};          // q_id -> string | array
  let rid = '';
  let busy = false;
  let banner = '';

  const stage = $('stage');

  function clear() { stage.replaceChildren(); }
  function setStage() { clear(); stage.append.apply(stage, arguments); window.scrollTo(0, 0); }

  function msgCard(title, text, retry) {
    const c = el('div', 'card');
    c.append(el('h2', '', title));
    if (text) c.append(el('p', 'hint', text));
    if (retry) {
      const b = el('button', 'btn', 'Coba lagi');
      b.type = 'button';
      b.addEventListener('click', load);
      c.append(b);
    }
    return c;
  }

  // ── Pengacakan tetap per perangkat dan pertanyaan ──
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function shuffled(arr, seedStr) {
    let s = hash(seedStr) || 1;
    const rnd = function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ── Validasi (mengikuti aturan server) ──
  function isEmpty(q) {
    const v = ans[q.id];
    return Array.isArray(v) ? v.length === 0 : v === undefined || v === null || String(v).trim() === '';
  }
  function word() { return (def && def.form && def.form.label_blok) || 'Soal'; }
  function checkQ(q) {
    if (isEmpty(q)) return q.wajib ? word() + ' ini wajib dijawab.' : '';
    if (q.tipe === 'centang') {
      const n = ans[q.id].length;
      if (n < q.min_pilih) return 'Pilih minimal ' + q.min_pilih + '.';
      if (q.maks_pilih > 0 && n > q.maks_pilih) return 'Pilih paling banyak ' + q.maks_pilih + '.';
    }
    return '';
  }
  function checkPage(i) {
    const bad = [];
    pages[i].forEach(function (b) {
      b.questions.forEach(function (q) { const m = checkQ(q); if (m) bad.push({ q: q, m: m }); });
    });
    return bad;
  }
  function pageComplete(i) {
    return pages[i].every(function (b) { return b.questions.every(function (q) { return !checkQ(q) && (!q.wajib || !isEmpty(q)); }); });
  }

  // ── Pembuat input per jenis ──
  function setErr(wrap, msg) {
    const e = wrap.querySelector('.err');
    e.textContent = msg || '';
    wrap.classList.toggle('bad', !!msg);
  }

  function buildQuestion(q) {
    const grouped = q.tipe === 'pilihan' || q.tipe === 'centang' || q.tipe === 'skala';
    const wrap = el(grouped ? 'fieldset' : 'div', 'q');
    wrap.dataset.qid = q.id;
    const lab = el(grouped ? 'legend' : 'label', grouped ? '' : 'qlabel');
    lab.append(document.createTextNode(q.teks));
    if (q.wajib) {
      const r = el('span', 'req', '*');
      r.setAttribute('aria-label', 'wajib');
      lab.append(r);
    }
    wrap.append(lab);
    const uid = 'q_' + q.id;
    const change = function () { setErr(wrap, ''); };
    let body;

    if (q.tipe === 'singkat' || q.tipe === 'tanggal' || q.tipe === 'waktu') {
      body = el('input', 'field');
      body.type = q.tipe === 'singkat' ? 'text' : q.tipe === 'tanggal' ? 'date' : 'time';
      if (q.tipe === 'singkat') body.maxLength = 500;
      body.id = uid; lab.htmlFor = uid;
      body.value = ans[q.id] || '';
      body.addEventListener('input', function () { ans[q.id] = body.value; change(); });
    } else if (q.tipe === 'paragraf') {
      body = el('textarea', 'field');
      body.maxLength = 5000; body.id = uid; lab.htmlFor = uid;
      body.value = ans[q.id] || '';
      body.addEventListener('input', function () { ans[q.id] = body.value; change(); });
    } else if (q.tipe === 'dropdown') {
      body = el('select', 'field');
      body.id = uid; lab.htmlFor = uid;
      const o0 = el('option', '', 'Pilih…'); o0.value = '';
      body.append(o0);
      opts(q).forEach(function (p) { const o = el('option', '', p); o.value = p; body.append(o); });
      body.value = ans[q.id] || '';
      body.addEventListener('change', function () { ans[q.id] = body.value; change(); });
    } else if (q.tipe === 'pilihan') {
      body = el('div', 'opts');
      opts(q).forEach(function (p) {
        const l = el('label', 'opt');
        const r = el('input'); r.type = 'radio'; r.name = uid; r.value = p;
        r.checked = ans[q.id] === p;
        r.addEventListener('change', function () { ans[q.id] = p; change(); });
        l.append(r, el('span', '', p));
        body.append(l);
      });
      if (!q.wajib) {
        const c = el('button', 'clear', 'Hapus pilihan');
        c.type = 'button';
        c.addEventListener('click', function () {
          delete ans[q.id];
          body.querySelectorAll('input').forEach(function (x) { x.checked = false; });
        });
        wrap.append(body, c);
        body = null;
      }
    } else if (q.tipe === 'centang') {
      body = el('div', 'opts');
      const inputs = [];
      const sync = function () {
        const n = (ans[q.id] || []).length;
        inputs.forEach(function (x) { x.disabled = q.maks_pilih > 0 && n >= q.maks_pilih && !x.checked; });
      };
      opts(q).forEach(function (p) {
        const l = el('label', 'opt');
        const c = el('input'); c.type = 'checkbox'; c.value = p;
        c.checked = (ans[q.id] || []).indexOf(p) >= 0;
        c.addEventListener('change', function () {
          const cur = (ans[q.id] || []).filter(function (x) { return x !== p; });
          if (c.checked) cur.push(p);
          ans[q.id] = cur;
          change(); sync();
        });
        inputs.push(c);
        l.append(c, el('span', '', p));
        body.append(l);
      });
      sync();
      if (q.min_pilih > 1 || q.maks_pilih > 0) {
        const t = [];
        if (q.min_pilih > 1) t.push('minimal ' + q.min_pilih);
        if (q.maks_pilih > 0) t.push('maksimal ' + q.maks_pilih);
        wrap.append(el('p', 'hint', 'Pilih ' + t.join(', ') + '.'));
      }
    } else if (q.tipe === 'skala') {
      body = el('div', 'scale');
      for (let n = q.skala.min; n <= q.skala.maks; n++) {
        const l = el('label');
        const r = el('input'); r.type = 'radio'; r.name = uid; r.value = String(n);
        r.checked = String(ans[q.id]) === String(n);
        r.addEventListener('change', function () { ans[q.id] = String(n); change(); });
        l.append(r, el('span', '', String(n)));
        body.append(l);
      }
    }
    if (body) wrap.append(body);
    if (q.tipe === 'skala' && (q.skala.label_min || q.skala.label_maks)) {
      wrap.append(el('div', 'scale-ends'));
      wrap.lastChild.append(el('span', '', q.skala.label_min || ''), el('span', '', q.skala.label_maks || ''));
    }
    wrap.append(el('div', 'err'));
    wrap.querySelector('.err').setAttribute('role', 'alert');
    return wrap;
  }

  function opts(q) {
    return q.acak ? shuffled(q.pilihan, App.deviceId() + q.id) : q.pilihan;
  }

  function buildBlock(b, heading) {
    const sec = el('section', 'card');
    if (heading) sec.append(el('h2', 'block-title', heading));
    if (b.gambar && /^https:/i.test(String(b.gambar).trim())) {
      const fig = el('button', 'block-fig');
      fig.type = 'button';
      fig.setAttribute('aria-label', 'Perbesar gambar');
      fig.append(el('span', 'block-fig-load'));
      const im = App.loadImage(b.gambar, function (ok) {
        im.className = 'block-img';
        fig.replaceChildren(im, el('span', 'block-fig-zoom', 'Ketuk untuk memperbesar'));
        fig.addEventListener('click', function () { App.lightbox(ok.currentSrc || ok.src); });
      }, function () {
        const a = el('a', 'block-fig-fail', 'Gambar tidak dapat dimuat. Ketuk untuk membukanya di tab baru.');
        a.href = App.safeUrl(b.gambar); a.target = '_blank'; a.rel = 'noopener noreferrer';
        fig.replaceWith(a);
      });
      sec.append(fig);
    }
    if (b.teks) {
      const r = el('div', 'rich reading');
      r.append(App.rich(b.teks));
      sec.append(r);
    }
    b.questions.forEach(function (q) { sec.append(buildQuestion(q)); });
    return sec;
  }

  // ── Layar ──
  function showClosed(alasan) {
    const t = {
      belum: ['Form ini belum dibuka.', 'Silakan kembali lagi nanti.'],
      selesai: ['Pengisian sudah berakhir.', 'Waktu pengisian form ini sudah lewat.'],
      penuh: ['Kuota responden sudah penuh.', 'Form ini tidak menerima jawaban baru.']
    }[alasan] || ['Form sedang ditutup.', 'Form ini tidak menerima jawaban saat ini.'];
    setStage(msgCard(t[0], t[1]));
  }

  function showIdentity() {
    phase = 'identity';
    const f = def.form;
    const card = el('section', 'card');
    card.append(el('h2', '', 'Siapa Anda?'));
    const err = el('div', 'banner'); err.hidden = true; err.setAttribute('role', 'alert');
    const go = el('button', 'btn btn-primary', 'Mulai mengisi');
    go.type = 'button';
    const finish = function (n) {
      nama = n;
      furthest = 0; page = 0;
      showQuestions();
    };

    if (f.identitas === 'wajib_nama') {
      card.append(el('p', 'hint', 'Tuliskan nama Anda sesuai yang diminta.'));
      const inp = el('input', 'field'); inp.type = 'text'; inp.maxLength = 100; inp.value = nama;
      inp.setAttribute('aria-label', 'Nama'); inp.autocomplete = 'name';
      card.append(inp, err, el('div', 'nav'));
      const go2 = card.lastChild; go2.style.marginTop = '0.9rem'; go2.append(go);
      go.addEventListener('click', function () {
        if (!inp.value.trim()) { err.textContent = 'Nama wajib diisi.'; err.hidden = false; inp.focus(); return; }
        finish(inp.value.trim());
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });
    } else {
      card.append(el('p', 'hint', f.mode_daftar === 'terbuka'
        ? 'Pilih nama Anda. Jika belum ada di daftar, tambahkan sendiri.'
        : 'Pilih nama Anda dari daftar.'));
      let chosen = nama;
      let own = false;
      const search = el('input', 'field'); search.type = 'search'; search.placeholder = 'Cari nama…';
      search.setAttribute('aria-label', 'Cari nama');
      const list = el('div', 'names');
      let pool = def.names || [];
      let kelasDipilih = '';
      let loading = false;
      const grouped = !!f.dikelompokkan;
      const kelasBar = el('div', 'names');
      kelasBar.style.maxHeight = 'none';
      const ownBox = el('div'); ownBox.hidden = true;
      const ownInp = el('input', 'field'); ownInp.type = 'text'; ownInp.maxLength = 100;
      ownInp.setAttribute('aria-label', 'Nama Anda');
      ownBox.append(ownInp);
      const note = el('div', 'note'); note.hidden = true;

      const draw = function () {
        const q = search.value.trim().toLowerCase();
        list.replaceChildren();
        let shown = 0;
        if (grouped && !kelasDipilih) { return; }
        if (loading) { list.append(el('p', 'hint', 'Memuat daftar nama…')); return; }
        pool.forEach(function (n) {
          if (q && n.nama.toLowerCase().indexOf(q) < 0) return;
          shown++;
          const val = n.label || n.nama;
          const b = el('button', 'name-btn'); b.type = 'button';
          b.append(el('span', '', n.nama));
          b.setAttribute('aria-pressed', String(!own && chosen === val));
          b.addEventListener('click', function () {
            own = false; ownBox.hidden = true; chosen = val;
            note.hidden = true;
            draw();
          });
          list.append(b);
        });
        if (!shown) list.append(el('p', 'hint', grouped ? 'Tidak ada nama tersisa di kelas ini.' : 'Tidak ada nama yang cocok.'));
      };
      search.addEventListener('input', draw);
      if (grouped) {
        card.append(el('p', 'hint', 'Pilih kelas dulu, lalu pilih nama Anda.'));
        const kb = {};
        (def.kelompok || []).forEach(function (k) {
          const b = el('button', 'name-btn', k); b.type = 'button';
          b.setAttribute('aria-pressed', 'false');
          kb[k] = b;
          b.addEventListener('click', async function () {
            kelasDipilih = k; search.hidden = false; chosen = ''; loading = true; err.hidden = true; search.value = '';
            Object.keys(kb).forEach(function (x) { kb[x].setAttribute('aria-pressed', String(x === k)); });
            draw();
            try {
              const pw = App.sandi.get('form', slug);
              const r = pw ? await App.post({ action: 'names', f: slug, k: k, sandi: pw }) : await App.get({ action: 'names', f: slug, k: k });
              if (kelasDipilih !== k) return;
              pool = r.names || [];
            } catch (e) {
              pool = []; err.textContent = e.message || 'Gagal memuat daftar nama.'; err.hidden = false;
            }
            loading = false; draw();
          });
          kelasBar.append(b);
        });
        kelasBar.style.gridTemplateColumns = 'repeat(auto-fill, minmax(5rem, 1fr))';
        card.append(kelasBar);
        pool = [];
      }
      card.append(search, list);
      if (grouped) { search.hidden = true; }
      if (f.mode_daftar === 'terbuka' && !grouped) {
        const add = el('button', 'btn', 'Nama saya belum ada'); add.type = 'button';
        add.addEventListener('click', function () {
          own = true; chosen = ''; ownBox.hidden = false; note.hidden = true; draw(); ownInp.focus();
        });
        card.append(add, ownBox);
      }
      card.append(note, err, el('div', 'nav'));
      const nv = card.lastChild; nv.style.marginTop = '0.9rem'; nv.append(go);
      go.addEventListener('click', function () {
        const n = own ? ownInp.value.trim() : chosen;
        if (!n) { err.textContent = grouped && !kelasDipilih ? 'Pilih kelas dulu.' : own ? 'Tuliskan nama Anda.' : 'Pilih nama Anda dulu.'; err.hidden = false; return; }
        finish(n);
      });
      draw();
    }
    setStage(card);
  }

  function pageHeading(i) {
    const f = def.form;
    const b = pages[i][0];
    const base = (f.label_blok || 'Soal') + ' ' + (i + 1);
    return b && b.judul ? base + ' · ' + b.judul : base;
  }

  function showQuestions() {
    phase = 'questions';
    const f = def.form;
    const frag = document.createDocumentFragment();
    const perBlok = f.mode_tampilan === 'per_blok';
    const total = pages.length;

    if (f.identitas !== 'anonim') {
      const who = el('div', 'stepline');
      const w = el('span', 'who', 'Mengisi sebagai ' + nama + ' ');
      const ch = el('button', '', 'ubah'); ch.type = 'button';
      ch.addEventListener('click', function () { showIdentity(); });
      w.append(document.createTextNode('('), ch, document.createTextNode(')'));
      who.append(w);
      frag.append(who);
    }

    if (banner) {
      const b = el('div', 'banner', banner); b.setAttribute('role', 'alert');
      frag.append(b);
    }

    if (perBlok && total > 1) {
      const line = el('div', 'stepline');
      line.append(el('span', '', (f.label_blok || 'Soal') + ' ' + (page + 1) + ' dari ' + total));
      frag.append(line);
      const pr = el('div', 'progress'); pr.setAttribute('aria-hidden', 'true');
      const bar = el('span'); bar.style.width = (((page + 1) / total) * 100) + '%';
      pr.append(bar); frag.append(pr);
      if (f.navigasi === 'bebas') {
        const chips = el('div', 'chips');
        pages.forEach(function (_, i) {
          const c = el('button', 'chip' + (pageComplete(i) ? ' done' : ''), String(i + 1));
          c.type = 'button';
          c.setAttribute('aria-label', (f.label_blok || 'Soal') + ' ' + (i + 1));
          if (i === page) c.setAttribute('aria-current', 'step');
          c.addEventListener('click', function () { page = i; banner = ''; showQuestions(); });
          chips.append(c);
        });
        frag.append(chips);
      }
    }

    if (perBlok) {
      pages[page].forEach(function (b) { frag.append(buildBlock(b, total > 1 || b.judul ? pageHeading(page) : '')); });
    } else {
      pages.forEach(function (p, i) {
        frag.append(buildBlock(p[0], pages.length > 1 ? pageHeading(i) : (p[0].judul || '')));
      });
    }

    const nav = el('div', 'nav');
    const last = !perBlok || page === total - 1;
    if (perBlok && page > 0) {
      const p = el('button', 'btn', 'Sebelumnya'); p.type = 'button';
      p.addEventListener('click', function () { page--; banner = ''; showQuestions(); });
      nav.append(p);
    } else {
      nav.append(el('span', 'spacer'));
    }
    if (!last) {
      const n = el('button', 'btn btn-primary', 'Berikutnya'); n.type = 'button';
      n.addEventListener('click', function () {
        if (f.navigasi === 'berurutan' && showErrors(page)) return;
        banner = ''; page++; furthest = Math.max(furthest, page); showQuestions();
      });
      nav.append(n);
    } else {
      const s = el('button', 'btn btn-primary', 'Kirim jawaban'); s.type = 'button';
      s.disabled = busy; s.classList.toggle('is-busy', busy);
      s.addEventListener('click', submit);
      nav.append(s);
    }
    frag.append(nav);
    setStage(frag);
    if (!perBlok) window.scrollTo(0, 0);
  }

  // Menandai pertanyaan bermasalah di halaman yang tampil. Mengembalikan true bila ada.
  function showErrors(i) {
    const bad = checkPage(i);
    let first = null;
    bad.forEach(function (x) {
      const w = stage.querySelector('[data-qid="' + x.q.id + '"]');
      if (w) { setErr(w, x.m); if (!first) first = w; }
    });
    if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return bad.length > 0;
  }

  async function submit() {
    if (busy) return;
    const f = def.form;
    // Cari halaman pertama yang bermasalah.
    for (let i = 0; i < pages.length; i++) {
      if (checkPage(i).length) {
        banner = f.mode_tampilan === 'per_blok'
          ? 'Masih ada jawaban wajib yang belum diisi di ' + word() + ' ' + (i + 1) + '.'
          : 'Masih ada ' + word().toLowerCase() + ' yang perlu diperbaiki.';
        if (f.mode_tampilan === 'per_blok') page = i;
        showQuestions();
        if (f.mode_tampilan === 'per_blok') showErrors(i);
        else pages.forEach(function (_, k) { showErrors(k); });
        return;
      }
    }
    // Peringatan sebelum kirim.
    const lines = ['Pastikan semua jawaban sudah sesuai sebelum dikirim.'];
    if (f.identitas !== 'anonim' && nama) lines.push('Dikirim atas nama ' + nama + '.');
    if (f.identitas !== 'anonim') {
      lines.push(f.kuota_per_nama > 1
        ? 'Anda bisa mengirim ulang sampai ' + f.kuota_per_nama + ' kali. Jawaban terakhir yang berlaku.'
        : 'Setelah dikirim, jawaban tidak dapat diubah.');
    }
    const sure = await App.confirm({ title: 'Kirim jawaban?', lines: lines, ok: 'Ya, kirim', cancel: 'Periksa lagi' });
    if (!sure) return;
    busy = true; banner = '';
    showQuestions();
    if (!rid) rid = App.randomId(20);
    const payload = { action: 'submit', form: slug, rid: rid, device: App.deviceId(), nama: nama, answers: ans, sandi: App.sandi.get('form', slug) };
    try {
      const r = await App.post(payload);
      busy = false;
      rid = '';
      showDone(r);
    } catch (e) {
      busy = false;
      if (e.code === 'BADPASS' || e.code === 'NEEDPASS') { // password diganti admin: minta lagi tanpa kehilangan jawaban sebisanya
        App.sandi.set('form', slug, ''); def = null; load(); return;
      }
      if (e.code === 'CLOSED') { showClosed(def.form.status.alasan === 'buka' ? 'ditutup' : def.form.status.alasan); return; }
      if (e.code === 'QUOTA' || e.code === 'DEVICE' || e.code === 'FULL') rid = '';
      banner = e.message || 'Gagal mengirim. Coba lagi.';
      showQuestions();
    }
  }

  function showDone(r) {
    phase = 'done';
    const f = def.form;
    const card = el('section', 'card done');
    const ck = el('div', 'check'); ck.append(App.svg('check'));
    card.append(ck, el('h2', '', 'Jawaban terkirim'));
    const msg = el('div', 'rich');
    msg.append(App.rich(r.pesan || 'Terima kasih, jawaban Anda sudah kami terima.'));
    card.append(msg);
    if (r.diganti) card.append(el('div', 'note', 'Jawaban ini menggantikan jawaban Anda sebelumnya.'));
    if (r.sisa !== null && r.sisa !== undefined) {
      card.append(el('div', 'note', r.sisa > 0
        ? 'Anda masih bisa mengirim ulang ' + r.sisa + ' kali lagi. Jawaban terakhir yang berlaku.'
        : 'Kesempatan mengirim Anda sudah habis.'));
    }
    const act = el('div', 'actions');
    if (r.sisa === null || r.sisa === undefined || r.sisa > 0) {
      const again = el('button', 'btn', 'Kirim jawaban lagi'); again.type = 'button';
      again.addEventListener('click', function () {
        ans = {}; page = 0; furthest = 0; banner = '';
        // Daftar nama perlu dimuat ulang agar status "sudah mengisi" akurat.
        if (f.identitas === 'pilih_daftar') load(); else showQuestions();
      });
      act.append(again);
    }
    const home = el('a', 'btn', 'Kembali ke beranda'); home.href = './';
    act.append(home);
    card.append(act);
    setStage(card);
  }

  function setup() {
    const f = def.form;
    document.title = f.judul;
    $('ftitle').textContent = f.judul;
    const d = $('fdesc'); d.replaceChildren();
    if (f.deskripsi) d.append(App.rich(f.deskripsi));
    $('fdesc').hidden = !f.deskripsi;
    $('fhead').hidden = false;
    pages = def.blocks.map(function (b) { return [b]; });
  }

  // Form berpassword: coba password yang sudah dimasukkan di tab ini, kalau tidak ada/salah minta lewat dialog.
  async function fetchDef() {
    const pw = App.sandi.get('form', slug);
    if (pw) {
      try {
        const d = await App.post({ action: 'form', f: slug, sandi: pw });
        if (!d.terkunci) return d;
      } catch (e) {
        if (e.code !== 'BADPASS') throw e;
        App.sandi.set('form', slug, '');
      }
    }
    const d = await App.get({ action: 'form', f: slug });
    if (!d.terkunci) return d;
    App.splash.hide(300);
    return new Promise(function (resolve) {
      const ask = function () {
        App.askPassword({
          title: d.form.judul,
          text: 'Form ini dikunci. Masukkan password yang diberikan kepada Anda.',
          submit: async function (p) {
            const r = await App.post({ action: 'form', f: slug, sandi: p });
            App.sandi.set('form', slug, p);
            resolve(r);
          }
        });
      };
      const b = el('button', 'btn btn-primary', 'Masukkan password'); b.type = 'button';
      b.addEventListener('click', ask);
      const c = msgCard(d.form.judul, 'Form ini dikunci. Hanya yang diberi password yang bisa mengisi.');
      c.append(b);
      setStage(c);
      ask();
    });
  }

  async function load() {
    const first = !def;
    phase = 'load';
    $('fhead').hidden = true;
    if (!/^[a-z0-9-]{1,60}$/.test(slug)) {
      App.splash.hide(400);
      setStage(msgCard('Form tidak ditemukan.', 'Alamat form tidak lengkap atau salah.'));
      return;
    }
    setStage(el('div', 'skel'));
    try {
      def = await fetchDef();
      if (first) App.splash.hide(1100);
    } catch (e) {
      App.splash.hide(400);
      if (e.code === 'NOTFOUND') setStage(msgCard('Form tidak ditemukan.', 'Form ini tidak ada atau sudah dihapus.'));
      else if (e.code === 'CONFIG') setStage(msgCard('Halaman belum disambungkan.', 'Isi API_URL di config.js.'));
      else setStage(msgCard('Form belum bisa dimuat.', e.message, true));
      return;
    }
    setup();
    if (!def.form.status.buka) { showClosed(def.form.status.alasan); return; }
    if (!def.blocks.length) { setStage(msgCard('Form ini belum berisi ' + word().toLowerCase() + '.', '')); return; }
    if (def.form.identitas === 'anonim') { nama = ''; showQuestions(); }
    else if (nama && def.form.identitas === 'wajib_nama') showQuestions();
    else showIdentity();
  }

  load();
})();
