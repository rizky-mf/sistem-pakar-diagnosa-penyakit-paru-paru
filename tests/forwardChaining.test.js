const test = require('node:test');
const assert = require('node:assert');
const { forwardChaining, kecocokanParsial } = require('../services/forwardChaining');

const rules = [
  { kode: 'R01', premis: ['G01', 'G02'], konklusi: 'P01' },
  { kode: 'R02', premis: ['G03', 'G04'], konklusi: 'P02' },
  { kode: 'R03', premis: ['P01', 'G05'], konklusi: 'P03' }, // aturan berantai
  { kode: 'R04', premis: [], konklusi: 'P04' }, // aturan kosong diabaikan
];

test('aturan terpenuhi menghasilkan kesimpulan', () => {
  const hasil = forwardChaining(['G01', 'G02'], rules);
  assert.deepStrictEqual(hasil.kesimpulan, ['P01']);
});

test('premis tidak lengkap tidak menghasilkan kesimpulan', () => {
  const hasil = forwardChaining(['G01', 'G03'], rules);
  assert.deepStrictEqual(hasil.kesimpulan, []);
});

test('konklusi dapat menjadi fakta baru untuk aturan berikutnya (chaining)', () => {
  const hasil = forwardChaining(['G05', 'G01', 'G02'], rules);
  assert.deepStrictEqual(hasil.kesimpulan.sort(), ['P01', 'P03']);
  assert.deepStrictEqual(hasil.jejak.map((j) => j.rule), ['R01', 'R03']);
});

test('aturan tanpa premis tidak dieksekusi', () => {
  const hasil = forwardChaining([], rules);
  assert.deepStrictEqual(hasil.kesimpulan, []);
});

test('kecocokan parsial hanya untuk aturan yang belum terpenuhi', () => {
  const parsial = kecocokanParsial(['G01', 'G03'], rules);
  assert.deepStrictEqual(parsial.map((p) => p.rule), ['R01', 'R02']);
  assert.strictEqual(parsial[0].persen, 50);
});
