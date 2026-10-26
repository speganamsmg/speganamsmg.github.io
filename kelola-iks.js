/* SPEGANA — Kelola IKS: bendahara dan admin mengisi iuran, pengeluaran, dan saldo awal.
 * Masuk hanya dengan password (tanpa nama pengguna). Data ditulis ke spreadsheet LAPORAN_IKS lewat Apps Script. */
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const el = App.el;
  const stage = $('stage');
  const bar = $('saveBar');
  const TOKEN_KEY = 'iksk_token';
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const BLN_PENUH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const PERAN = { admin: 'Admin', bendahara: 'Bendahara' };

  const S = {
    d: null,                 // data terakhir dari server
    tab: 'iuran',            // iuran | keluar | saldo | log
    dana: 'sosial',
    bln: { sosial: '', pensiun: '' },
    q: '',
    edit: { sosial: Object.create(null), pensiun: Object.create(null) } // "baris|bln" → { v: nominal baru, lama: nilai asli saat diisi }
  };

  const themeBtn = $('themeBtn');
  themeBtn.append(App.svg('moon', 'moon'), App.svg('sun', 'sun'));
  themeBtn.addEventListener('click', App.theme.toggle);
  App.pasangBack('kelola-iks');

  // ── Format ──
  function rp(n) {
    const neg = n < 0;
    return (neg ? '−' : '') + 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');
  }
  function bulanPenuh(k) { return BLN_PENUH[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4); }
  function tglPendek(t) { return t ? +t.slice(8, 10) + ' ' + BLN[+t.slice(5, 7) - 1] + ' ' + t.slice(0, 4) : '-'; }
  function angka(v) { const n = parseInt(String(v == null ? '' : v).replace(/\D/g, ''), 10); return isFinite(n) ? n : 0; }
  function hariIni() {
    const t = new Date();
    return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  }

  // ── Token sesi (hanya di tab ini) ──
  function getToken() { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* abaikan */ } }

  let toastTimer = 0;
  function toast(text, bad) {
    const t = $('toast');
    t.textContent = text;
    t.classList.toggle('bad', !!bad);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3600);
  }

  // Memanggil API dengan token. Sesi habis → kembali ke layar password.
  async function api(action, payload, opts) {
    try {
      return await App.post(Object.assign({ action: action, token: getToken() }, payload || {}), opts);
    } catch (e) {
      if (e.code === 'AUTH') { setToken(''); S.d = null; bar.hidden = true; tampilMasuk(e.message); }
      throw e;
    }
  }

  // ── Layar masuk ──
  function tampilMasuk(pesan) {
    $('dhead').hidden = true;
    bar.hidden = true;
    document.body.classList.remove('iksk-has-bar');
    const c = el('form', 'card iksk-login');
    c.noValidate = true;
    c.append(el('h2', '', 'Kelola IKS'));
    c.append(el('p', 'hint', 'Khusus bendahara dan admin. Masukkan password yang diberikan kepada Anda.'));
    const inp = el('input', 'input'); inp.type = 'password'; inp.maxLength = 64; inp.autocomplete = 'off';
    inp.autocapitalize = 'off'; inp.spellcheck = false; inp.setAttribute('aria-label', 'Password');
    const msg = el('p', 'iksk-err', pesan || ''); msg.setAttribute('role', 'alert');
    const ok = el('button', 'btn btn-primary', 'Masuk'); ok.type = 'submit';
    c.append(inp, msg, ok);
    c.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!inp.value) { msg.textContent = 'Isi password dulu.'; return; }
      ok.disabled = true; msg.textContent = '';
      try {
        const r = await App.post({ action: 'iksk.masuk', sandi: inp.value });
        setToken(r.token);
        await muat(true);
      } catch (err) {
        msg.textContent = err.message || 'Gagal masuk.';
        inp.select();
      } finally { ok.disabled = false; }
    });
    stage.replaceChildren(c);
    App.passwordEye(inp);
    setTimeout(function () { inp.focus(); }, 50);
  }

  // ── Data ──
  function bulanAcuan(m) {
    const b = m.bulan;
    if (!b.length) return '';
    if (b.indexOf(S.d.bulan_ini) >= 0) return S.d.bulan_ini;
    return S.d.bulan_ini < b[0] ? b[0] : b[b.length - 1];
  }

  function terapkanData(d) {
    let basi = 0;
    S.d = d;
    ['sosial', 'pensiun'].forEach(function (j) {
      const m = d[j].masuk;
      if (m.bulan.indexOf(S.bln[j]) < 0) S.bln[j] = bulanAcuan(m);
      // Isian yang sudah sama dengan data terbaru dibuang. Isian yang dibuat dari nilai lama
      // (datanya sudah diubah orang lain) juga dibuang, supaya tidak menimpa tanpa sengaja.
      Object.keys(S.edit[j]).forEach(function (k) {
        const p = k.split('|'); const o = cariOrang(j, +p[0]);
        const i = m.bulan.indexOf(p[1]);
        const e = S.edit[j][k];
        if (!o || i < 0) { delete S.edit[j][k]; return; }
        const ketSkrg = o.ket[i] || '';
        const ketSama = e.ket === undefined || e.ket === ketSkrg;
        if (o.bayar[i] === angka(e.v) && ketSama) { delete S.edit[j][k]; return; }
        if (o.bayar[i] !== e.lama || (e.ket !== undefined && ketSkrg !== e.ketLama)) { delete S.edit[j][k]; basi++; }
      });
    });
    if (S.tab === 'saldo' && d.peran !== 'admin') S.tab = 'iuran';
    return basi;
  }

  function cariOrang(j, baris) {
    const o = S.d[j].masuk.orang;
    for (let i = 0; i < o.length; i++) if (o[i].baris === baris) return o[i];
    return null;
  }

  async function muat(pertama, btn) {
    if (btn) btn.classList.add('is-busy');
    try {
      const basi = terapkanData(await api('iksk.data', {}, { silent: !pertama && !btn }));
      if (pertama) App.splash.hide(300);
      gambar();
      if (basi) toast(basi + ' isian dibatalkan karena datanya sudah diubah orang lain.', true);
    } catch (e) {
      if (pertama) App.splash.hide(300);
      if (e.code !== 'AUTH') {
        if (S.d) toast(e.message, true);
        else { $('dhead').hidden = true; stage.replaceChildren(catatan('Belum bisa dimuat', e.message, true)); }
      }
    } finally { if (btn) btn.classList.remove('is-busy'); }
  }

  function catatan(judul, teks, ulang) {
    const c = el('div', 'card');
    c.append(el('h2', '', judul));
    if (teks) c.append(el('p', 'hint', teks));
    if (ulang) {
      const b = el('button', 'btn', 'Coba lagi'); b.type = 'button';
      b.addEventListener('click', function () { muat(true); });
      c.append(b);
    }
    return c;
  }

  // Setelah bentrok: muat data terbaru, lalu beri tahu bila ada isian yang dibatalkan karena datanya berubah.
  async function muatSetelahBentrok(pesan) {
    try {
      const basi = terapkanData(await api('iksk.data', {}, { silent: true }));
      gambar();
      toast(pesan + (basi ? ' ' + basi + ' isian Anda dibatalkan, silakan isi ulang.' : ''), true);
    } catch (e) { if (e.code !== 'AUTH') toast(pesan, true); }
  }

  // Menjalankan simpan; sukses → data baru dari server. Bentrok → data dimuat ulang.
  async function simpan(action, payload, pesanOk) {
    try {
      const d = await api(action, payload);
      terapkanData(d);
      toast(pesanOk || 'Tersimpan.');
      gambar();
      return true;
    } catch (e) {
      if (e.code === 'CONFLICT') await muatSetelahBentrok(e.message);
      else if (e.code !== 'AUTH') toast(e.message, true);
      return false;
    }
  }

  // ── Kerangka ──
  function gambar() {
    if (!S.d) return;
    const d = S.d;
    $('dhead').hidden = false;
    $('dtitle').textContent = 'Kelola IKS';
    const desc = $('ddesc');
    const baris = el('div', 'iksk-who');
    baris.append(el('span', 'iksk-chip', PERAN[d.peran] || d.peran));
    const ref = el('button', 'icon-btn sm iks-reload'); ref.type = 'button';
    ref.setAttribute('aria-label', 'Muat ulang'); ref.title = 'Muat ulang'; ref.append(App.svg('refresh'));
    ref.addEventListener('click', function () { muat(false, ref); });
    const out = el('button', 'btn sm', 'Keluar'); out.type = 'button';
    out.addEventListener('click', keluar);
    baris.append(ref, out);
    desc.replaceChildren(el('div', '', 'Iuran Kesetiakawanan Sosial dan Pensiun.'), baris);

    const frag = document.createDocumentFragment();
    const tabs = el('div', 'iks-tabs iksk-tabs'); tabs.setAttribute('role', 'tablist');
    const daftar = [['iuran', 'Iuran'], ['keluar', 'Keluar']];
    if (d.peran === 'admin') daftar.push(['saldo', 'Saldo']);
    daftar.push(['log', 'Riwayat']);
    daftar.forEach(function (t) {
      const b = el('button', 'iks-tab', t[1]); b.type = 'button'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', S.tab === t[0] ? 'true' : 'false');
      b.addEventListener('click', function () { if (S.tab !== t[0]) { S.tab = t[0]; S.q = ''; gambar(); } });
      tabs.append(b);
    });
    frag.append(tabs);
    if (S.tab === 'iuran' || S.tab === 'keluar') frag.append(pilihDana());
    if (S.tab === 'iuran') frag.append(viewIuran());
    else if (S.tab === 'keluar') frag.append(viewKeluar());
    else if (S.tab === 'saldo') frag.append(viewSaldo());
    else frag.append(viewLog());
    stage.replaceChildren(frag);
    barSimpan();
  }

  function pilihDana() {
    const t = el('div', 'iks-tabs iksk-dana'); t.setAttribute('role', 'tablist');
    [['sosial', 'Sosial'], ['pensiun', 'Pensiun']].forEach(function (x) {
      const b = el('button', 'iks-tab', x[1]); b.type = 'button'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', S.dana === x[0] ? 'true' : 'false');
      b.addEventListener('click', function () { if (S.dana !== x[0]) { S.dana = x[0]; S.q = ''; gambar(); } });
      t.append(b);
    });
    return t;
  }

  async function keluar() {
    try { await App.post({ action: 'iksk.keluar', token: getToken() }, { silent: true }); } catch (e) { /* abaikan */ }
    setToken(''); S.d = null; bar.hidden = true;
    tampilMasuk('');
  }

  // ── Iuran ──
  function jumlahEdit() { return Object.keys(S.edit[S.dana]).length; }

  function nilaiEfektif(o, i, bln) {
    const k = o.baris + '|' + bln;
    return Object.prototype.hasOwnProperty.call(S.edit[S.dana], k) ? angka(S.edit[S.dana][k].v) : o.bayar[i];
  }

  function viewIuran() {
    const j = S.dana;
    const m = S.d[j].masuk;
    const f = document.createDocumentFragment();
    if (!m.bulan.length) { f.append(catatan('Belum ada kolom bulan', 'Tab ' + (j === 'sosial' ? 'SOSIAL_IN' : 'PENSIUN_IN') + ' belum punya judul bulan di baris pertama.')); return f; }
    if (!m.orang.length) { f.append(catatan('Belum ada anggota', 'Isi daftar nama di tab ' + (j === 'sosial' ? 'SOSIAL_IN' : 'PENSIUN_IN') + ' pada LAPORAN_IKS.')); return f; }
    const bln = S.bln[j];
    const i = m.bulan.indexOf(bln);

    const c = el('section', 'card dsec');
    const head = el('div', 'iksk-row');
    const sel = el('select', 'input iksk-bln'); sel.setAttribute('aria-label', 'Bulan');
    m.bulan.forEach(function (b) {
      const o = el('option', '', bulanPenuh(b)); o.value = b; if (b === bln) o.selected = true; sel.append(o);
    });
    sel.addEventListener('change', function () { S.bln[j] = sel.value; S.q = ''; gambar(); });
    head.append(sel);
    c.append(head);

    const ringkas = el('p', 'hint iksk-ring');
    const upd = function () {
      let n = 0, tot = 0;
      m.orang.forEach(function (o) { const v = nilaiEfektif(o, i, bln); if (v > 0 || (o.rapel && o.rapel[i])) n++; if (v > 0) tot += v; });
      ringkas.textContent = n + ' dari ' + m.orang.length + ' sudah membayar · ' + rp(tot);
    };
    upd();
    c.append(ringkas);

    const q = el('input', 'input iks-q'); q.type = 'search'; q.placeholder = 'Cari nama…'; q.setAttribute('aria-label', 'Cari nama'); q.value = S.q;
    const list = el('ul', 'iksk-list');
    const isiList = function () {
      list.replaceChildren();
      const s = S.q.trim().toLowerCase();
      let n = 0;
      m.orang.forEach(function (o) {
        if (s && o.nama.toLowerCase().indexOf(s) < 0) return;
        n++;
        const k = o.baris + '|' + bln;
        const ubah = Object.prototype.hasOwnProperty.call(S.edit[j], k);
        const li = el('li', 'iksk-item' + (ubah ? ' changed' : ''));
        const nm = el('div', 'iksk-nm');
        nm.append(el('strong', '', o.nama), el('span', '', o.jabatan || ''), pilRapel(j, o, bln, i));
        const wrap = el('label', 'iksk-amt');
        wrap.append(el('span', '', 'Rp'));
        const inp = el('input'); inp.type = 'text'; inp.inputMode = 'numeric'; inp.autocomplete = 'off';
        inp.setAttribute('aria-label', 'Iuran ' + o.nama);
        inp.placeholder = '0';
        const v = nilaiEfektif(o, i, bln);
        inp.value = v ? String(v) : '';
        inp.addEventListener('input', function () {
          const bersih = inp.value.replace(/\D/g, '').slice(0, 10);
          if (bersih !== inp.value) inp.value = bersih;
          aturEdit(j, o, bln, i, { v: angka(bersih) });
          li.classList.toggle('changed', Object.prototype.hasOwnProperty.call(S.edit[j], k));
          upd(); barSimpan();
        });
        wrap.append(inp);
        li.append(nm, wrap);
        list.append(li);
      });
      if (!n) list.append(el('li', 'iks-none', 'Nama tidak ditemukan.'));
    };
    q.addEventListener('input', function () { S.q = q.value; isiList(); });
    c.append(q, list);
    isiList();
    f.append(c);
    return f;
  }

  // Isian sementara satu sel: { v: nominal, lama: nominal asli, ket?: keterangan baru, ketLama?: keterangan asli }.
  function aturEdit(j, o, bln, i, patch) {
    const k = o.baris + '|' + bln;
    const e = S.edit[j][k] || { v: String(o.bayar[i]), lama: o.bayar[i] };
    if (patch.v !== undefined) e.v = String(patch.v);
    if (patch.ket !== undefined) { if (e.ket === undefined) e.ketLama = o.ket[i] || ''; e.ket = patch.ket; }
    const ketSama = e.ket === undefined || e.ket === (o.ket[i] || '');
    if (angka(e.v) === o.bayar[i] && ketSama) delete S.edit[j][k]; else S.edit[j][k] = e;
  }

  function ketEfektif(j, o, i, bln) {
    const e = S.edit[j][o.baris + '|' + bln];
    return e && e.ket !== undefined ? e.ket : (o.ket[i] || '');
  }

  // ── Rapel: pembayaran sekaligus beberapa bulan, ditulis di kolom "Ket <bulan>" ──
  const BLN_NO = { jan: 1, feb: 2, peb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, aug: 8, agt: 8, ags: 8, sep: 9, okt: 10, oct: 10, nov: 11, nop: 11, des: 12, dec: 12 };
  function bulanDariTeks(t, acuan, sebelum) {
    const m = /^([a-z]{3,})\.?\s*[-\/']?\s*(\d{2}|\d{4})?$/i.exec(String(t || '').trim());
    if (!m) return '';
    const n = BLN_NO[m[1].toLowerCase().slice(0, 3)];
    if (!n) return '';
    let y;
    if (m[2]) y = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    else {
      const ay = +acuan.slice(0, 4), am = +acuan.slice(5, 7);
      if (sebelum) y = n <= am ? ay : ay - 1;
      else {
        let best = Infinity; y = ay;
        [ay - 1, ay, ay + 1].forEach(function (c) { const d = Math.abs(c * 12 + n - (ay * 12 + am)); if (d < best) { best = d; y = c; } });
      }
    }
    return y + '-' + ('0' + n).slice(-2);
  }
  const RENTANG = /\s+s\s*[.\/]\s*d\.?\s*|\s+sd\.?\s+|\s+(?:sampai|hingga|to)\s+|\s*[–—]\s*|\s+-\s+/i;
  function noBulan(b) { return +b.slice(0, 4) * 12 + +b.slice(5, 7) - 1; }
  function keBulan(n) { return Math.floor(n / 12) + '-' + ('0' + (n % 12 + 1)).slice(-2); }
  // Daftar bulan yang dilunasi menurut keterangan (koma atau "s.d"); null bila bukan rapel.
  function parseRapel(teks, bulanBayar) {
    const m = /^(?:rapel|pembayaran|dibayar|bayaran|bayar|disetor|setoran|setor)\b[\s:.\-–]*(.*)$/i.exec(String(teks || '').replace(/\(\s*[-−–][^)]*\)/g, ' ').trim());
    if (!m) return null;
    const hasil = [];
    const tambah = function (b) { if (hasil.indexOf(b) < 0) hasil.push(b); };
    m[1].split(/\s*(?:,|;|&|\bdan\b)\s*/i).forEach(function (x) {
      const bagian = x.split(RENTANG);
      if (bagian.length >= 2) {
        const akhir = bulanDariTeks(bagian[bagian.length - 1], bulanBayar);
        const awal = akhir ? bulanDariTeks(bagian[0], akhir, true) : '';
        if (!awal || !akhir) return;
        let a = noBulan(awal), z = noBulan(akhir);
        if (a > z) { const t = a; a = z; z = t; }
        if (z - a >= 60) a = z - 59;
        for (let n = a; n <= z; n++) tambah(keBulan(n));
      } else {
        const b = bulanDariTeks(x, bulanBayar);
        if (b) tambah(b);
      }
    });
    return hasil;
  }
  // Bulan berurutan 3 atau lebih ditulis sebagai rentang: "Rapel Sep 25 s.d Okt 26"; sisanya dipisah koma.
  function teksRapel(daftar) {
    const urut = daftar.slice().sort();
    const bagian = [];
    let i = 0;
    while (i < urut.length) {
      let k = i;
      while (k + 1 < urut.length && noBulan(urut[k + 1]) === noBulan(urut[k]) + 1) k++;
      if (k - i >= 2) bagian.push(bulanSingkat(urut[i]) + ' s.d ' + bulanSingkat(urut[k]));
      else for (let n = i; n <= k; n++) bagian.push(bulanSingkat(urut[n]));
      i = k + 1;
    }
    return 'Rapel ' + bagian.join(', ');
  }
  function bulanSingkat(k) { return BLN[+k.slice(5, 7) - 1] + ' ' + k.slice(2, 4); }

  // Tombol kecil di bawah nama: keterangan rapel bulan ini, dan penanda bila bulan ini sudah dilunasi lewat rapel bulan lain.
  function pilRapel(j, o, bln, i) {
    const wrap = el('div', 'iksk-pills');
    const ket = ketEfektif(j, o, i, bln);
    const b = el('button', 'iksk-pill' + (ket ? (/^\s*(?:rapel|pembayaran|dibayar|bayaran|bayar|disetor|setoran|setor)\b/i.test(ket) ? ' on' : ' has') : ''), ket || '+ Rapel'); b.type = 'button';
    b.setAttribute('aria-label', 'Keterangan rapel ' + o.nama);
    b.addEventListener('click', function () {
      const m = S.d[j].masuk;
      if (!m.ada_ket[i]) {
        toast('Kolom "Ket ' + BLN[+bln.slice(5, 7) - 1] + ' ' + bln.slice(0, 4) + '" belum ada di tab ' + (j === 'sosial' ? 'SOSIAL_IN' : 'PENSIUN_IN') + '. Tambahkan dulu di Google Sheets, di kanan kolom bulannya.', true);
        return;
      }
      formRapel(j, o, bln, i);
    });
    wrap.append(b);
    const rd = (o.rapel && o.rapel[i]) || '';
    if (rd && rd !== bln) wrap.append(el('span', 'iksk-pill cov', (((o.rapel_n && o.rapel_n[i]) || 0) >= 2 ? 'Rapel ' : 'Dibayar ') + bulanSingkat(rd)));
    return wrap;
  }

  function formRapel(j, o, bln, i) {
    const m = S.d[j].masuk;
    const awal = ketEfektif(j, o, i, bln);
    const pilih = {};
    (parseRapel(awal, bln) || []).forEach(function (b) { if (b !== bln) pilih[b] = true; });
    const d = document.createElement('dialog');
    d.className = 'install-dlg iksk-dlg';
    const box = el('div', 'in');
    box.append(el('h2', '', 'Rapel ' + o.nama));
    box.append(el('p', 'hint', 'Dibayar di ' + bulanPenuh(bln) + '. Centang bulan sebelumnya yang ikut dilunasi. Nominalnya tetap diisi di kolom iuran bulan ini.'));
    const form = el('form'); form.noValidate = true;

    const teks = el('input', 'input'); teks.type = 'text'; teks.maxLength = 120; teks.autocomplete = 'off';
    teks.value = awal;
    const susun = function () {
      const p = Object.keys(pilih).filter(function (b) { return pilih[b]; }).sort();
      return p.length ? teksRapel(p.concat([bln])) : '';
    };

    const daftar = m.bulan.filter(function (b) { return b < bln; }).sort().reverse().slice(0, 24);
    const ul = el('ul', 'iksk-chk');
    const pas = el('li');
    const pl = el('label'); const pc = el('input'); pc.type = 'checkbox'; pc.checked = true; pc.disabled = true;
    pl.append(pc, el('span', '', bulanPenuh(bln)), el('em', '', 'dibayar bulan ini'));
    pas.append(pl); ul.append(pas);
    if (!daftar.length) ul.append(el('li', 'iks-none', 'Tidak ada bulan sebelumnya di sheet.'));
    daftar.forEach(function (b) {
      const idx = m.bulan.indexOf(b);
      const v = o.bayar[idx];
      const rd = (o.rapel && o.rapel[idx]) || '';
      const st = v > 0 ? rp(v) : (rd && rd !== bln ? 'Rapel ' + bulanSingkat(rd) : 'Belum');
      const li = el('li');
      const lb = el('label'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!pilih[b];
      cb.addEventListener('change', function () { pilih[b] = cb.checked; teks.value = susun(); });
      lb.append(cb, el('span', '', bulanPenuh(b)), el('em', '', st));
      li.append(lb); ul.append(li);
    });
    form.append(ul);
    form.append(kolomForm('Keterangan di sheet', teks, 'Terisi otomatis dari centang. Boleh diketik sendiri, mis. "Rapel Sep 25 s.d Okt 26" untuk beberapa bulan sekaligus. Kosongkan untuk menghapus keterangan.'));

    const msg = el('p', 'iksk-err', ''); msg.setAttribute('role', 'alert');
    const row = el('div', 'dlg-actions');
    const no = el('button', 'btn', 'Batal'); no.type = 'button';
    const ok = el('button', 'btn btn-primary', 'Pakai'); ok.type = 'submit';
    row.append(no, ok);
    form.append(msg, row);
    box.append(form); d.append(box);
    no.addEventListener('click', function () { d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const val = teks.value.replace(/\s+/g, ' ').trim();
      if (val.length > 120) { msg.textContent = 'Keterangan terlalu panjang (maksimal 120 karakter).'; return; }
      aturEdit(j, o, bln, i, { ket: val });
      d.close();
      gambar();
    });
    document.body.append(d); d.showModal();
  }

  function barSimpan() {
    const n = S.d && S.tab === 'iuran' ? jumlahEdit() : 0;
    bar.hidden = !n;
    document.body.classList.toggle('iksk-has-bar', n > 0);
    if (!n) return;
    bar.replaceChildren();
    const t = el('span', '', n + ' perubahan belum disimpan');
    const batal = el('button', 'btn sm', 'Batal'); batal.type = 'button';
    batal.addEventListener('click', function () { S.edit[S.dana] = Object.create(null); gambar(); });
    const ok = el('button', 'btn btn-primary sm', 'Simpan'); ok.type = 'button';
    ok.addEventListener('click', function () { simpanIuran(ok); });
    bar.append(t, batal, ok);
  }

  async function simpanIuran(btn) {
    const j = S.dana;
    const m = S.d[j].masuk;
    const ubah = [];
    let nKet = 0;
    Object.keys(S.edit[j]).forEach(function (k) {
      const p = k.split('|'); const o = cariOrang(j, +p[0]); const i = m.bulan.indexOf(p[1]);
      if (!o || i < 0) return;
      const e = S.edit[j][k];
      const u = { baris: o.baris, nama: o.nama, bln: p[1], lama: o.bayar[i], baru: angka(e.v) };
      if (e.ket !== undefined) { u.ket = e.ket; u.ketLama = o.ket[i] || ''; nKet++; }
      ubah.push(u);
    });
    if (!ubah.length) return;
    const ok = await App.confirm({
      title: 'Simpan ' + ubah.length + ' perubahan?',
      lines: ['Iuran ' + (j === 'sosial' ? 'sosial' : 'pensiun') + (nKet ? ' dan ' + nKet + ' keterangan rapel' : '') + ' akan diperbarui di LAPORAN_IKS dan tercatat di tab LOG.'],
      ok: 'Simpan'
    });
    if (!ok) return;
    btn.disabled = true;
    const berhasil = await simpan('iksk.iuran', { jenis: j, ubah: ubah }, 'Iuran tersimpan.');
    if (berhasil) S.edit[j] = Object.create(null);
    btn.disabled = false;
    if (berhasil) gambar();
  }

  // ── Pengeluaran ──
  function viewKeluar() {
    const j = S.dana;
    const x = S.d[j];
    const c = el('section', 'card dsec');
    const tambah = el('button', 'btn btn-primary iksk-add', 'Tambah pengeluaran'); tambah.type = 'button';
    tambah.prepend(App.svg('plus'));
    tambah.addEventListener('click', function () { formKeluar(j, null); });
    c.append(tambah);
    if (!x.keluar.length) { c.append(el('p', 'hint', 'Belum ada pengeluaran.')); return c; }
    const list = el('ul', 'iks-out iksk-out');
    x.keluar.forEach(function (k) {
      const li = el('li');
      const kiri = el('div', 'o-l');
      kiri.append(el('strong', '', k.jenis || 'Pengeluaran'));
      const info = [k.penerima, k.catatan].filter(Boolean).join(' · ');
      if (info) kiri.append(el('span', '', info));
      kiri.append(el('span', 'o-d', tglPendek(k.tgl)));
      const kanan = el('div', 'iksk-o-r');
      kanan.append(el('div', 'o-r', rp(k.nominal)));
      const aksi = el('div', 'iksk-act');
      const ub = el('button', 'icon-btn sm'); ub.type = 'button'; ub.setAttribute('aria-label', 'Ubah'); ub.title = 'Ubah'; ub.append(App.svg('edit'));
      ub.addEventListener('click', function () { formKeluar(j, k); });
      const hp = el('button', 'icon-btn sm'); hp.type = 'button'; hp.setAttribute('aria-label', 'Hapus'); hp.title = 'Hapus'; hp.append(App.svg('trash'));
      hp.addEventListener('click', function () { hapusKeluar(j, k); });
      aksi.append(ub, hp);
      kanan.append(aksi);
      li.append(kiri, kanan);
      list.append(li);
    });
    c.append(list);
    return c;
  }

  function kolomForm(label, input, bantu) {
    const f = el('div', 'field');
    const id = 'iksk_' + App.randomId(6);
    input.id = id;
    const l = el('label', '', label); l.htmlFor = id;
    f.append(l, input);
    if (bantu) f.append(el('span', 'help', bantu));
    return f;
  }

  // Formulir tambah (k = null) atau ubah.
  function formKeluar(j, k) {
    const x = S.d[j];
    const d = document.createElement('dialog');
    d.className = 'install-dlg iksk-dlg';
    const box = el('div', 'in');
    box.append(el('h2', '', (k ? 'Ubah' : 'Tambah') + ' pengeluaran ' + (j === 'sosial' ? 'sosial' : 'pensiun')));
    const form = el('form'); form.noValidate = true;

    const tgl = el('input', 'input'); tgl.type = 'date'; tgl.value = k ? k.tgl : hariIni(); tgl.max = '2100-12-31';
    form.append(kolomForm('Tanggal', tgl));
    let jenis = null;
    if (x.kolom.kejadian) {
      jenis = el('input', 'input'); jenis.type = 'text'; jenis.maxLength = 60; jenis.autocomplete = 'off';
      jenis.placeholder = 'Mis. Sakit, Duka cita'; jenis.value = k ? k.jenis : '';
      const dl = el('datalist'); dl.id = 'iksk_kejadian';
      const unik = {};
      x.keluar.forEach(function (r) { if (r.jenis && !unik[r.jenis]) { unik[r.jenis] = 1; const o = el('option'); o.value = r.jenis; dl.append(o); } });
      jenis.setAttribute('list', 'iksk_kejadian');
      const kf = kolomForm('Kejadian', jenis);
      kf.append(dl);
      form.append(kf);
    }
    const penerima = el('input', 'input'); penerima.type = 'text'; penerima.maxLength = 120; penerima.autocomplete = 'off';
    penerima.value = k ? k.penerima : '';
    form.append(kolomForm('Penerima', penerima));
    const nominal = el('input', 'input'); nominal.type = 'text'; nominal.inputMode = 'numeric'; nominal.autocomplete = 'off';
    nominal.placeholder = 'Rupiah'; nominal.value = k ? String(k.nominal) : '';
    nominal.addEventListener('input', function () { const b = nominal.value.replace(/\D/g, '').slice(0, 10); if (b !== nominal.value) nominal.value = b; });
    form.append(kolomForm('Nominal', nominal));
    const catat = el('input', 'input'); catat.type = 'text'; catat.maxLength = 200; catat.autocomplete = 'off';
    catat.value = k ? k.catatan : '';
    form.append(kolomForm('Catatan (boleh kosong)', catat));

    const msg = el('p', 'iksk-err', ''); msg.setAttribute('role', 'alert');
    const row = el('div', 'dlg-actions');
    const no = el('button', 'btn', 'Batal'); no.type = 'button';
    const ok = el('button', 'btn btn-primary', 'Simpan'); ok.type = 'submit';
    row.append(no, ok);
    form.append(msg, row);
    box.append(form); d.append(box);
    no.addEventListener('click', function () { d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    const kid = App.randomId(20);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      msg.textContent = '';
      const baru = { tgl: tgl.value, jenis: jenis ? jenis.value.trim() : '', penerima: penerima.value.trim(), nominal: angka(nominal.value), catatan: catat.value.trim() };
      if (!baru.tgl) { msg.textContent = 'Isi tanggalnya.'; return; }
      if (jenis && !baru.jenis) { msg.textContent = 'Isi kejadiannya.'; return; }
      if (!baru.penerima) { msg.textContent = 'Isi penerimanya.'; return; }
      if (!baru.nominal) { msg.textContent = 'Isi nominalnya.'; return; }
      ok.disabled = true;
      try {
        const payload = k
          ? { jenis: j, baris: k.baris, lama: { tgl: k.tgl, jenis: k.jenis, penerima: k.penerima, nominal: k.nominal, catatan: k.catatan }, baru: baru }
          : { jenis: j, baru: baru, kid: kid };
        const dt = await api(k ? 'iksk.keluarUbah' : 'iksk.keluarTambah', payload);
        terapkanData(dt);
        d.close();
        toast(k ? 'Pengeluaran diubah.' : 'Pengeluaran ditambahkan.');
        gambar();
      } catch (err) {
        if (err.code === 'CONFLICT') { d.close(); muatSetelahBentrok(err.message); }
        else if (err.code !== 'AUTH') msg.textContent = err.message;
        else d.close();
      } finally { ok.disabled = false; }
    });
    document.body.append(d); d.showModal();
    (k ? nominal : (jenis || penerima)).focus();
  }

  async function hapusKeluar(j, k) {
    const ok = await App.confirm({
      title: 'Hapus pengeluaran ini?',
      lines: [[k.jenis, k.penerima].filter(Boolean).join(' · ') + ' · ' + rp(k.nominal) + ' · ' + tglPendek(k.tgl), 'Barisnya dihapus dari LAPORAN_IKS dan tercatat di tab LOG.'],
      ok: 'Hapus'
    });
    if (!ok) return;
    await simpan('iksk.keluarHapus', { jenis: j, baris: k.baris, lama: { tgl: k.tgl, jenis: k.jenis, penerima: k.penerima, nominal: k.nominal, catatan: k.catatan } }, 'Pengeluaran dihapus.');
  }

  // ── Saldo awal (admin) ──
  function viewSaldo() {
    const c = el('section', 'card dsec');
    c.append(el('h2', '', 'Saldo awal'));
    c.append(el('p', 'hint', 'Saldo kas sebelum pencatatan di sistem ini. Mengubahnya menggeser seluruh saldo di laporan.'));
    const form = el('form'); form.noValidate = true;
    const mk = function (label, nilai) {
      const inp = el('input', 'input'); inp.type = 'text'; inp.inputMode = 'numeric'; inp.autocomplete = 'off';
      inp.value = String(nilai || 0);
      inp.addEventListener('input', function () { const b = inp.value.replace(/\D/g, '').slice(0, 10); if (b !== inp.value) inp.value = b; });
      form.append(kolomForm(label, inp));
      return inp;
    };
    const so = mk('Saldo awal sosial (Rp)', S.d.saldo_awal.sosial);
    const pe = mk('Saldo awal pensiun (Rp)', S.d.saldo_awal.pensiun);
    const ok = el('button', 'btn btn-primary', 'Simpan saldo awal'); ok.type = 'submit';
    form.append(ok);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const baru = { sosial: angka(so.value), pensiun: angka(pe.value) };
      const lama = S.d.saldo_awal;
      if (baru.sosial === lama.sosial && baru.pensiun === lama.pensiun) { toast('Tidak ada perubahan.'); return; }
      const yakin = await App.confirm({
        title: 'Ubah saldo awal?',
        lines: ['Sosial: ' + rp(lama.sosial) + ' → ' + rp(baru.sosial), 'Pensiun: ' + rp(lama.pensiun) + ' → ' + rp(baru.pensiun), 'Perubahan tercatat di tab LOG.'],
        ok: 'Ubah'
      });
      if (!yakin) return;
      ok.disabled = true;
      await simpan('iksk.saldo', { sosial: baru.sosial, pensiun: baru.pensiun, lama: lama }, 'Saldo awal tersimpan.');
      ok.disabled = false;
    });
    c.append(form);
    return c;
  }

  // ── Riwayat ──
  function viewLog() {
    const c = el('section', 'card dsec');
    c.append(el('h2', '', 'Riwayat perubahan'));
    c.append(el('p', 'hint', 'Hanya perubahan yang dibuat lewat halaman ini. Perubahan langsung di Google Sheets tercatat di riwayat versi Sheets.'));
    if (!S.d.log.length) { c.append(el('p', 'hint', 'Belum ada catatan.')); return c; }
    const list = el('ul', 'iksk-log');
    S.d.log.forEach(function (r) {
      const li = el('li');
      const atas = el('div', 'l-top');
      atas.append(el('strong', '', r.aksi), el('span', 'iksk-chip sm', PERAN[r.peran] || r.peran));
      li.append(atas, el('span', 'l-time', r.waktu + ' · ' + r.tab));
      if (r.rincian) li.append(el('span', 'l-det', r.rincian));
      list.append(li);
    });
    c.append(list);
    return c;
  }

  // ── Mulai ──
  if (getToken()) muat(true);
  else { App.splash.hide(300); tampilMasuk(''); }
})();
