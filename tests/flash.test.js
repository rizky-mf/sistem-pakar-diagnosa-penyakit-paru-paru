const test = require('node:test');
const assert = require('node:assert');
const flash = require('../middleware/flash');

function buatReq() {
  const req = { session: {} };
  flash(req, {}, () => {});
  return req;
}

test('pesan tersimpan lalu terhapus setelah dibaca', () => {
  const req = buatReq();
  req.flash('success', 'Tersimpan');
  req.flash('success', 'Lagi');
  assert.deepStrictEqual(req.flash('success'), ['Tersimpan', 'Lagi']);
  assert.deepStrictEqual(req.flash('success'), []);
});

test('tipe pesan dipisahkan', () => {
  const req = buatReq();
  req.flash('error', 'Gagal');
  assert.deepStrictEqual(req.flash('success'), []);
  assert.deepStrictEqual(req.flash('error'), ['Gagal']);
});
