/**
 * ID pasien dan kata sandi awal.
 *
 * Setiap pasien mendapat ID otomatis berformat PSN<tahun><nomor urut>, misalnya PSN20260001
 * (hanya huruf dan angka, nomor urut minimal 4 digit per tahun).
 * ID dipakai untuk login (selain username), ditampilkan di profil, riwayat, dan lembar cetak hasil.
 */
const crypto = require('crypto');
const { Op } = require('sequelize');

const PREFIX = 'PSN';
const POLA_KODE = /^PSN\d{8,}$/i;

function formatKode(tahun, nomor) {
  return `${PREFIX}${tahun}${String(nomor).padStart(4, '0')}`;
}

// Nomor urut terbesar dari daftar kode pada tahun yang sama
function nomorTerakhir(kodeList) {
  return kodeList.reduce((maks, kode) => Math.max(maks, Number(String(kode).slice(PREFIX.length + 4)) || 0), 0);
}

async function kodeBerikutnya(User, tahun, transaction) {
  const ada = await User.findAll({
    attributes: ['kodePasien'],
    where: { kodePasien: { [Op.like]: `${PREFIX}${tahun}%` } },
    transaction,
  });
  return formatKode(tahun, nomorTerakhir(ada.map((u) => u.kodePasien)) + 1);
}

// Huruf/angka yang tidak mirip satu sama lain (tanpa 0/O, 1/l/I) agar mudah dibacakan ke pasien
const HURUF = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function buatPasswordAwal(panjang = 8) {
  return Array.from(crypto.randomBytes(panjang), (b) => HURUF[b % HURUF.length]).join('');
}

/**
 * Membuat akun pasien dengan ID otomatis. Bila dua pendaftaran bersamaan mendapat nomor
 * yang sama, indeks unik menolak salah satunya dan nomor dihitung ulang.
 * data.username boleh kosong: username diisi dengan ID pasien.
 */
async function buatAkunPasien(User, data, { percobaan = 5, transaction } = {}) {
  const tahun = new Date().getFullYear();
  for (let i = 1; ; i++) {
    const kodePasien = await kodeBerikutnya(User, tahun, transaction);
    try {
      return await User.create(
        { ...data, role: 'pasien', kodePasien, username: data.username || kodePasien },
        { transaction }
      );
    } catch (err) {
      const pesan = (err.parent && err.parent.sqlMessage) || '';
      const bentrokKode = err.name === 'SequelizeUniqueConstraintError' && pesan.includes('kode_pasien');
      if (!bentrokKode || i >= percobaan) throw err;
    }
  }
}

module.exports = { POLA_KODE, formatKode, nomorTerakhir, kodeBerikutnya, buatPasswordAwal, buatAkunPasien };
