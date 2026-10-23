/* SPEGANA — Game BK: perangkat bersama untuk semua game (tema, info "Tentang game", kunci password).
 * Dipakai setiap game dengan:  <script src="config.js"></script><script src="gamekit.js"></script>
 * Syarat game: pakai variabel CSS --ink, --muted, --line, --cy (aksen), --panel (latar kartu) agar kotak password ikut tema.
 * Tema memakai kunci 'tema' yang sama dengan seluruh situs Speganam (light | dark; belum dipilih = ikut sistem).
 */
(function () {
  'use strict';
  var GK = window.GameKit = window.GameKit || {};
  var API = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || '';

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* abaikan */ } }

  /* ---------------- TEMA ---------------- */
  function resolve(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function apply(pref) {
    var t = resolve(pref);
    document.documentElement.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'light' ? '#eef3ff' : '#050816');
    document.querySelectorAll('[data-gk-theme]').forEach(function (b) {
      b.textContent = t === 'light' ? '🌙 Gelap' : '☀ Terang';
      b.setAttribute('aria-label', t === 'light' ? 'Ganti ke tema gelap' : 'Ganti ke tema terang');
    });
  }
  GK.theme = {
    apply: function () { apply(lsGet('tema')); },
    current: function () { return document.documentElement.getAttribute('data-theme') || resolve(lsGet('tema')); },
    toggle: function () {
      var next = GK.theme.current() === 'light' ? 'dark' : 'light';
      lsSet('tema', next); apply(next);
      document.dispatchEvent(new CustomEvent('gk-theme', { detail: next }));
    }
  };
  apply(lsGet('tema'));
  if (window.matchMedia) {
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { if (!lsGet('tema')) apply(null); });
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-gk-theme]').forEach(function (b) { b.addEventListener('click', GK.theme.toggle); });
    apply(lsGet('tema'));
  });

  /* ---------------- API ---------------- */
  function err(msg, code) { var e = new Error(msg); e.code = code || 'ERROR'; return e; }
  async function call(req, post) {
    if (!API) throw err('Alamat server (config.js) belum diisi.', 'CONFIG');
    var res;
    try {
      res = post
        ? await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req) })
        : await fetch(API + '?' + new URLSearchParams(Object.assign({}, req, { t: Date.now() })), { cache: 'no-store' });
    } catch (e) { throw err('Tidak bisa terhubung ke server. Periksa koneksi internet.', 'NETWORK'); }
    var j;
    try { j = JSON.parse(await res.text()); } catch (e) { throw err('Server membalas dengan format yang tidak dikenal.', 'BAD_RESPONSE'); }
    if (!j.ok) throw err(j.error || 'Terjadi kesalahan.', j.code || 'ERROR');
    return j.data;
  }

  /* ---------------- KUNCI PASSWORD (password admin Speganam) ---------------- */
  var CSS = '' +
    '.gk-ov{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(2,4,18,.7);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);font-family:inherit}' +
    '.gk-box{width:min(420px,100%);border-radius:22px;padding:22px;background:var(--panel,#10183f);color:var(--ink,#e8efff);border:1px solid var(--cy,#22d3ee);box-shadow:0 24px 70px -10px rgba(0,0,0,.6)}' +
    '.gk-box h2{margin:0 0 6px;font-size:20px}.gk-box p{margin:0 0 12px;font-size:14.5px;line-height:1.5;color:var(--muted,#93a4cf)}' +
    '.gk-pw{display:flex;gap:6px}.gk-pw input{flex:1;min-width:0;font:inherit;font-size:16px;padding:11px 13px;border-radius:12px;border:1px solid var(--line,#456);background:transparent;color:inherit}' +
    '.gk-pw button,.gk-act button{font:inherit;font-weight:800;cursor:pointer;border-radius:12px;border:1px solid var(--line,#456);background:transparent;color:inherit;padding:10px 14px}' +
    '.gk-act{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.gk-act .gk-ok{background:var(--cy,#22d3ee);color:#04111f;border-color:transparent}' +
    '.gk-act button:disabled{opacity:.55;cursor:wait}.gk-msg{min-height:20px;margin-top:8px;font-size:13.5px;color:#f43f5e;font-weight:700}';
  function injectCss() {
    if (document.getElementById('gk-css')) return;
    var s = document.createElement('style'); s.id = 'gk-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function prompt(o) {
    injectCss();
    return new Promise(function (resolveP) {
      var ov = document.createElement('div'); ov.className = 'gk-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      ov.innerHTML = '<form class="gk-box"><h2></h2><p></p><div class="gk-pw"><input type="password" autocomplete="off" maxlength="64" aria-label="Password" placeholder="Password admin"><button type="button" aria-label="Tampilkan password">👁</button></div><div class="gk-msg" role="alert"></div><div class="gk-act"><button type="button" class="gk-cancel">Batal</button><button type="submit" class="gk-ok">Buka kunci</button></div></form>';
      ov.querySelector('h2').textContent = o.title || '🔒 Info game dikunci';
      ov.querySelector('p').textContent = o.text || 'Masukkan password admin Speganam untuk mengubah info game.';
      var form = ov.firstChild, inp = form.querySelector('input'), msg = form.querySelector('.gk-msg'), ok = form.querySelector('.gk-ok');
      function close(v) { document.removeEventListener('keydown', key, true); ov.remove(); resolveP(v); }
      function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(null); } }
      document.addEventListener('keydown', key, true);
      form.querySelector('.gk-pw button').addEventListener('click', function () { inp.type = inp.type === 'password' ? 'text' : 'password'; });
      form.querySelector('.gk-cancel').addEventListener('click', function () { close(null); });
      ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(null); });
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!inp.value) { msg.textContent = 'Isi password dulu.'; return; }
        ok.disabled = true; ok.textContent = 'Memeriksa…'; msg.textContent = '';
        try { close(await o.submit(inp.value)); }
        catch (x) { msg.textContent = x.message || 'Password salah.'; ok.disabled = false; ok.textContent = 'Buka kunci'; inp.select(); }
      });
      document.body.appendChild(ov); inp.focus();
    });
  }
  GK.auth = {
    token: function () { return ssGet('gk_tok'); },
    drop: function () { ssSet('gk_tok', null); },
    // Mengembalikan token bila sudah/ berhasil dibuka, null bila dibatalkan.
    ensure: async function (opt) {
      if (GK.auth.token()) return GK.auth.token();
      var t = await prompt(Object.assign({}, opt, {
        submit: async function (pw) {
          var d = await call({ action: 'login', password: pw }, true);
          if (!d || !d.token) throw err('Login gagal.');
          return d.token;
        }
      }));
      if (t) ssSet('gk_tok', t);
      return t;
    }
  };

  /* ---------------- INFO GAME ---------------- */
  // Panggilan admin dengan token; sesi habis => minta password lagi satu kali.
  async function adminCall(action, payload, dlg) {
    for (var n = 0; n < 2; n++) {
      var tok = await GK.auth.ensure(dlg);
      if (!tok) throw err('Penyimpanan dibatalkan.', 'CANCEL');
      try { return await call(Object.assign({ action: action, token: tok }, payload), true); }
      catch (e) { if (e.code === 'AUTH') { GK.auth.drop(); continue; } throw e; }
    }
    throw err('Sesi berakhir. Coba lagi.', 'AUTH');
  }
  /* ---------------- PENGATURAN GAME (soal, papan, aturan) ---------------- */
  GK.conf = {
    // { conf: objek|null, error?: Error }. null = belum pernah disimpan ke server.
    load: async function (id) {
      try { var d = await call({ action: 'gameconfig', id: id }, false); return { conf: d && d.conf || null }; }
      catch (e) { return { conf: null, error: e }; }
    },
    save: function (id, conf) {
      return adminCall('admin.game.saveconfig', { id: id, conf: conf }, { title: '🔒 Simpan pengaturan', text: 'Masukkan password admin Speganam agar pengaturan tersimpan di server dan dipakai di semua perangkat.' });
    }
  };

  var KEY = function (id) { return 'gk_info_' + id; };
  function merge(defaults, got) {
    var out = JSON.parse(JSON.stringify(defaults));
    if (got && typeof got === 'object') Object.keys(out).forEach(function (k) { if (got[k] !== undefined && got[k] !== null) out[k] = got[k]; });
    return out;
  }
  GK.info = {
    // Salinan terakhir yang pernah dimuat dari server (dipakai langsung agar tampil cepat dan tetap ada saat offline).
    cached: function (id, defaults) {
      var raw = lsGet(KEY(id)), o = null;
      try { o = raw ? JSON.parse(raw) : null; } catch (e) { o = null; }
      return merge(defaults, o);
    },
    // Ambil dari server. Gagal/belum ada => isi bawaan atau salinan terakhir.
    load: async function (id, defaults) {
      try {
        var d = await call({ action: 'gameinfo', id: id }, false);
        if (d && d.info) { lsSet(KEY(id), JSON.stringify(d.info)); return { info: merge(defaults, d.info), from: 'server' }; }
        return { info: GK.info.cached(id, defaults), from: 'default' };
      } catch (e) {
        return { info: GK.info.cached(id, defaults), from: 'offline', error: e };
      }
    },
    // Simpan ke server. Perlu token admin; sesi habis => minta password lagi satu kali.
    save: async function (id, info) {
      var d = await adminCall('admin.game.save', { id: id, info: info }, { title: '🔒 Simpan info game', text: 'Masukkan password admin Speganam untuk menyimpan perubahan.' });
      lsSet(KEY(id), JSON.stringify(d.info));
      return d.info;
    }
  };
})();
