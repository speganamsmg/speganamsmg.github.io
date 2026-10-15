/* SPEGANA — dashboard publik */
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const el = App.el;
  const slug = new URLSearchParams(location.search).get('f') || '';
  const stage = $('stage');
  let last = '';
  let timer = 0;

  const themeBtn = $('themeBtn');
  themeBtn.append(App.svg('moon', 'moon'), App.svg('sun', 'sun'));
  themeBtn.addEventListener('click', App.theme.toggle);
  $('home').append(App.svg('back'), document.createTextNode('Beranda'));

  function note(title, text, retry) {
    const c = el('div', 'card');
    c.append(el('h2', '', title));
    if (text) c.append(el('p', 'hint', text));
    if (retry) {
      const b = el('button', 'btn', 'Coba lagi'); b.type = 'button';
      b.addEventListener('click', function () { load(false); });
      c.append(b);
    }
    return c;
  }

  function render(d) {
    document.title = 'Hasil: ' + d.form.judul;
    $('dtitle').textContent = d.form.judul;
    const desc = $('ddesc'); desc.replaceChildren();
    if (d.form.deskripsi) desc.append(App.rich(d.form.deskripsi));
    desc.hidden = !d.form.deskripsi;
    $('dhead').hidden = false;

    const frag = document.createDocumentFragment();
    const C = App.charts;
    const word = d.form.label_blok || 'Soal';

    // Angka utama: responden, hari ini, rata-rata skor.
    const skor = [];
    d.blocks.forEach(function (b) { b.questions.forEach(function (q) { if (q.skala && q.skala.rata !== null) skor.push({ v: q.skala.rata, n: q.n, max: q.skala.maks }); }); });
    const kpi = el('section', 'kpis');
    function tile(cls, value, label) {
      const t = el('div', 'kpi ' + cls);
      t.append(el('strong', '', value), el('span', '', label));
      kpi.append(t);
    }
    if (d.dari) {
      // Form dengan daftar nama: "12 dari 55" dan persentase yang sudah mengisi.
      const pct = Math.min(100, Math.round(d.total / d.dari * 100));
      const t1 = el('div', 'kpi main');
      const s1 = el('strong', '', String(d.total));
      s1.append(el('small', '', ' dari ' + d.dari));
      t1.append(s1, el('span', '', 'responden'));
      kpi.append(t1);
      tile('', pct + '%', 'sudah mengisi');
    } else {
      tile('main', String(d.total), 'responden');
      tile('', String(d.hari_ini || 0), 'hari ini');
    }
    if (skor.length) {
      const w = skor.reduce(function (s, x) { return s + x.n; }, 0);
      const avg = w ? skor.reduce(function (s, x) { return s + x.v * x.n; }, 0) / w : 0;
      tile('', C.fmt(Math.round(avg * 10) / 10), 'skor rata-rata');
    }
    frag.append(kpi);

    const trend = d.total ? C.trend(d.seri) : null;
    if (trend) {
      const card = el('section', 'card dsec trendcard');
      const top = el('div', 'trendtop');
      const ref = el('button', 'icon-btn sm'); ref.type = 'button';
      ref.setAttribute('aria-label', 'Perbarui'); ref.append(App.svg('refresh'));
      ref.addEventListener('click', function () { load(false, ref); });
      const stamp = el('span', 'stamp', d.terakhir ? 'Terakhir ' + d.terakhir.slice(8, 10) + '/' + d.terakhir.slice(5, 7) + ' ' + d.terakhir.slice(11, 16) : '');
      top.append(stamp, ref);
      card.append(top, trend);
      frag.append(card);
    } else {
      const ref = el('button', 'icon-btn sm refresh-solo'); ref.type = 'button';
      ref.setAttribute('aria-label', 'Perbarui'); ref.append(App.svg('refresh'));
      ref.addEventListener('click', function () { load(false, ref); });
      frag.append(ref);
    }

    if (Array.isArray(d.kelas) && d.kelas.length) {
      const kc = el('section', 'card dsec');
      kc.append(el('h2', '', 'Partisipasi per kelas'));
      const wrap = el('div', 'bars rank');
      d.kelas.forEach(function (k) {
        const p = k.dari ? (k.n / k.dari) * 100 : 0;
        const row = el('div', 'bar-row');
        const head = el('div', 'bar-head');
        head.append(el('span', 'bar-label', k.k), el('span', 'bar-val', k.n + ' / ' + k.dari + ' · ' + Math.round(p) + '%'));
        const track = el('div', 'bar-track'); const fill = el('span', 'bar-fill');
        fill.style.setProperty('--w', Math.max(1, p) + '%'); track.append(fill);
        row.append(head, track); wrap.append(row);
      });
      kc.append(wrap);
      frag.append(kc);
    }

    if (!d.blocks.length) {
      frag.append(note('Belum ada hasil yang ditampilkan.', word + ' belum dipilih untuk tampil di dashboard.'));
    } else if (!d.total) {
      frag.append(note('Belum ada jawaban.', 'Hasil akan muncul di sini setelah ada yang mengisi.'));
    } else {
      const ov = C.overview(d.blocks, word);
      if (ov) frag.append(ov);
      const rk = C.ranking(d.blocks, word);
      if (rk) frag.append(rk);
      d.blocks.forEach(function (b) {
        const sec = el('section', 'card dsec');
        const label = word + ' ' + b.no;
        const title = b.judul ? label + ' · ' + b.judul : label;
        if (b.teks) {
          const head = el('div', 'dsec-head');
          const rb = el('button', 'read-btn'); rb.type = 'button';
          rb.setAttribute('aria-label', 'Baca ketentuan: ' + title); rb.title = 'Baca ketentuan';
          rb.append(App.svg('book'), el('span', '', 'Baca'));
          rb.addEventListener('click', function () { App.readDialog({ title: title, text: b.teks }); });
          head.append(el('h2', '', title), rb);
          sec.append(head);
        } else sec.append(el('h2', '', title));
        b.questions.forEach(function (q) { sec.append(C.question(q, false)); });
        frag.append(sec);
      });
    }
    stage.replaceChildren(frag);
  }

  // Dashboard berpassword: pakai password yang sudah dimasukkan di tab ini, atau minta lewat dialog (hanya saat pertama dibuka).
  async function fetchDash(first, btn) {
    const quiet = { silent: !first && !btn };
    const pw = App.sandi.get('dashboard', slug);
    if (pw) {
      try {
        const r = await App.post({ action: 'dashboard', f: slug, sandi: pw }, quiet);
        if (!r.terkunci) return r;
      } catch (e) {
        if (e.code !== 'BADPASS') throw e;
        App.sandi.set('dashboard', slug, '');
      }
    }
    const d = await App.get({ action: 'dashboard', f: slug }, quiet);
    if (!d.terkunci) return d;
    clearInterval(timer);
    if (first) App.splash.hide(300);
    $('dhead').hidden = true;
    const ask = function () {
      App.askPassword({
        title: d.form.judul,
        text: 'Dashboard ini dikunci. Masukkan password yang diberikan kepada Anda.',
        submit: async function (p) {
          const r = await App.post({ action: 'dashboard', f: slug, sandi: p });
          App.sandi.set('dashboard', slug, p);
          load(true);
        }
      });
    };
    const c = note(d.form.judul, 'Dashboard ini dikunci. Hanya yang diberi password yang bisa melihat hasilnya.');
    const b = el('button', 'btn btn-primary', 'Masukkan password'); b.type = 'button';
    b.addEventListener('click', ask);
    c.append(b);
    stage.replaceChildren(c);
    last = '';
    if (first) ask();
    return null;
  }

  async function load(first, btn) {
    if (!/^[a-z0-9-]{1,60}$/.test(slug)) {
      stage.replaceChildren(note('Dashboard tidak ditemukan.', 'Alamat tidak lengkap atau salah.'));
      App.splash.hide(400);
      return;
    }
    if (btn) btn.classList.add('is-busy');
    try {
      const d = await fetchDash(first, btn);
      if (!d) return; // masih terkunci, menunggu password
      const s = JSON.stringify(d);
      if (s !== last) { last = s; render(d); }
      if (first) App.splash.hide(1000);
      clearInterval(timer);
      timer = setInterval(function () { if (!document.hidden) load(false); }, 45000);
    } catch (e) {
      if (first) App.splash.hide(400);
      if (!last) {
        $('dhead').hidden = true;
        stage.replaceChildren(e.code === 'NOTFOUND'
          ? note('Dashboard belum dibuka.', 'Hasil form ini belum ditampilkan untuk umum.')
          : note('Hasil belum bisa dimuat.', e.message, true));
      }
    } finally {
      if (btn) btn.classList.remove('is-busy');
    }
  }

  load(true);
})();
