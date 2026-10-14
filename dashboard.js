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
    tile('main', String(d.total), 'responden');
    tile('', String(d.hari_ini || 0), 'hari ini');
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
        sec.append(el('h2', '', b.judul ? label + ' · ' + b.judul : label));
        b.questions.forEach(function (q) { sec.append(C.question(q, false)); });
        frag.append(sec);
      });
    }
    stage.replaceChildren(frag);
  }

  async function load(first, btn) {
    if (!/^[a-z0-9-]{1,60}$/.test(slug)) {
      stage.replaceChildren(note('Dashboard tidak ditemukan.', 'Alamat tidak lengkap atau salah.'));
      App.splash.hide(400);
      return;
    }
    if (btn) btn.classList.add('is-busy');
    try {
      const d = await App.get({ action: 'dashboard', f: slug }, { silent: !first && !btn });
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
