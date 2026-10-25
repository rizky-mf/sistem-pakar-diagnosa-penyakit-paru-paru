const test = require('node:test');
const assert = require('node:assert');
const { jalankanInferensi, barisRiwayat } = require('../services/inferensi');

const rules = [
  { kode: 'R01', premis: ['G01', 'G02'], konklusi: 'P01', cfPakar: { G01: 0.8, G02: 0.6 } },
  { kode: 'R02', premis: ['G03', 'G04'], konklusi: 'P02', cfPakar: { G03: 0.5, G04: 0.5 } },
];

test('hasil inferensi diubah menjadi baris riwayat lengkap', () => {
  const hasil = jalankanInferensi(rules, { G01: 1, G02: 0.5, G03: 0.8 });
  const baris = barisRiwayat(hasil, { P01: 11, P02: 22 });

  // Diurutkan dari CF tertinggi: P01 = 0.8 + 0.3 x (1 - 0.8) = 0.86
  assert.deepStrictEqual(baris.daftarPenyakit.map((p) => p.penyakitId), [11, 22]);
  const p01 = baris.daftarPenyakit[0];
  assert.strictEqual(p01.cf, 0.86);
  assert.strictEqual(p01.ruleKode, 'R01');
  assert.deepStrictEqual([p01.gejalaCocok, p01.gejalaTotal], [2, 2]);
  assert.deepStrictEqual(
    p01.langkah.map((l) => [l.urutan, l.kodeFakta, l.cfKombinasi]),
    [[1, 'G01', 0.8], [2, 'G02', 0.86]]
  );

  // Hanya R01 yang seluruh premisnya terpenuhi
  assert.deepStrictEqual(baris.jejak, [
    { urutan: 1, iterasi: 1, ruleKode: 'R01', konklusiKode: 'P01', premis: [{ urutan: 1, kodeFakta: 'G01' }, { urutan: 2, kodeFakta: 'G02' }] },
  ]);
  assert.strictEqual(baris.jumlahIterasi, hasil.jumlahIterasi);
});

test('penyakit yang tidak dikenal dilewati', () => {
  const baris = barisRiwayat(jalankanInferensi(rules, { G01: 1 }), {});
  assert.deepStrictEqual(baris.daftarPenyakit, []);
});
