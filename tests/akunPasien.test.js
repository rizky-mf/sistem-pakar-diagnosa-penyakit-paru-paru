const { test } = require('node:test');
const assert = require('node:assert');
const { POLA_KODE, formatKode, nomorTerakhir, buatPasswordAwal, buatAkunPasien } = require('../services/akunPasien');
const { validasiUsername } = require('../controllers/helpers');

test('formatKode: PSN+tahun+nomor (minimal 4 digit), hanya huruf dan angka', () => {
  assert.strictEqual(formatKode(2026, 1), 'PSN20260001');
  assert.strictEqual(formatKode(2026, 12345), 'PSN202612345');
  assert.ok(POLA_KODE.test('PSN20260001'));
  assert.ok(POLA_KODE.test('psn20260001'));
  assert.ok(!POLA_KODE.test('PSN-2026-0001'));
  assert.ok(!POLA_KODE.test('PSN2026'));
  assert.match(formatKode(2026, 1), /^[A-Z0-9]+$/);
});

test('nomorTerakhir: memakai angka terbesar, bukan urutan teks', () => {
  assert.strictEqual(nomorTerakhir([]), 0);
  assert.strictEqual(nomorTerakhir(['PSN20260009', 'PSN202610000', 'PSN20260010']), 10000);
});

test('buatPasswordAwal: 8 karakter tanpa huruf/angka yang mirip', () => {
  const daftar = Array.from({ length: 200 }, () => buatPasswordAwal());
  for (const p of daftar) {
    assert.strictEqual(p.length, 8);
    assert.match(p, /^[A-HJ-NP-Za-km-z2-9]+$/);
    assert.doesNotMatch(p, /[0O1lI]/);
  }
  assert.ok(new Set(daftar).size > 190, 'kata sandi acak seharusnya hampir selalu berbeda');
});

test('buatAkunPasien: username kosong diisi ID pasien, nomor lanjut dari yang sudah ada', async () => {
  const tahun = new Date().getFullYear();
  const dibuat = [];
  const UserPalsu = {
    findAll: async () => [{ kodePasien: formatKode(tahun, 7) }],
    create: async (data) => (dibuat.push(data), data),
  };
  const akun = await buatAkunPasien(UserPalsu, { nama: 'Budi', password: 'x' });
  assert.strictEqual(akun.kodePasien, formatKode(tahun, 8));
  assert.strictEqual(akun.username, akun.kodePasien);
  assert.strictEqual(akun.role, 'pasien');

  const akun2 = await buatAkunPasien(UserPalsu, { nama: 'Ani', username: 'ani_01', password: 'x' });
  assert.strictEqual(akun2.username, 'ani_01');
});

test('buatAkunPasien: mencoba lagi bila ID bentrok dengan pendaftaran lain', async () => {
  const tahun = new Date().getFullYear();
  const terpakai = [];
  let gagalSekali = true;
  const UserPalsu = {
    findAll: async () => terpakai.map((k) => ({ kodePasien: k })),
    create: async (data) => {
      if (gagalSekali) {
        gagalSekali = false;
        terpakai.push(data.kodePasien); // pendaftaran lain lebih dulu memakai nomor ini
        const err = new Error('duplikat');
        err.name = 'SequelizeUniqueConstraintError';
        err.parent = { sqlMessage: "Duplicate entry 'x' for key 'kode_pasien'" };
        throw err;
      }
      return data;
    },
  };
  const akun = await buatAkunPasien(UserPalsu, { nama: 'Citra', password: 'x' });
  assert.strictEqual(akun.kodePasien, formatKode(tahun, 2));
});

test('validasiUsername: format ID pasien hanya boleh untuk pemiliknya', () => {
  assert.deepStrictEqual(validasiUsername('budi_99'), []);
  assert.strictEqual(validasiUsername('PSN20260001').length, 1);
  assert.deepStrictEqual(validasiUsername('PSN20260001', 'PSN20260001'), []);
  assert.strictEqual(validasiUsername('PSN20260002', 'PSN20260001').length, 1);
  assert.strictEqual(validasiUsername('ab').length, 1);
});
