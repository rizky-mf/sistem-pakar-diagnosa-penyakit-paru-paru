const { Riwayat } = require('../models');

function pesanError(err) {
  if (err.name === 'SequelizeUniqueConstraintError') return 'Kode sudah digunakan, gunakan kode lain.';
  console.error(err);
  return 'Terjadi kesalahan saat menyimpan data.';
}

// Jumlah hasil diagnosa per penyakit, untuk grafik di dashboard
async function distribusiDiagnosa() {
  const semua = await Riwayat.findAll({ attributes: ['hasil'] });
  const hitung = {};
  let tanpaKesimpulan = 0;

  for (const r of semua) {
    const diagnosa = r.hasil.diagnosa;
    if (!diagnosa.length) tanpaKesimpulan++;
    for (const d of diagnosa) hitung[d.nama] = (hitung[d.nama] || 0) + 1;
  }

  const data = Object.entries(hitung)
    .map(([nama, jumlah]) => ({ nama, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah);

  return { data, tanpaKesimpulan, total: semua.length };
}

module.exports = { pesanError, distribusiDiagnosa };
