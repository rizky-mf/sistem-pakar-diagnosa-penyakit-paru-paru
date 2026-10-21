const { Penyakit, Gejala, Rule, Riwayat, RiwayatPenyakit, detailRiwayat } = require('../models');
const { forwardChaining } = require('../services/forwardChaining');
const { rankingPenyakit } = require('../services/certaintyFactor');

function pesanError(err) {
  if (err.name === 'SequelizeUniqueConstraintError') return 'Kode sudah digunakan, gunakan kode lain.';
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return 'Data tidak dapat dihapus karena sudah dipakai pada riwayat diagnosa pasien.';
  }
  console.error(err);
  return 'Terjadi kesalahan saat menyimpan data.';
}

// Mengubah aturan dari database menjadi format yang dipahami mesin inferensi
async function muatRules() {
  const ruleList = await Rule.findAll({
    include: [Penyakit, Gejala],
    order: [['kode', 'ASC']],
  });
  return ruleList.map((r) => ({
    kode: r.kode,
    premis: r.gejalas.map((g) => g.kode).sort(),
    konklusi: r.penyakit.kode,
    cfPakar: Object.fromEntries(r.gejalas.map((g) => [g.kode, g.rule_gejala.cf])),
  }));
}

/**
 * Menyusun data halaman hasil dari riwayat (dimuat dengan detailRiwayat).
 * Jejak forward chaining dan langkah perhitungan CF dihitung ulang dari
 * gejala & CF user yang tersimpan, memakai basis aturan saat ini.
 */
async function dataHasil(riwayat) {
  const rules = await muatRules();
  const cfUser = Object.fromEntries(riwayat.daftarGejala.map((g) => [g.kode, g.cfUser]));
  const fc = forwardChaining(Object.keys(cfUser), rules);
  const rincian = Object.fromEntries(rankingPenyakit(rules, cfUser, fc.jejak).map((r) => [r.konklusi, r]));

  const lengkapi = (p) => {
    const r = rincian[p.kode] || {};
    return {
      kode: p.kode,
      nama: p.nama,
      deskripsi: p.deskripsi,
      solusi: p.solusi,
      cf: p.cf,
      persen: p.persen,
      interpretasi: p.interpretasi,
      rule: r.rule,
      cocok: r.cocok,
      total: r.total,
      langkah: r.langkah || [],
    };
  };

  return {
    diagnosa: riwayat.diagnosa.map(lengkapi),
    lainnya: riwayat.lainnya.map(lengkapi),
    jejak: fc.jejak,
    jumlahIterasi: fc.jumlahIterasi,
  };
}

// Validasi data diri pasien, dipakai saat registrasi dan edit profil
function validasiDataPasien({ nama, username, jenisKelamin, tanggalLahir }) {
  const errors = [];
  if (!nama) errors.push('Nama wajib diisi.');
  if (!/^[a-zA-Z0-9_.]{4,50}$/.test(username)) errors.push('Username 4-50 karakter (huruf, angka, titik, garis bawah).');
  if (!['L', 'P'].includes(jenisKelamin)) errors.push('Jenis kelamin wajib dipilih.');
  const lahir = new Date(tanggalLahir);
  if (!tanggalLahir || isNaN(lahir) || lahir > new Date()) errors.push('Tanggal lahir tidak valid.');
  return errors;
}

// Jumlah hasil diagnosa (penyakit utama) per penyakit, untuk grafik di dashboard
async function distribusiDiagnosa() {
  const [hasil, total] = await Promise.all([
    RiwayatPenyakit.findAll({
      include: [{ model: Penyakit, attributes: ['nama'] }],
      order: [['cf', 'DESC'], ['id', 'ASC']],
    }),
    Riwayat.count(),
  ]);

  // Hasil diagnosa setiap riwayat = penyakit dengan CF tertinggi (baris pertama per riwayat)
  const hitung = {};
  const sudah = new Set();
  for (const h of hasil) {
    if (sudah.has(h.riwayatId)) continue;
    sudah.add(h.riwayatId);
    hitung[h.nama] = (hitung[h.nama] || 0) + 1;
  }

  const data = Object.entries(hitung)
    .map(([nama, jumlah]) => ({ nama, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah);

  return { data, tanpaKesimpulan: total - sudah.size, total };
}

// Riwayat diagnosa terbaru beserta detailnya, untuk dashboard
function terbaruRiwayat(limit) {
  return Riwayat.findAll({ ...detailRiwayat, limit });
}

module.exports = { pesanError, muatRules, dataHasil, validasiDataPasien, distribusiDiagnosa, terbaruRiwayat };
