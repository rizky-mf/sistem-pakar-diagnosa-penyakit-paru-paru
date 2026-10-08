const { Penyakit, Gejala, Rule, Riwayat } = require('../../models');

exports.index = async (req, res, next) => {
  try {
    const [penyakit, gejala, rule, riwayat, terbaru] = await Promise.all([
      Penyakit.count(),
      Gejala.count(),
      Rule.count(),
      Riwayat.count(),
      Riwayat.findAll({ order: [['createdAt', 'DESC']], limit: 5 }),
    ]);
    res.render('dashboard', {
      title: 'Dashboard Dokter',
      kartu: [
        ['Penyakit', penyakit, 'bi-virus', '/dokter/penyakit'],
        ['Gejala', gejala, 'bi-list-check', '/dokter/gejala'],
        ['Aturan', rule, 'bi-diagram-3', '/dokter/rule'],
        ['Riwayat Diagnosa', riwayat, 'bi-clock-history', '/dokter/riwayat'],
      ],
      terbaru,
    });
  } catch (err) {
    next(err);
  }
};
