/* SPEGANA — Laporan IKS (iuran sosial & pensiun). Berpassword; data dari sheet bendahara lewat Apps Script. */
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const el = App.el;
  const stage = $('stage');
  const KEY = 'laporan';
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const BLN_PENUH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const state = { dana: 'sosial', q: '', buka: Object.create(null), semuaKeluar: false };
  let last = '';
  let timer = 0;

  const themeBtn = $('themeBtn');
  themeBtn.append(App.svg('moon', 'moon'), App.svg('sun', 'sun'));
  themeBtn.addEventListener('click', App.theme.toggle);
  App.pasangBack('laporan-iks');

  // ── Format ──
  function rp(n) {
    const neg = n < 0;
    return (neg ? '−' : '') + 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');
  }
  function bulanPendek(k, denganTahun) { return BLN[+k.slice(5, 7) - 1] + (denganTahun ? ' ' + k.slice(2, 4) : ''); }
  function bulanPenuh(k) { return BLN_PENUH[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4); }
  function tglPendek(t) { return t ? +t.slice(8, 10) + ' ' + BLN[+t.slice(5, 7) - 1] + ' ' + t.slice(0, 4) : '-'; }

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

  // ── Bagian-bagian halaman ──
  function kpis(x) {
    const box = el('section', 'iks-kpis');
    const t = function (cls, value, label) {
      const k = el('div', 'kpi ' + cls);
      k.append(el('strong', '', value), el('span', '', label));
      box.append(k);
    };
    t('main saldo', rp(x.saldo), 'Saldo kas' + (x.saldo_awal ? ' (termasuk saldo awal ' + rp(x.saldo_awal) + ')' : ''));
    t('', rp(x.total_masuk), 'Pemasukan');
    t('', rp(x.total_keluar), 'Pengeluaran');
    return box;
  }

  function progress(x) {
    const c = el('section', 'card dsec');
    const k = x.bulan[x.acuan];
    c.append(el('h2', '', 'Sudah membayar · ' + (k ? bulanPenuh(k) : '-')));
    const row = el('div', 'iks-prog');
    const big = el('strong', '', x.n_bayar + ' dari ' + x.n_anggota);
    big.append(el('small', '', ' (' + x.persen_bayar + '%)'));
    const track = el('div', 'bar-track'); const fill = el('span', 'bar-fill');
    fill.style.setProperty('--w', Math.max(x.persen_bayar ? 2 : 0, x.persen_bayar) + '%');
    track.append(fill);
    row.append(big, track);
    c.append(row);
    return c;
  }

  function chart(x) {
    const c = el('section', 'card dsec');
    c.append(el('h2', '', 'Pemasukan per bulan'));
    const max = x.per_bulan.reduce(function (m, b) { return Math.max(m, b.masuk); }, 0);
    if (!max) { c.append(el('p', 'hint', 'Belum ada pemasukan tercatat.')); return c; }
    const box = el('div', 'trend');
    const row = el('div', 'trend-cols');
    x.per_bulan.forEach(function (b, i) {
      const col = el('div', 'tcol' + (i === x.acuan ? ' top' : ''));
      col.title = bulanPenuh(b.bln) + ' · ' + rp(b.masuk) + ' · ' + b.n_bayar + ' orang';
      const bar = el('span', 'tbar');
      bar.style.setProperty('--h', (b.masuk / max * 100) + '%');
      col.append(bar); row.append(col);
    });
    box.append(row);
    const ax = el('div', 'trend-ax');
    ax.append(el('span', '', bulanPendek(x.bulan[0], true)), el('span', '', bulanPendek(x.bulan[x.bulan.length - 1], true)));
    box.append(ax);
    c.append(box);
    return c;
  }

  function pengeluaran(x) {
    const c = el('section', 'card dsec');
    c.append(el('h2', '', 'Pengeluaran'));
    if (!x.keluar.length) { c.append(el('p', 'hint', 'Belum ada pengeluaran.')); return c; }
    const list = el('ul', 'iks-out');
    const tampil = state.semuaKeluar ? x.keluar : x.keluar.slice(0, 6);
    tampil.forEach(function (k) {
      const li = el('li');
      const kiri = el('div', 'o-l');
      kiri.append(el('strong', '', k.jenis || 'Pengeluaran'));
      const info = [k.penerima, k.catatan].filter(Boolean).join(' · ');
      if (info) kiri.append(el('span', '', info));
      kiri.append(el('span', 'o-d', tglPendek(k.tgl)));
      li.append(kiri, el('div', 'o-r', rp(k.nominal)));
      list.append(li);
    });
    c.append(list);
    if (x.keluar.length > 6) {
      const b = el('button', 'btn sm', state.semuaKeluar ? 'Ringkas' : 'Tampilkan semua (' + x.keluar.length + ')'); b.type = 'button';
      b.addEventListener('click', function () { state.semuaKeluar = !state.semuaKeluar; draw(); });
      c.append(b);
    }
    return c;
  }

  function perOrang(x) {
    const c = el('section', 'card dsec');
    c.append(el('h2', '', 'Per anggota'));
    const q = el('input', 'input iks-q'); q.type = 'search'; q.placeholder = 'Cari nama…'; q.setAttribute('aria-label', 'Cari nama');
    q.value = state.q;
    const list = el('ul', 'iks-people');
    const draw2 = function () {
      list.replaceChildren();
      const s = state.q.trim().toLowerCase();
      let n = 0;
      x.orang.forEach(function (o) {
        if (s && o.nama.toLowerCase().indexOf(s) < 0) return;
        n++;
        const id = state.dana + '|' + o.nama;
        const li = el('li', 'iks-p' + (state.buka[id] ? ' open' : ''));
        const head = el('button', 'p-head'); head.type = 'button';
        head.setAttribute('aria-expanded', state.buka[id] ? 'true' : 'false');
        const nm = el('div', 'p-name');
        nm.append(el('strong', '', o.nama), el('span', '', o.jabatan || ''));
        const tot = el('div', 'p-tot', rp(o.total));
        head.append(nm, tot);
        const dots = el('div', 'p-dots');
        o.bayar.forEach(function (v, i) {
          const d = el('i', (v > 0 ? 'on' : '') + (i === x.acuan ? ' now' : ''));
          d.title = bulanPenuh(x.bulan[i]) + ' · ' + (v > 0 ? rp(v) : 'belum');
          dots.append(d);
        });
        const det = el('div', 'p-det'); det.hidden = !state.buka[id];
        if (state.buka[id]) {
          const g = el('div', 'p-grid');
          o.bayar.forEach(function (v, i) {
            const cell = el('div', 'pg' + (v > 0 ? ' on' : ''));
            cell.append(el('span', '', bulanPendek(x.bulan[i], true)), el('strong', '', v > 0 ? rp(v) : '—'));
            g.append(cell);
          });
          det.append(g);
        }
        head.addEventListener('click', function () { state.buka[id] = !state.buka[id]; draw2(); });
        li.append(head, dots, det);
        list.append(li);
      });
      if (!n) list.append(el('li', 'iks-none', 'Nama tidak ditemukan.'));
    };
    q.addEventListener('input', function () { state.q = q.value; draw2(); });
    c.append(q, list);
    draw2();
    return c;
  }

  function danaView(x) {
    const f = document.createDocumentFragment();
    if (!x.ok) { f.append(note('Data belum tersedia', x.pesan)); return f; }
    f.append(kpis(x), progress(x), chart(x), pengeluaran(x), perOrang(x));
    return f;
  }

  let data = null;
  function draw() {
    const d = data;
    if (!d) return;
    $('dhead').hidden = false;
    $('dtitle').textContent = 'Laporan IKS';
    const desc = $('ddesc');
    const ref = el('button', 'icon-btn sm iks-reload'); ref.type = 'button';
    ref.setAttribute('aria-label', 'Muat ulang'); ref.append(App.svg('refresh'));
    ref.addEventListener('click', function () { load(false, ref); });
    const stamp = el('div', 'iks-stamp');
    stamp.append(el('span', '', 'Diperbarui ' + d.diperbarui.slice(8, 10) + '/' + d.diperbarui.slice(5, 7) + ' ' + d.diperbarui.slice(11, 16) + '.'), ref);
    desc.replaceChildren(el('div', '', 'Iuran Kesetiakawanan Sosial dan Pensiun.'), stamp);

    const tabs = el('div', 'iks-tabs'); tabs.setAttribute('role', 'tablist');
    [['sosial', 'Sosial'], ['pensiun', 'Pensiun']].forEach(function (t) {
      const b = el('button', 'iks-tab', t[1]); b.type = 'button'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', state.dana === t[0] ? 'true' : 'false');
      b.addEventListener('click', function () { if (state.dana !== t[0]) { state.dana = t[0]; state.q = ''; state.semuaKeluar = false; draw(); } });
      tabs.append(b);
    });
    const frag = document.createDocumentFragment();
    frag.append(tabs, danaView(d[state.dana]));
    stage.replaceChildren(frag);
  }

  // ── Pengambilan data + password ──
  async function fetchIks(first, btn) {
    const quiet = { silent: !first && !btn };
    const pw = App.sandi.get('iks', KEY);
    if (pw) {
      try {
        const r = await App.post({ action: 'iks', sandi: pw }, quiet);
        if (!r.terkunci && !r.belum_dibuka) return r;
      } catch (e) {
        if (e.code !== 'BADPASS') throw e;
        App.sandi.set('iks', KEY, '');
      }
    }
    const d = await App.post({ action: 'iks' }, quiet);
    if (d.belum_dibuka) return d;
    if (!d.terkunci) return d;
    clearInterval(timer);
    if (first) App.splash.hide(300);
    $('dhead').hidden = true;
    const ask = function () {
      App.askPassword({
        title: 'Laporan IKS',
        text: 'Laporan ini dikunci. Masukkan password yang diberikan kepada anggota.',
        submit: async function (p) {
          await App.post({ action: 'iks', sandi: p });
          App.sandi.set('iks', KEY, p);
          load(true);
        }
      });
    };
    const c = note('Laporan IKS', 'Laporan ini hanya untuk anggota. Minta password kepada pengurus.');
    const b = el('button', 'btn btn-primary', 'Masukkan password'); b.type = 'button';
    b.addEventListener('click', ask);
    c.append(b);
    stage.replaceChildren(c);
    last = '';
    if (first) ask();
    return null;
  }

  async function load(first, btn) {
    if (btn) btn.classList.add('is-busy');
    try {
      const d = await fetchIks(first, btn);
      if (!d) return;
      if (d.belum_dibuka) {
        if (first) App.splash.hide(400);
        $('dhead').hidden = true;
        stage.replaceChildren(note('Laporan belum dibuka.', 'Pengurus belum membuka laporan ini. Silakan coba lagi nanti.'));
        return;
      }
      const s = JSON.stringify(d);
      if (s !== last) { last = s; data = d; draw(); }
      if (first) App.splash.hide(1000);
      clearInterval(timer);
      timer = setInterval(function () { if (!document.hidden) load(false); }, 60000);
    } catch (e) {
      if (first) App.splash.hide(400);
      if (!last) {
        $('dhead').hidden = true;
        stage.replaceChildren(note('Laporan belum bisa dimuat.', e.message, true));
      }
    } finally {
      if (btn) btn.classList.remove('is-busy');
    }
  }

  load(true);
})();
