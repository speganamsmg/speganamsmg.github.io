/* SPEGANA — panel admin: tab Daftar nama */
(function () {
  'use strict';

  const A = window.Admin;
  const el = App.el;
  const $ = function (id) { return document.getElementById(id); };

  function loadingBox() { const b = el('div', 'loading-box'); b.append(el('span', 'spin'), document.createTextNode('Memuat…')); return b; }

  let lists = [];

  async function loadLists() {
    const host = $('namesLists');
    if (!lists.length) host.replaceChildren(loadingBox());
    try {
      await A.swr('admin.names.lists', {}, function (d) { lists = d.lists; renderLists(); });
    } catch (e) {
      if (e.code !== 'AUTH') host.replaceChildren(el('div', 'empty', e.message));
    }
  }

  function renderLists() {
    const host = $('namesLists');
    host.replaceChildren();
    if (!lists.length) {
      const box = el('div', 'empty');
      box.append(el('strong', '', 'Belum ada daftar nama.'), document.createTextNode('Buat daftar bila form meminta responden memilih nama.'));
      host.append(box);
      return;
    }
    lists.forEach(function (l) {
      const card = el('div', 'card fm');
      const top = el('div', 'fm-top');
      const main = el('div', 'row-main');
      main.append(el('div', 'row-title', l.list_id));
      let meta = l.jumlah + ' nama';
      if (l.dari_responden) meta += ' (' + l.dari_responden + ' ditambah responden)';
      main.append(el('div', 'row-meta nowrap-off', meta));
      const used = Array.isArray(l.dipakai_oleh) ? l.dipakai_oleh : [];
      if (used.length) main.append(el('div', 'row-meta nowrap-off', 'Dipakai oleh: ' + used.join(', ')));
      top.append(main);
      const acts = el('div', 'fm-acts');
      const edit = el('button', 'btn btn-primary'); edit.type = 'button';
      edit.append(App.svg('edit'), document.createTextNode('Edit'));
      edit.addEventListener('click', function () { openEditor(l.list_id); });
      const del = el('button', 'btn btn-danger'); del.type = 'button';
      del.append(App.svg('trash'), document.createTextNode('Hapus'));
      del.disabled = used.length > 0;
      del.title = used.length ? 'Masih dipakai form' : '';
      del.addEventListener('click', function () { removeList(l); });
      acts.append(edit, del);
      card.append(top, acts);
      host.append(card);
    });
  }

  async function removeList(l) {
    if (!window.confirm('Hapus daftar "' + l.list_id + '" beserta ' + l.jumlah + ' nama di dalamnya?')) return;
    try {
      lists = (await A.call('admin.names.delete', { list_id: l.list_id })).lists || [];
      renderLists();
      A.toast('Daftar dihapus');
    } catch (e) {
      if (e.code !== 'AUTH') A.toast(e.message, true);
    }
  }

  async function openEditor(listId) {
    const isNew = !listId;
    let names = [];
    if (!isNew) {
      try {
        names = (await A.call('admin.names.get', { list_id: listId })).names;
      } catch (e) {
        if (e.code !== 'AUTH') A.toast(e.message, true);
        return;
      }
    }
    $('namesListView').hidden = true;
    const root = $('namesEditor');
    root.hidden = false;
    root.replaceChildren();

    const head = el('div', 'ed-head');
    const back = el('button', 'btn'); back.type = 'button';
    back.append(App.svg('back'), document.createTextNode('Kembali'));
    head.append(back, el('h2', '', isNew ? 'Daftar baru' : 'Edit daftar'));
    root.append(head);

    const card = el('section', 'card');
    const nameField = el('div', 'field');
    const nameLbl = el('label', '', 'Nama daftar'); nameLbl.htmlFor = 'nlName';
    const nameIn = el('input', 'input'); nameIn.id = 'nlName'; nameIn.maxLength = 60;
    nameIn.value = listId || '';
    nameIn.readOnly = !isNew;
    nameField.append(nameLbl, nameIn);
    if (isNew) nameField.append(el('span', 'help', 'Contoh: Peserta rapat, Guru, Kelas 9A. Tidak bisa diganti setelah dibuat.'));
    card.append(nameField);

    const f2 = el('div', 'field');
    const l2 = el('label', '', 'Daftar nama (satu nama per baris)'); l2.htmlFor = 'nlNames';
    const ta = el('textarea', 'input names-ta'); ta.id = 'nlNames'; ta.rows = 14; ta.spellcheck = false;
    ta.value = names.map(function (n) { return n.nama; }).join('\n');
    const count = el('span', 'help');
    const upd = function () {
      const n = ta.value.split('\n').filter(function (x) { return x.trim(); }).length;
      count.textContent = n + ' nama. Nama yang kembar otomatis digabung. Menghapus nama tidak menghapus jawaban yang sudah masuk.';
    };
    ta.addEventListener('input', upd);
    upd();
    f2.append(l2, ta, count);
    card.append(f2);

    const msg = el('p', 'msg'); msg.setAttribute('role', 'alert');
    const save = el('button', 'btn btn-primary', 'Simpan daftar'); save.type = 'button';
    card.append(msg, save);
    root.append(card);

    const close = function () {
      root.hidden = true; root.replaceChildren();
      $('namesListView').hidden = false;
      loadLists();
    };
    back.addEventListener('click', close);
    save.addEventListener('click', async function () {
      msg.textContent = '';
      A.setBusy(save, true);
      try {
        const d = await A.call('admin.names.save', {
          list_id: nameIn.value, names: ta.value.split('\n'), baru: isNew
        });
        lists = d.lists;
        A.toast('Daftar tersimpan');
        close();
      } catch (e) {
        if (e.code === 'AUTH') return;
        // Balasan server kadang rusak padahal data sudah masuk. Periksa dulu sebelum menyatakan gagal.
        if ((e.code === 'BAD_RESPONSE' || e.code === 'NETWORK') && await savedAnyway(nameIn.value, ta.value)) {
          A.toast('Daftar tersimpan');
          close();
        } else {
          msg.textContent = e.message;
        }
      } finally {
        A.setBusy(save, false);
      }
    });
    (isNew ? nameIn : ta).focus();
  }

  function key(n) { return n.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim(); }

  async function savedAnyway(listId, text) {
    try {
      const want = {};
      text.split('\n').forEach(function (n) { if (n.trim()) want[key(n)] = true; });
      const got = (await A.call('admin.names.get', { list_id: listId })).names;
      const have = {};
      got.forEach(function (n) { if (n.nama) have[key(n.nama)] = true; });
      const a = Object.keys(want), b = Object.keys(have);
      return a.length === b.length && a.every(function (k) { return have[k]; });
    } catch (e) {
      return false;
    }
  }

  $('newList').addEventListener('click', function () { openEditor(''); });
  A.onTab('names', function () { if ($('namesEditor').hidden) loadLists(); });
})();
