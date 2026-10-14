/* SPEGANA — panel admin: tab Hasil (ringkasan dan jawaban mentah) */
(function () {
  'use strict';

  const A = window.Admin;
  const el = App.el;
  const $ = function (id) { return document.getElementById(id); };

  let formsLoaded = false;
  let current = null;   // hasil terakhir dari server
  let seq = 0;

  function loadingBox() {
    const b = el('div', 'loading-box');
    b.append(el('span', 'spin'), document.createTextNode('Memuat hasil…'));
    return b;
  }

  function fillForms(d, keep) {
    const sel = $('resForm');
    sel.replaceChildren();
    d.forms.forEach(function (f) { sel.append(new Option(f.judul + ' (' + f.aktif + ' jawaban)', f.form_id)); });
    if (!d.forms.length) sel.append(new Option('Belum ada form', ''));
    if (keep && d.forms.some(function (f) { return f.form_id === keep; })) sel.value = keep;
    formsLoaded = true;
    return d.forms.length;
  }

  async function show(selectId) {
    const body = $('resBody');
    try {
      const keep = selectId || $('resForm').value;
      let count = 0;
      if (!formsLoaded) body.replaceChildren(loadingBox());
      await A.swr('admin.forms.list', {}, function (d) { count = fillForms(d, keep); });
      if (!count) {
        $('resActions').replaceChildren();
        const box = el('div', 'empty');
        box.append(el('strong', '', 'Belum ada form.'), document.createTextNode('Buat form di tab Form, hasilnya muncul di sini.'));
        body.replaceChildren(box);
        return;
      }
      await loadResults();
    } catch (e) {
      if (e.code !== 'AUTH') body.replaceChildren(el('div', 'empty', e.message));
    }
  }

  async function loadResults() {
    const id = $('resForm').value;
    if (!id) return;
    const my = ++seq;
    const payload = { form_id: id, filter: $('resFilter').value };
    if (!current || current.form.form_id !== id) $('resBody').replaceChildren(loadingBox());
    await A.swr('admin.results', payload, function (d) {
      if (my !== seq) return; // pilihan sudah berganti
      current = d;
      render(d);
    });
  }

  function csvCell(v) {
    const s = String(v);
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function downloadCsv(d) {
    const lines = [d.columns.map(csvCell).join(',')];
    d.rows.forEach(function (r) { lines.push(r.map(csvCell).join(',')); });
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = (d.form.slug || 'hasil') + '.csv';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function render(d) {
    // Tombol aksi
    const acts = $('resActions');
    acts.replaceChildren();
    const mkBtn = function (label, icon, fn) {
      const b = el('button', 'btn'); b.type = 'button';
      b.append(App.svg(icon), document.createTextNode(label));
      b.addEventListener('click', fn);
      return b;
    };
    acts.append(
      mkBtn('Muat ulang', 'up', function () { loadResults().catch(function (e) { if (e.code !== 'AUTH') A.toast(e.message, true); }); }),
      mkBtn('Unduh CSV', 'download', function () { downloadCsv(d); })
    );
    const sheet = el('a', 'btn');
    sheet.href = d.sheet_url; sheet.target = '_blank'; sheet.rel = 'noopener noreferrer';
    sheet.append(App.svg('sheet'), document.createTextNode('Buka di Sheets'));
    acts.append(sheet);
    if (d.form.dashboard_aktif) {
      const pub = el('a', 'btn');
      pub.href = 'dashboard.html?f=' + encodeURIComponent(d.form.slug); pub.target = '_blank'; pub.rel = 'noopener';
      pub.append(App.svg('chart'), document.createTextNode('Dashboard publik'));
      acts.append(pub);
    }

    const frag = document.createDocumentFragment();

    // Angka ringkas
    const stat = el('section', 'card res-stat');
    [[d.total_aktif, 'jawaban aktif'], [d.total_semua, 'pengiriman'], [d.total_semua - d.total_aktif, 'digantikan']].forEach(function (x) {
      const b = el('div'); b.append(el('strong', '', String(x[0])), el('span', '', x[1])); stat.append(b);
    });
    frag.append(stat);

    // Ringkasan per blok
    if (!d.summary.length) {
      frag.append(el('div', 'empty', 'Form ini belum punya pertanyaan.'));
    } else {
      d.summary.forEach(function (b) {
        const sec = el('section', 'card');
        sec.append(el('h2', '', 'Soal ' + b.no + (b.judul ? ' · ' + b.judul : '') + (b.tersembunyi ? ' (disembunyikan)' : '')));
        b.questions.forEach(function (q) { sec.append(App.charts.question(q, true)); });
        frag.append(sec);
      });
    }

    // Jawaban mentah
    const raw = el('section', 'card');
    raw.append(el('h2', '', 'Jawaban mentah'));
    if (!d.rows.length) {
      raw.append(el('p', 'none', 'Belum ada jawaban.'));
    } else {
      if (d.terpotong) raw.append(el('p', 'help', 'Menampilkan ' + d.rows.length + ' pengiriman terbaru. Untuk semuanya, buka di Sheets.'));
      const wrap = el('div', 'table-wrap');
      const table = el('table', 'raw');
      const thead = el('thead'); const hr = el('tr');
      d.columns.forEach(function (c) { hr.append(el('th', '', c)); });
      thead.append(hr);
      const tbody = el('tbody');
      const statusIdx = d.columns.indexOf('status');
      d.rows.forEach(function (r) {
        const tr = el('tr', statusIdx >= 0 && r[statusIdx] === 'digantikan' ? 'old' : '');
        r.forEach(function (v) { tr.append(el('td', '', v)); });
        tbody.append(tr);
      });
      table.append(thead, tbody);
      wrap.append(table);
      raw.append(wrap);
    }
    frag.append(raw);
    $('resBody').replaceChildren(frag);
  }

  $('resForm').addEventListener('change', function () { loadResults().catch(function (e) { if (e.code !== 'AUTH') A.toast(e.message, true); }); });
  $('resFilter').addEventListener('change', function () { loadResults().catch(function (e) { if (e.code !== 'AUTH') A.toast(e.message, true); }); });
  A.onTab('results', function () { show(); });
  window.addEventListener('open-results', function (e) { show(e.detail); });
})();
