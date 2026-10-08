const { User, Riwayat } = require('../../models');

exports.index = async (req, res, next) => {
  try {
    const [admin, dokter, pasien, riwayat, terbaru] = await Promise.all([
      User.count({ where: { role: 'admin' } }),
      User.count({ where: { role: 'dokter' } }),
      User.count({ where: { role: 'pasien' } }),
      Riwayat.count(),
      Riwayat.findAll({ order: [['createdAt', 'DESC']], limit: 5 }),
    ]);
    res.render('dashboard', {
      title: 'Dashboard Admin',
      kartu: [
        ['Admin', admin, 'bi-shield-lock', '/admin/user'],
        ['Dokter', dokter, 'bi-person-badge', '/admin/user'],
        ['Pasien', pasien, 'bi-people', '/admin/user'],
        ['Riwayat Diagnosa', riwayat, 'bi-clock-history', '/admin/riwayat'],
      ],
      terbaru,
    });
  } catch (err) {
    next(err);
  }
};
