const test = require('node:test');
const assert = require('node:assert');
const { forwardChaining } = require('../services/forwardChaining');
const { kombinasi, hitungCFRule, cfKesimpulan, rankingPenyakit, interpretasi } = require('../services/certaintyFactor');

const rules = [
  { kode: 'R01', premis: ['G01', 'G02'], konklusi: 'P01', cfPakar: { G01: 0.8, G02: 0.6 } },
  { kode: 'R02', premis: ['G01', 'G03'], konklusi: 'P01', cfPakar: { G01: 0.4, G03: 0.4 } },
  { kode: 'R03', premis: ['P01', 'G04'], konklusi: 'P02', cfPakar: { P01: 1, G04: 0.5 } },
];

test('rumus kombinasi CF', () => {
  assert.strictEqual(kombinasi(0.5, 0.5), 0.75);
  assert.strictEqual(kombinasi(0, 0.6), 0.6);
});

test('CF aturan = kombinasi dari CF pakar x CF user tiap premis', () => {
  const { cf, langkah } = hitungCFRule(rules[0], { G01: 1, G02: 0.5 });
  // 0.8 x 1 = 0.8 ; 0.6 x 0.5 = 0.3 ; 0.8 + 0.3 x (1 - 0.8) = 0.86
  assert.strictEqual(cf, 0.86);
  assert.deepStrictEqual(langkah.map((l) => l.cfGejala), [0.8, 0.3]);
});

test('premis yang tidak ada di fakta dilewati', () => {
  const { cf, langkah } = hitungCFRule(rules[0], { G01: 0.5 });
  assert.strictEqual(cf, 0.4);
  assert.strictEqual(langkah.length, 1);
});

test('CF pakar kosong dianggap 1', () => {
  const { cf } = hitungCFRule({ kode: 'R', premis: ['G01'], konklusi: 'P' }, { G01: 0.6 });
  assert.strictEqual(cf, 0.6);
});

test('penyakit dari beberapa aturan memakai CF tertinggi, dan CF ikut berantai', () => {
  const cfUser = { G01: 1, G02: 1, G03: 1, G04: 1 };
  const fc = forwardChaining(Object.keys(cfUser), rules);
  const hasil = cfKesimpulan(fc.jejak, rules, cfUser);
  assert.strictEqual(hasil.P01.cf, 0.92); // R01: 0.8 + 0.6 x 0.2
  assert.strictEqual(hasil.P01.rule, 'R01');
  assert.strictEqual(hasil.P02.cf, 0.96); // 0.92 + 0.5 x 0.08
});

test('ranking memuat penyakit dengan gejala cocok sebagian, urut dari CF tertinggi', () => {
  const cfUser = { G01: 1, G03: 1 };
  const fc = forwardChaining(Object.keys(cfUser), rules);
  const ranking = rankingPenyakit(rules, cfUser, fc.jejak);
  // P01 lewat R01 (hanya G01 cocok): 0.8, lebih tinggi dari R02 (lengkap): 0.4 + 0.4 x 0.6 = 0.64
  // P02 lewat R03: P01 hasil forward chaining (CF 0.64 dari R02) x CF pakar 1
  assert.deepStrictEqual(
    ranking.map((r) => [r.konklusi, r.rule, r.cf, r.lengkap]),
    [
      ['P01', 'R01', 0.8, false],
      ['P02', 'R03', 0.64, false],
    ]
  );
});

test('penyakit tanpa gejala cocok tidak masuk ranking', () => {
  const ranking = rankingPenyakit(rules, { G04: 1 }, []);
  assert.deepStrictEqual(ranking.map((r) => [r.konklusi, r.cf]), [['P02', 0.5]]);
});

test('kesimpulan forward chaining ikut menjadi fakta bagi aturan berantai', () => {
  const cfUser = { G01: 1, G02: 1 };
  const fc = forwardChaining(Object.keys(cfUser), rules);
  const p02 = rankingPenyakit(rules, cfUser, fc.jejak).find((r) => r.konklusi === 'P02');
  assert.strictEqual(p02.cf, 0.92); // hanya premis P01 (CF 0.92 x CF pakar 1) yang cocok
  assert.strictEqual(p02.cocok, 1);
});

test('CF sama diurutkan berdasarkan rasio gejala cocok', () => {
  const rulesSeri = [
    { kode: 'R1', premis: ['G01', 'G02', 'G03', 'G04'], konklusi: 'PA' },
    { kode: 'R2', premis: ['G01', 'G02'], konklusi: 'PB' },
  ];
  const ranking = rankingPenyakit(rulesSeri, { G01: 1 }, []);
  assert.deepStrictEqual(ranking.map((r) => r.konklusi), ['PB', 'PA']);
});

test('interpretasi nilai CF', () => {
  assert.strictEqual(interpretasi(0.9), 'Hampir pasti');
  assert.strictEqual(interpretasi(0.45), 'Kemungkinan');
  assert.strictEqual(interpretasi(0.1), 'Tidak pasti');
});
