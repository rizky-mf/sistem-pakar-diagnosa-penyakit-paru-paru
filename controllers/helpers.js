const { Penyakit, Gejala, Rule, Riwayat, RiwayatPenyakit, detailRiwayat } = require('../models');
const { POLA_KODE } = require('../services/akunPasien');

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
 * Menyusun data halaman hasil dari riwayat (dimuat dengan rincianRiwayat).
 * Seluruh angka dibaca dari data yang disimpan saat diagnosa (tidak dihitung
 * ulang), sehingga hasil lama tetap sama walaupun basis aturan sudah berubah.
 */
function dataHasil(riwayat) {
  const lengkapi = (p) => ({
    kode: p.kode,
    nama: p.nama,
    deskripsi: p.deskripsi,
    solusi: p.solusi,
    cf: p.cf,
    persen: p.persen,
    interpretasi: p.interpretasi,
    rule: p.ruleKode,
    cocok: p.gejalaCocok,
    total: p.gejalaTotal,
    langkah: (p.langkah || []).map((l) => ({
      kode: l.kodeFakta,
      cfPakar: l.cfPakar,
      cfUser: l.cfUser,
      cfGejala: l.cfGejala,
      cfKombinasi: l.cfKombinasi,
    })),
  });

  return {
    diagnosa: riwayat.diagnosa.map(lengkapi),
    lainnya: riwayat.lainnya.map(lengkapi),
    jejak: (riwayat.jejak || []).map((j) => ({
      iterasi: j.iterasi,
      rule: j.ruleKode,
      konklusi: j.konklusiKode,
      premis: (j.premis || []).map((p) => p.kodeFakta),
    })),
    jumlahIterasi: riwayat.jumlahIterasi,
  };
}

// Validasi data diri pasien, dipakai saat registrasi dan edit profil
// Data diri pasien tanpa username (dipakai juga saat admin membuat akun pasien)
function validasiDiriPasien({ nama, jenisKelamin, tanggalLahir }) {
  const errors = [];
  if (!nama) errors.push('Nama wajib diisi.');
  if (!['L', 'P'].includes(jenisKelamin)) errors.push('Jenis kelamin wajib dipilih.');
  const lahir = new Date(tanggalLahir);
  if (!tanggalLahir || isNaN(lahir) || lahir > new Date()) errors.push('Tanggal lahir tidak valid.');
  return errors;
}

/**
 * Username 4-50 karakter. Format ID pasien (PSN + angka) hanya boleh dipakai
 * sebagai username oleh pemilik ID itu sendiri, agar login dengan ID tidak ambigu.
 */
function validasiUsername(username, kodeMilikSendiri = null) {
  const errors = [];
  const milikSendiri = kodeMilikSendiri && username.toUpperCase() === kodeMilikSendiri.toUpperCase();
  if (POLA_KODE.test(username)) {
    if (!milikSendiri) errors.push('Username tidak boleh berformat ID pasien (PSN diikuti angka).');
  } else if (!/^[a-zA-Z0-9_.]{4,50}$/.test(username)) {
    errors.push('Username 4-50 karakter (huruf, angka, titik, garis bawah).');
  }
  return errors;
}

function validasiDataPasien({ nama, username, jenisKelamin, tanggalLahir }, kodeMilikSendiri = null) {
  return [...validasiDiriPasien({ nama, jenisKelamin, tanggalLahir }), ...validasiUsername(username, kodeMilikSendiri)];
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

module.exports = {
  pesanError,
  muatRules,
  dataHasil,
  validasiDiriPasien,
  validasiUsername,
  validasiDataPasien,
  distribusiDiagnosa,
  terbaruRiwayat,
};
