/* SPEGANA — Laporan IKS (iuran sosial & pensiun). Berpassword; data dari sheet bendahara lewat Apps Script. */
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const el = App.el;
  const stage = $('stage');
  const KEY = 'laporan';
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const BLN_PENUH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const state = { tab: 'sosial', q: '', bln: '', reset: false };
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
  // Tabel iuran seperti spreadsheet: NAMA | bulan… | JUMLAH. Kolom nama dan judul bulan tetap terlihat saat digulir.
  // Bulan setelah bulan berjalan tidak ditampilkan. Bila semua bulan lebih baru dari hari ini, bulan pertama tetap tampil.
  function bulanTampil(daftar, bulanIni) {
    const v = daftar.filter(function (b) { return b <= bulanIni; });
    return v.length ? v : daftar.slice(0, 1);
  }

  function angka(n) { return n > 0 ? Math.round(n).toLocaleString('id-ID') : ''; }

  // Daftar bulan untuk picker (gabungan sosial dan pensiun, sampai bulan berjalan).
  function bulanGabungan(d) {
    const set = {};
    ['sosial', 'pensiun'].forEach(function (j) { if (d[j].ok) d[j].bulan.forEach(function (b) { set[b] = 1; }); });
    return bulanTampil(Object.keys(set).sort(), d.bulan_ini);
  }

  // Bulan terpilih dipakai bersama oleh ketiga tab; bawaannya bulan berjalan.
  function pastikanBulan(d) {
    const daftar = bulanGabungan(d);
    if (daftar.length && daftar.indexOf(state.bln) < 0) {
      state.bln = daftar.indexOf(d.bulan_ini) >= 0 ? d.bulan_ini : daftar[daftar.length - 1];
    }
    return daftar;
  }

  function pilihBulan(daftar) {
    const sel = el('select', 'input iks-bln'); sel.setAttribute('aria-label', 'Pilih bulan');
    daftar.forEach(function (bk) { const o = el('option', '', bulanPenuh(bk)); o.value = bk; if (bk === state.bln) o.selected = true; sel.append(o); });
    sel.addEventListener('change', function () { state.bln = sel.value; state.q = ''; state.reset = true; draw(); });
    return sel;
  }

  // Tabel iuran satu bulan: NAMA | IURAN. Yang belum membayar diberi warna merah muda.
  function tabel(x, daftar) {
    const c = el('section', 'card dsec iks-sheetcard');
    c.append(pilihBulan(daftar));
    const i = x.bulan.indexOf(state.bln);
    if (i < 0) { c.append(el('p', 'hint', 'Bulan ini belum ada di sheet iuran.')); return c; }
    // Rapel: bulan yang dilunasi lewat pembayaran di bulan lain (keterangan "Rapel Sep 26, Okt 26") dihitung sudah membayar.
    const rapelDi = function (o) { return (o.rapel && o.rapel[i]) || ''; };
    const nBayar = x.orang.filter(function (o) { return o.bayar[i] > 0 || rapelDi(o); }).length;
    const nRapel = x.orang.filter(function (o) { return rapelDi(o); }).length;
    c.append(el('p', 'hint iks-ring', nBayar + ' dari ' + x.orang.length + ' sudah membayar · ' + bulanPenuh(state.bln) + (nRapel ? ' · ' + nRapel + ' lewat rapel' : '')));
    const q = el('input', 'input iks-q'); q.type = 'search'; q.placeholder = 'Cari nama…'; q.setAttribute('aria-label', 'Cari nama');
    q.value = state.q;
    const box = el('div', 'iks-sheet'); box.tabIndex = 0; box.setAttribute('role', 'region'); box.setAttribute('aria-label', 'Tabel iuran per anggota');
    const t = el('table', 'iks-tbl');
    const hd = el('thead'); const hr = el('tr');
    hr.append(el('th', 'c-nama', 'Nama'), el('th', 'c-num', 'Iuran'));
    hd.append(hr); t.append(hd);

    const body = el('tbody');
    const ft = el('tfoot');
    const gambarBaris = function () {
      body.replaceChildren(); ft.replaceChildren();
      const s = state.q.trim().toLowerCase();
      let n = 0, jml = 0;
      x.orang.forEach(function (o) {
        if (s && o.nama.toLowerCase().indexOf(s) < 0) return;
        n++;
        const v = o.bayar[i];
        jml += v;
        const rd = rapelDi(o);
        const ket = (o.ket && o.ket[i]) || '';
        const tr = el('tr', rd ? 'rapel' : (v > 0 ? '' : 'belum'));
        const td = el('td', 'c-num' + (v > 0 || rd ? '' : ' kosong'));
        if (v > 0) td.append(el('span', 'iks-v', angka(v)));
        else if (rd && rd !== state.bln) td.append(el('span', 'iks-v iks-rapel', 'Rapel ' + bulanPendek(rd, true)));   // dibayar di bulan lain
        else if (rd) td.append(el('span', 'iks-v', '–'));
        else td.append(el('span', 'iks-v', 'Belum'));
        if (v > 0 && rd && rd !== state.bln) td.append(el('span', 'iks-note', 'Rapel ' + bulanPendek(rd, true)));
        if (ket) td.append(el('span', 'iks-note', ket));
        tr.append(el('th', 'c-nama', o.nama), td);
        body.append(tr);
      });
      if (!n) {
        const tr = el('tr'); const td = el('td', 'iks-none', 'Nama tidak ditemukan.'); td.colSpan = 2; tr.append(td); body.append(tr);
        return;
      }
      const fr = el('tr');
      fr.append(el('th', 'c-nama', s ? 'Jumlah (hasil cari)' : 'Jumlah'), el('td', 'c-num', angka(jml) || '–'));
      ft.append(fr);
    };
    t.append(body, ft);
    box.append(t);
    q.addEventListener('input', function () { state.q = q.value; gambarBaris(); });
    c.append(q, box);
    gambarBaris();
    return c;
  }

  function tabelView(x, daftar) {
    const f = document.createDocumentFragment();
    if (!x.ok) { f.append(note('Data belum tersedia', x.pesan)); return f; }
    if (!x.bulan.length || !x.orang.length) { f.append(note('Belum ada data iuran', 'Daftar anggota atau judul bulan belum diisi.')); return f; }
    f.append(tabel(x, daftar));
    return f;
  }

  // ── Rincian keuangan: total kas + pemasukan/pengeluaran per bulan terpilih ──
  function rincianDana(x, nama, bln) {
    const c = el('section', 'card dsec');
    c.append(el('h2', '', nama));
    if (!x.ok) { c.append(el('p', 'hint', x.pesan)); return c; }
    const i = x.bulan.indexOf(bln);
    const pb = i >= 0 ? x.per_bulan[i] : { masuk: 0, keluar: 0, n_bayar: 0 };
    const grid = el('div', 'iks-kpis');
    const t = function (value, label) {
      const kp = el('div', 'kpi'); kp.append(el('strong', '', value), el('span', '', label)); grid.append(kp);
    };
    t(rp(pb.masuk), 'Pemasukan');
    t(rp(pb.keluar), 'Pengeluaran');
    c.append(grid);
    const sel = pb.masuk - pb.keluar;
    c.append(el('p', 'hint iks-sel', 'Selisih bulan ini ' + (sel > 0 ? '+' : '') + rp(sel) + (i >= 0 ? ' · ' + pb.n_bayar + ' dari ' + x.n_anggota + ' orang membayar' : '')));
    const daftar = x.keluar.filter(function (k) { return k.tgl && k.tgl.slice(0, 7) === bln; });
    c.append(el('h3', 'iks-sub', 'Pengeluaran bulan ini'));
    if (!daftar.length) { c.append(el('p', 'hint', 'Tidak ada pengeluaran.')); return c; }
    const list = el('ul', 'iks-out');
    daftar.forEach(function (k) {
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
    return c;
  }

  function rincianView(d) {
    const f = document.createDocumentFragment();
    const s = d.sosial, p = d.pensiun;
    // Total kas saat ini: saldo awal + semua pemasukan − semua pengeluaran.
    const kas = el('section', 'iks-kpis');
    const total = (s.ok ? s.saldo : 0) + (p.ok ? p.saldo : 0);
    const big = el('div', 'kpi main saldo');
    big.append(el('strong', '', rp(total)), el('span', '', 'Total kas saat ini'));
    const a = el('div', 'kpi'); a.append(el('strong', '', s.ok ? rp(s.saldo) : '-'), el('span', '', 'Kas Sosial'));
    const b = el('div', 'kpi'); b.append(el('strong', '', p.ok ? rp(p.saldo) : '-'), el('span', '', 'Kas Pensiun'));
    kas.append(big, a, b);
    f.append(kas);

    const bulan = pastikanBulan(d);
    if (!bulan.length) { f.append(note('Belum ada data bulanan', 'Judul bulan di sheet iuran belum diisi.')); return f; }
    const pick = el('section', 'card dsec');
    pick.append(el('h2', '', 'Per bulan'), pilihBulan(bulan));
    f.append(pick, rincianDana(s, 'Sosial', state.bln), rincianDana(p, 'Pensiun', state.bln));
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
    [['sosial', 'Sosial'], ['pensiun', 'Pensiun'], ['rincian', 'Rincian Keuangan']].forEach(function (t) {
      const b = el('button', 'iks-tab', t[1]); b.type = 'button'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', state.tab === t[0] ? 'true' : 'false');
      b.addEventListener('click', function () { if (state.tab !== t[0]) { state.tab = t[0]; state.q = ''; state.reset = true; draw(); } });
      tabs.append(b);
    });
    const sheet = stage.querySelector('.iks-sheet');
    const pos = sheet && !state.reset ? { l: sheet.scrollLeft, t: sheet.scrollTop } : null;
    state.reset = false;
    const frag = document.createDocumentFragment();
    const daftar = pastikanBulan(d);
    frag.append(tabs, state.tab === 'rincian' ? rincianView(d) : tabelView(d[state.tab], daftar));
    stage.replaceChildren(frag);
    const baru = stage.querySelector('.iks-sheet');
    if (pos && baru) { baru.scrollLeft = pos.l; baru.scrollTop = pos.t; }
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
