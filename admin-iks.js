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
  A.onTab('settings', function () { load(); });
  if (window.App && App.passwordEye) App.passwordEye($('iksPw'));
})();
