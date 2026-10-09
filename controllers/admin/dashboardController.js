const { User, Riwayat } = require('../../models');
const { distribusiDiagnosa } = require('../helpers');

exports.index = async (req, res, next) => {
  try {
    const [admin, dokter, pasien, riwayat, terbaru, distribusi] = await Promise.all([
      User.count({ where: { role: 'admin' } }),
      User.count({ where: { role: 'dokter' } }),
      User.count({ where: { role: 'pasien' } }),
      Riwayat.count(),
      Riwayat.findAll({ order: [['createdAt', 'DESC']], limit: 5 }),
      distribusiDiagnosa(),
    ]);
    res.render('dashboard', {
      title: 'Dashboard',
      // [label, nilai, ikon, link, warna]
      kartu: [
        ['Pasien terdaftar', pasien, 'bi-people', '/admin/user', 'tone-sky'],
        ['Dokter', dokter, 'bi-person-badge', '/admin/user', 'tone-teal'],
        ['Admin', admin, 'bi-shield-lock', '/admin/user', 'tone-rose'],
        ['Total diagnosa', riwayat, 'bi-clipboard2-pulse', '/admin/riwayat', 'tone-violet'],
      ],
      terbaru,
      distribusi,
    });
  } catch (err) {
    next(err);
  }
};
