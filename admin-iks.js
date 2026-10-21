/* SPEGANA — panel admin: kartu Laporan IKS (password halaman + status sambungan sheet) */
(function () {
  'use strict';
  const A = window.Admin;
  const el = App.el;
  const $ = function (id) { return document.getElementById(id); };
  const NAMA = {
    IKS_SOSIAL_IN: 'Iuran sosial (masuk)', IKS_PENSIUN_IN: 'Iuran pensiun (masuk)',
    IKS_SOSIAL_OUT: 'Pengeluaran sosial', IKS_PENSIUN_OUT: 'Pengeluaran pensiun', IKS_PENGATURAN: 'Pengaturan (saldo awal)'
  };
  const STATUS = {
    ok: ['Tersambung', 'ok'],
    tidak_ada: ['Sheet belum dibuat', 'bad'],
    belum_izin: ['Belum diizinkan — klik "Izinkan akses" di sel A1 sheet ini', 'bad'],
    kosong: ['Kosong', 'bad']
  };

  function setMsg(text, ok) { const m = $('iksMsg'); m.textContent = text; m.classList.toggle('ok', !!ok); }

  function show(d) {
    $('iksStatus').textContent = d.pakai_sandi ? 'Status: terbuka dengan password.' : 'Status: tertutup (belum ada password).';
    $('iksStatus').className = 'iks-status ' + (d.pakai_sandi ? 'on' : 'off');
    $('iksOff').hidden = !d.pakai_sandi;
    $('iksPw').labels[0].textContent = d.pakai_sandi ? 'Ganti password' : 'Buat password';
    const ul = $('iksSheets');
    ul.replaceChildren();
    d.sheets.forEach(function (s) {
      const st = STATUS[s.status] || [s.status, 'bad'];
      const li = el('li', 'iks-sh ' + st[1]);
      li.append(el('strong', '', s.sheet), el('span', '', NAMA[s.sheet] || ''), el('em', '', st[0] + (s.status === 'ok' ? ' · ' + s.baris + ' baris' : '')));
      ul.append(li);
    });
  }

  async function load(btn) {
    if (btn) A.setBusy(btn, true);
    try { show(await A.call('admin.iks.get', {})); }
    catch (e) { if (e.code !== 'AUTH') $('iksStatus').textContent = e.message; }
    finally { if (btn) A.setBusy(btn, false); }
  }

  $('iksForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = e.submitter || e.target.querySelector('button[type="submit"]');
    setMsg('');
    if (!$('iksPw').value) { setMsg('Isi password dulu.'); return; }
    A.setBusy(btn, true);
    try {
      show(await A.call('admin.iks.save', { sandi: $('iksPw').value }));
      $('iksPw').value = '';
      setMsg('Password disimpan. Bagikan kepada anggota.', true);
    } catch (err) { if (err.code !== 'AUTH') setMsg(err.message); }
    finally { A.setBusy(btn, false); }
  });

  $('iksOff').addEventListener('click', async function (e) {
    const ok = await App.confirm({ title: 'Tutup laporan IKS?', lines: ['Password dihapus dan halaman laporan tertutup untuk semua orang sampai Anda membuat password baru.'], ok: 'Tutup laporan' });
    if (!ok) return;
    setMsg('');
    A.setBusy($('iksOff'), true);
    try { show(await A.call('admin.iks.save', { hapus: true })); setMsg('Laporan ditutup.', true); }
    catch (err) { if (err.code !== 'AUTH') setMsg(err.message); }
    finally { A.setBusy($('iksOff'), false); }
  });

  $('iksRefresh').addEventListener('click', function () { load($('iksRefresh')); });
  if (window.App && App.passwordEye) App.passwordEye($('iksPw'));

  // ── Kelola IKS: dua password (bendahara, admin) + sambungan ke LAPORAN_IKS ──
  const PERAN = { bendahara: 'bendahara', admin: 'admin' };
  function ikskMsg(text, ok) { const m = $('ikskMsg'); m.textContent = text; m.classList.toggle('ok', !!ok); }

  function ikskShow(d) {
    Object.keys(PERAN).forEach(function (p) {
      const st = document.querySelector('[data-st="' + p + '"]');
      const on = !!d[p];
      st.textContent = on ? 'Sudah ada password. Isi kolom ini lalu simpan untuk menggantinya.' : 'Belum ada password (peran ini belum bisa masuk).';
      document.querySelector('.iksk-form[data-peran="' + p + '"] .iksk-off').hidden = !on;
    });
    const ul = $('ikskSumber');
    ul.replaceChildren();
    const s = d.sumber || { ok: false, pesan: '', tab: [] };
    if (s.pesan && !s.tab.length) {
      const li = el('li', 'iks-sh bad'); li.append(el('strong', '', 'LAPORAN_IKS'), el('em', '', s.pesan)); ul.append(li);
      return;
    }
    s.tab.forEach(function (t) {
      const li = el('li', 'iks-sh ' + (t.ada ? 'ok' : 'bad'));
      li.append(el('strong', '', t.tab), el('em', '', t.ada ? 'Tersambung' : 'Tab belum ada'));
      ul.append(li);
    });
  }

  async function ikskLoad() {
    try { ikskShow(await A.call('admin.iksk.get', {})); }
    catch (e) { if (e.code !== 'AUTH') ikskMsg(e.message); }
  }

  document.querySelectorAll('.iksk-form').forEach(function (f) {
    const peran = f.dataset.peran;
    const input = f.querySelector('input');
    if (window.App && App.passwordEye) App.passwordEye(input);
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = e.submitter || f.querySelector('button[type="submit"]');
      ikskMsg('');
      if (!input.value) { ikskMsg('Isi password dulu.'); return; }
      A.setBusy(btn, true);
      try {
        ikskShow(await A.call('admin.iksk.save', { peran: peran, sandi: input.value }));
        input.value = '';
        ikskMsg('Password ' + peran + ' disimpan. Bagikan kepada yang bersangkutan.', true);
      } catch (err) { if (err.code !== 'AUTH') ikskMsg(err.message); }
      finally { A.setBusy(btn, false); }
    });
    f.querySelector('.iksk-off').addEventListener('click', async function (e) {
      const btn = e.currentTarget;
      const ok = await App.confirm({ title: 'Hapus password ' + peran + '?', lines: ['Peran ini tidak bisa masuk lagi ke Kelola IKS sampai Anda membuat password baru.'], ok: 'Hapus' });
      if (!ok) return;
      ikskMsg('');
      A.setBusy(btn, true);
      try { ikskShow(await A.call('admin.iksk.save', { peran: peran, hapus: true })); ikskMsg('Password ' + peran + ' dihapus.', true); }
      catch (err) { if (err.code !== 'AUTH') ikskMsg(err.message); }
      finally { A.setBusy(btn, false); }
    });
  });
  A.onTab('settings', function () { load(); ikskLoad(); });
})();
