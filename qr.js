/* SPEGANA — pembuat kode QR di halaman utama (semua diproses di peramban, tidak ada yang dikirim ke server) */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const form = $('qrForm');
  if (!form || !window.QRLib) return;

  const input = $('qrInput');
  const msg = $('qrMsg');
  const out = $('qrOut');
  const canvas = $('qrCanvas');
  const LEVEL = window.QRLib.ErrorCorrectLevel || { L: 1, M: 0, Q: 3, H: 2 };
  let current = null; // { modules, count, text }

  // Teks → byte UTF-8 (pustaka membaca satu karakter = satu byte).
  function utf8(s) { return unescape(encodeURIComponent(s)); }

  function build(text) {
    const data = utf8(text);
    for (let type = 1; type <= 40; type++) {
      try {
        const q = new window.QRLib(type, LEVEL.M);
        q.addData(data);
        q.make();
        return q;
      } catch (e) { /* terlalu panjang untuk ukuran ini, coba yang lebih besar */ }
    }
    return null;
  }

  function normalize(raw) {
    const t = raw.trim();
    // "contoh.com/halaman" tanpa skema → diberi https:// supaya langsung dibuka saat dipindai.
    if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(t) && !/^[a-z][a-z0-9+.-]*:/i.test(t)) return 'https://' + t;
    return t;
  }

  function draw(q, px) {
    const n = q.getModuleCount();
    const quiet = 4;
    const cell = Math.max(1, Math.floor(px / (n + quiet * 2)));
    const size = cell * (n + quiet * 2);
    canvas.width = size; canvas.height = size;
    const c = canvas.getContext('2d');
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, size, size);
    c.fillStyle = '#000000';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect((k + quiet) * cell, (r + quiet) * cell, cell, cell);
  }

  function svgText(q) {
    const n = q.getModuleCount();
    const quiet = 4;
    const total = n + quiet * 2;
    let d = '';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) d += 'M' + (k + quiet) + ' ' + (r + quiet) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" width="1024" height="1024" shape-rendering="crispEdges">' +
      '<rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  function fileBase(text) {
    let name = 'qr-code';
    try { name = 'qr-' + new URL(text).hostname.replace(/^www\./, ''); } catch (e) { /* bukan alamat */ }
    return name.replace(/[^a-z0-9.-]+/gi, '-').slice(0, 40);
  }

  function save(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.textContent = '';
    const text = normalize(input.value);
    if (!text) { msg.textContent = 'Isi dulu link atau teks yang ingin dijadikan QR.'; out.hidden = true; input.focus(); return; }
    if (text.length > 1000) { msg.textContent = 'Terlalu panjang. Maksimal 1000 karakter.'; out.hidden = true; return; }
    const q = build(text);
    if (!q) { msg.textContent = 'Isi terlalu panjang untuk dijadikan QR.'; out.hidden = true; return; }
    current = { q: q, text: text };
    draw(q, 1024);
    $('qrText').textContent = text;
    out.hidden = false;
    if (text !== input.value.trim()) input.value = text;
  });

  $('qrPng').addEventListener('click', function () {
    if (!current) return;
    canvas.toBlob(function (b) { if (b) save(b, fileBase(current.text) + '.png'); }, 'image/png');
  });
  $('qrSvg').addEventListener('click', function () {
    if (!current) return;
    save(new Blob([svgText(current.q)], { type: 'image/svg+xml' }), fileBase(current.text) + '.svg');
  });
  input.addEventListener('input', function () { msg.textContent = ''; });
})();
