/* SPEGANA — grafik hasil form (dipakai dashboard publik dan panel admin).
   Bentuk: donat, batang, tumpuk 100%, histogram + meter, tren per hari. Teks sengaja sedikit. */
(function () {
  'use strict';
  const el = App.el;
  const NS = 'http://www.w3.org/2000/svg';
  const MAX_SLICES = 4; // warna kategori yang aman dibedakan
  const MAX_STACK = 6;  // tumpuk 100% dengan banyak opsi memakai satu warna bertingkat

  function pct(a, b) { return b ? Math.round((a / b) * 1000) / 10 : 0; }
  function fmt(n) { return String(n).replace('.', ','); }
  function svg(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function tip(node, text) { node.setAttribute('data-tip', text); return node; }
  function color(i, ramp, tn) {
    if (tn) return 'var(--s' + tn[i] + ')';
    return ramp ? 'var(--r' + (i + 1) + ')' : 'var(--c' + ((i % MAX_SLICES) + 1) + ')';
  }

  // ── Warna bermakna: Ya/Setuju/Relevan = hijau … Tidak/Hapus = merah (dibaca dari teks opsi) ──
  const POS_RE = /\b(ya|setuju|sangat|sesuai|relevan|baik|puas|benar|cocok|paham|memahami|jelas|bagus|mendukung|terima|menerima|lengkap|tepat|layak)\b/;
  function tone(label) {
    const n = String(label).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (/\btidak (memahami|paham|tahu|yakin|mengerti)\b|\b(netral|abstain|lainnya|entah)\b/.test(n)) return 0;
    if (/^tidak\b|^belum\b|\bsangat tidak\b|\bhapus|\btolak|\bburuk\b|\bsalah\b|\bkurang (baik|setuju|sesuai)\b/.test(n)) return 1;
    if (POS_RE.test(n) && /\b(tetapi|tapi|namun|dengan catatan|sedikit|asal)\b/.test(n)) return 4;
    if (/\b(revisi|direvisi|diubah|ubah|ditambah|ditambahkan|diperjelas|disempurnakan|penyempurnaan|perbaikan|diperbaiki|perlu|kurang)\b/.test(n)) return 2;
    if (/\b(cukup|sedang|ragu|biasa|sebagian|kadang|mungkin)\b/.test(n)) return 3;
    if (POS_RE.test(n)) return 5;
    return null;
  }
  // Tingkat 0–5 per opsi bila pilihannya memang berbau setuju/tidak; selain itu null (pakai warna biasa).
  function tones(opsi) {
    const t = opsi.map(function (o) { return tone(o.label); });
    const known = t.filter(function (x) { return x !== null; });
    if (known.length < Math.max(2, Math.ceil(t.length * 0.6))) return null;
    if (!known.some(function (x) { return x >= 4; }) || !known.some(function (x) { return x === 1 || x === 2; })) return null;
    return t.map(function (x) { return x === null ? 0 : x; });
  }

  // ── Tooltip (satu untuk seluruh halaman; sentuh = ketuk) ──
  let tipEl = null;
  function tipNode() {
    if (!tipEl) { tipEl = el('div', 'viz-tip'); tipEl.setAttribute('role', 'tooltip'); document.body.append(tipEl); }
    return tipEl;
  }
  function showTip(target, x, y) {
    const t = tipNode();
    t.textContent = target.getAttribute('data-tip');
    t.classList.add('on');
    const w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
    t.style.top = Math.max(8, y - h - 14) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.classList.remove('on'); }
  document.addEventListener('pointermove', function (e) {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t && e.pointerType === 'mouse') showTip(t, e.clientX, e.clientY); else if (e.pointerType === 'mouse') hideTip();
  });
  document.addEventListener('pointerdown', function (e) {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) showTip(t, e.clientX, e.clientY); else hideTip();
  });
  window.addEventListener('scroll', hideTip, { passive: true });

  // ── Legenda ──
  function legend(items, total, ramp, tn) {
    const ul = el('ul', 'legend');
    items.forEach(function (o, i) {
      const li = el('li');
      const dot = el('span', 'dot'); dot.style.background = color(i, ramp, tn);
      li.append(dot, el('span', 'lg-label', o.label), el('b', '', fmt(pct(o.jumlah, total)) + '%'));
      ul.append(li);
    });
    return ul;
  }

  // ── Donat ──
  function donut(q) {
    const tn = tones(q.opsi);
    const total = q.opsi.reduce(function (s, o) { return s + o.jumlah; }, 0);
    const wrap = el('div', 'donut-wrap');
    const s = svg('svg', { viewBox: '0 0 120 120', class: 'donut', role: 'img', 'aria-label': q.teks });
    s.append(svg('circle', { cx: 60, cy: 60, r: 46, fill: 'none', 'stroke-width': 13, class: 'donut-track' }));
    let start = 0;
    let lead = null;
    q.opsi.forEach(function (o, i) {
      if (!o.jumlah) return;
      if (!lead || o.jumlah > lead.o.jumlah) lead = { o: o, i: i };
      const len = (o.jumlah / total) * 100;
      const gap = len >= 100 ? 0 : 0.8;
      const seg = svg('circle', {
        cx: 60, cy: 60, r: 46, fill: 'none', 'stroke-width': 13, pathLength: 100, class: 'donut-seg',
        'stroke-dasharray': Math.max(0.2, len - gap) + ' ' + (100 - Math.max(0.2, len - gap)),
        'stroke-dashoffset': -start, transform: 'rotate(-90 60 60)', stroke: color(i, false, tn)
      });
      seg.style.setProperty('--d', (i * 90) + 'ms');
      tip(seg, o.label + ' · ' + o.jumlah + ' (' + fmt(pct(o.jumlah, total)) + '%)');
      s.append(seg);
      start += len;
    });
    wrap.append(s);
    const mid = el('div', 'donut-mid');
    mid.append(el('strong', '', lead ? fmt(Math.round(pct(lead.o.jumlah, total))) + '%' : '–'));
    wrap.append(mid);
    const box = el('div', 'donut-box');
    box.append(wrap, legend(q.opsi, total, false, tn));
    return box;
  }

  // ── Batang mendatar ──
  function bars(q, tn) {
    const wrap = el('div', 'bars');
    const max = q.opsi.reduce(function (m, o) { return Math.max(m, o.jumlah); }, 0);
    q.opsi.forEach(function (o, oi) {
      const p = pct(o.jumlah, q.n);
      const row = el('div', 'bar-row' + (max > 0 && o.jumlah === max ? ' top' : ''));
      const head = el('div', 'bar-head');
      head.append(el('span', 'bar-label', o.label), el('span', 'bar-val', o.jumlah + ' · ' + fmt(p) + '%'));
      const track = el('div', 'bar-track');
      const fill = el('span', 'bar-fill');
      fill.style.setProperty('--w', p + '%');
      if (tn) fill.style.background = 'var(--s' + tn[oi] + ')';
      track.append(fill);
      tip(row, o.label + ' · ' + o.jumlah + ' (' + fmt(p) + '%)');
      row.append(head, track);
      wrap.append(row);
    });
    return wrap;
  }

  // ── Meter setengah lingkaran + histogram ──
  function gauge(s) {
    const frac = s.rata === null ? 0 : (s.rata - s.min) / (s.maks - s.min);
    const box = el('div', 'gauge');
    const g = svg('svg', { viewBox: '0 0 100 58', role: 'img', 'aria-label': 'Rata-rata ' + (s.rata === null ? '' : fmt(s.rata)) });
    g.append(svg('path', { d: 'M10 50 A40 40 0 0 1 90 50', pathLength: 100, class: 'g-track', fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round' }));
    const f = svg('path', { d: 'M10 50 A40 40 0 0 1 90 50', pathLength: 100, class: 'g-fill', fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round' });
    f.style.setProperty('--v', Math.max(0.5, Math.min(100, frac * 100)));
    g.append(f);
    box.append(g);
    const c = el('div', 'g-mid');
    c.append(el('strong', '', s.rata === null ? '–' : fmt(s.rata)), el('small', '', '/ ' + s.maks));
    box.append(c);
    return box;
  }

  function scale(q) {
    const s = q.skala;
    const wrap = el('div', 'scale-chart');
    wrap.append(gauge(s));
    const hist = el('div', 'hist');
    const max = s.dist.reduce(function (m, d) { return Math.max(m, d.jumlah); }, 0);
    const cols = el('div', 'cols');
    s.dist.forEach(function (d) {
      const c = el('div', 'col' + (max > 0 && d.jumlah === max ? ' top' : ''));
      const bar = el('span', 'col-bar');
      bar.style.setProperty('--h', (max ? (d.jumlah / max) * 100 : 0) + '%');
      const track = el('span', 'col-track');
      track.append(bar);
      tip(c, 'Nilai ' + d.nilai + ' · ' + d.jumlah + ' (' + fmt(pct(d.jumlah, q.n)) + '%)');
      c.append(el('span', 'col-n', d.jumlah ? String(d.jumlah) : ''), track, el('span', 'col-lab', String(d.nilai)));
      cols.append(c);
    });
    hist.append(cols);
    if (s.label_min || s.label_maks) {
      const ends = el('div', 'scale-ends');
      ends.append(el('span', '', s.label_min || ''), el('span', '', s.label_maks || ''));
      hist.append(ends);
    }
    wrap.append(hist);
    return wrap;
  }

  // ── Jawaban teks: kartu geser kiri/kanan (swipe, panah, atau tombol) ──
  function texts(q, admin) {
    const list = q.jawaban || [];
    const box = el('div', 'qa');
    if (!list.length) return box;
    box.setAttribute('role', 'group'); box.setAttribute('aria-roledescription', 'carousel'); box.setAttribute('aria-label', 'Jawaban: ' + q.teks);
    const track = el('div', 'qa-track'); track.tabIndex = 0;
    list.forEach(function (j, i) {
      const c = el('figure', 'qa-card');
      c.append(el('blockquote', '', j.isi));
      if (admin && j.nama) c.append(el('figcaption', '', j.nama));
      track.append(c);
    });
    const bar = el('div', 'qa-bar');
    const prev = el('button', 'qa-btn'); prev.type = 'button'; prev.setAttribute('aria-label', 'Jawaban sebelumnya'); prev.append(App.svg('chevleft'));
    const next = el('button', 'qa-btn'); next.type = 'button'; next.setAttribute('aria-label', 'Jawaban berikutnya'); next.append(App.svg('chevright'));
    const pos = el('span', 'qa-pos');
    bar.append(prev, pos, next);
    function idx() { return Math.max(0, Math.min(list.length - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth)))); }
    function sync() { const i = idx(); pos.textContent = (i + 1) + ' / ' + list.length; prev.disabled = i === 0; next.disabled = i === list.length - 1; }
    function go(d) { track.scrollTo({ left: (idx() + d) * track.clientWidth, behavior: 'smooth' }); }
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(sync); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    box.append(track, bar);
    sync();
    return box;
  }

  // ── Tabel (pengganti grafik, untuk keterbacaan) ──
  function tableOf(q) {
    const t = el('table', 'mini');
    const rows = [];
    if (q.opsi) q.opsi.forEach(function (o) { rows.push([o.label, o.jumlah, fmt(pct(o.jumlah, q.n)) + '%']); });
    else if (q.kelompok) q.kelompok.forEach(function (o) { rows.push([o.nama, o.jumlah, fmt(pct(o.jumlah, q.n)) + '%']); });
    else if (q.skala) q.skala.dist.forEach(function (d) { rows.push(['Nilai ' + d.nilai, d.jumlah, fmt(pct(d.jumlah, q.n)) + '%']); });
    rows.forEach(function (r) {
      const tr = el('tr');
      r.forEach(function (c, i) { tr.append(el(i ? 'td' : 'th', i ? 'num' : '', String(c))); });
      t.append(tr);
    });
    return t;
  }

  // q: satu pertanyaan hasil ringkasan dari server. admin = tampilkan isi jawaban teks.
  function question(q, admin) {
    const card = el('section', 'qres');
    const head = el('div', 'qhead');
    const title = el('h3', 'qtitle', q.teks);
    title.addEventListener('click', function () { title.classList.toggle('open'); });
    head.append(title, el('span', 'qn', String(q.n)));
    card.append(head);

    if (admin && (q.disembunyikan || q.tampil_dashboard === false)) {
      const tags = [];
      if (q.disembunyikan) tags.push('disembunyikan dari form');
      if (q.tampil_dashboard === false) tags.push('tidak tampil di dashboard publik');
      card.append(el('p', 'tagline', tags.join(' · ')));
    }

    const body = el('div', 'qbody');
    let hasTable = false;
    if (!q.n) {
      body.append(el('p', 'none', 'Belum ada jawaban.'));
    } else if (q.opsi) {
      const donutOk = q.tipe !== 'centang' && q.opsi.length >= 2 && q.opsi.length <= MAX_SLICES;
      body.append(donutOk ? donut(q) : bars(q, tones(q.opsi)));
      if (q.tipe === 'centang') body.append(el('p', 'tagline', 'bisa lebih dari satu'));
      hasTable = true;
    } else if (q.skala) {
      body.append(scale(q));
      hasTable = true;
    } else if (q.kelompok) {
      const view = { teks: q.teks, n: q.n, opsi: q.kelompok.map(function (k) { return { label: k.nama, jumlah: k.jumlah }; }) };
      body.append(bars(view));
      body.append(el('p', 'tagline', q.otomatis ? 'kata yang sering muncul · jawaban bisa masuk lebih dari satu' : 'jawaban dikelompokkan · bisa masuk lebih dari satu'));
      hasTable = true;
      if (admin && q.kata && q.kata.length) {
        body.append(el('p', 'tagline', 'Saran kata kunci: ' + q.kata.slice(0, 12).map(function (k) { return k.kata + ' (' + k.jumlah + ')'; }).join(', ')));
      }
      if (q.jawaban && q.jawaban.length) body.append(texts(q, admin));
    } else if (q.jawaban) {
      body.append(texts(q, admin));
    } else {
      body.append(el('p', 'none', 'Isi jawaban tidak ditampilkan di halaman publik.'));
    }
    card.append(body);

    if (hasTable) {
      const tb = el('button', 'qtog'); tb.type = 'button';
      tb.setAttribute('aria-label', 'Lihat sebagai tabel'); tb.append(App.svg('sheet'));
      let table = null;
      tb.addEventListener('click', function () {
        if (!table) { table = tableOf(q); table.hidden = true; card.append(table); }
        const showTable = table.hidden;
        table.hidden = !showTable; body.hidden = showTable;
        tb.classList.toggle('on', showTable);
        tb.setAttribute('aria-label', showTable ? 'Lihat sebagai grafik' : 'Lihat sebagai tabel');
      });
      head.append(tb);
    }
    return card;
  }

  // ── Tumpuk 100% lintas blok: soal dengan pilihan yang sama dibandingkan sekaligus ──
  function overview(blocks, labelBlok) {
    const groups = {};
    blocks.forEach(function (b) {
      b.questions.forEach(function (q) {
        if (!q.opsi || q.tipe === 'centang' || !q.n || q.opsi.length < 2 || q.opsi.length > MAX_STACK) return;
        const sig = q.opsi.map(function (o) { return o.label; }).join('\u0001');
        (groups[sig] = groups[sig] || []).push({ label: labelBlok + ' ' + b.no, q: q });
      });
    });
    const list = Object.keys(groups).map(function (k) { return groups[k]; })
      .filter(function (g) { return g.length >= 2; })
      .sort(function (x, y) { return y.length - x.length; }).slice(0, 4);
    if (!list.length) return null;

    const card = el('section', 'card dsec ov');
    list.forEach(function (best) {
      const sec = el('div', 'ov-sec');
      const opsi = best[0].q.opsi;
      const tn = tones(opsi);
      const ramp = !tn && opsi.length > MAX_SLICES;
      if (list.length > 1) sec.append(el('h3', 'ov-title', best[0].q.teks));
      const lg = legend(opsi.map(function (o) { return { label: o.label, jumlah: 0 }; }), 1, ramp, tn);
      lg.querySelectorAll('b').forEach(function (n) { n.remove(); });
      sec.append(lg);
      const rows = el('div', 'stack-list');
      best.forEach(function (r) {
        const total = r.q.opsi.reduce(function (s, o) { return s + o.jumlah; }, 0);
        const row = el('div', 'stack-row');
        row.append(el('span', 'stack-lab', r.label));
        const track = el('div', 'stack-track');
        r.q.opsi.forEach(function (o, i) {
          if (!o.jumlah) return;
          const p = pct(o.jumlah, total);
          const seg = el('span', 'seg' + (tn ? ' sem t' + tn[i] : ramp ? ' rk' + i : ''), p >= 14 ? Math.round(p) + '%' : '');
          seg.style.flexGrow = String(o.jumlah);
          seg.style.background = color(i, ramp, tn);
          tip(seg, r.label + ' · ' + o.label + ' · ' + o.jumlah + ' (' + fmt(p) + '%)');
          track.append(seg);
        });
        row.append(track);
        rows.append(row);
      });
      sec.append(rows);
      card.append(sec);
    });
    return card;
  }

  // Peringkat nilai rata-rata untuk soal berskala (bila ada dua atau lebih).
  function ranking(blocks, labelBlok) {
    const rows = [];
    blocks.forEach(function (b) {
      b.questions.forEach(function (q) {
        if (q.skala && q.skala.rata !== null) rows.push({ label: labelBlok + ' ' + b.no, v: q.skala.rata, min: q.skala.min, max: q.skala.maks, teks: q.teks });
      });
    });
    if (rows.length < 2) return null;
    const card = el('section', 'card dsec');
    const wrap = el('div', 'bars rank');
    rows.forEach(function (r) {
      const p = ((r.v - r.min) / (r.max - r.min)) * 100;
      const row = el('div', 'bar-row');
      const head = el('div', 'bar-head');
      head.append(el('span', 'bar-label', r.label), el('span', 'bar-val', fmt(r.v) + ' / ' + r.max));
      const track = el('div', 'bar-track'); const fill = el('span', 'bar-fill');
      fill.style.setProperty('--w', Math.max(1, p) + '%'); track.append(fill);
      tip(row, r.teks + ' · ' + fmt(r.v));
      row.append(head, track); wrap.append(row);
    });
    card.append(wrap);
    return card;
  }

  // ── Tren: jumlah jawaban masuk per hari (atau per jam) ──
  function trend(seri) {
    const pts = (seri && seri.titik) || [];
    if (!pts.length) return null;
    const perJam = seri.granul === 'jam';
    const map = {};
    pts.forEach(function (p) { map[p.t] = p.n; });
    const parse = function (t) { return perJam ? Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10), +t.slice(11, 13)) : Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)); };
    const step = perJam ? 3600000 : 86400000;
    const key = function (ms) {
      const d = new Date(ms); const p = function (n) { return String(n).padStart(2, '0'); };
      const day = d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
      return perJam ? day + ' ' + p(d.getUTCHours()) : day;
    };
    const t0 = parse(pts[0].t), t1 = parse(pts[pts.length - 1].t);
    const from = Math.max(t0, t1 - 44 * step);
    const cols = [];
    for (let ms = from; ms <= t1; ms += step) cols.push({ k: key(ms), n: map[key(ms)] || 0 });
    const max = cols.reduce(function (m, c) { return Math.max(m, c.n); }, 0);
    const label = function (k) { return perJam ? k.slice(11, 13) + '.00' : k.slice(8, 10) + '/' + k.slice(5, 7); };

    if (cols.length < 2) return null;
    const box = el('div', 'trend');
    const row = el('div', 'trend-cols');
    cols.forEach(function (c) {
      const col = el('div', 'tcol' + (c.n && c.n === max ? ' top' : ''));
      const bar = el('span', 'tbar');
      bar.style.setProperty('--h', (max ? (c.n / max) * 100 : 0) + '%');
      tip(col, label(c.k) + ' · ' + c.n);
      col.append(bar);
      row.append(col);
    });
    box.append(row);
    const ax = el('div', 'trend-ax');
    ax.append(el('span', '', label(cols[0].k)), el('span', '', label(cols[cols.length - 1].k)));
    box.append(ax);
    return box;
  }

  App.charts = { question: question, overview: overview, ranking: ranking, trend: trend, fmt: fmt };
})();
