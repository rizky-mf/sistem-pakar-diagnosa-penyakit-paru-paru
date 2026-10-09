const { Penyakit, Gejala, Rule, Riwayat } = require('../../models');
const { distribusiDiagnosa } = require('../helpers');

exports.index = async (req, res, next) => {
  try {
    const [penyakit, gejala, rule, riwayat, terbaru, distribusi] = await Promise.all([
      Penyakit.count(),
      Gejala.count(),
      Rule.count(),
      Riwayat.count(),
      Riwayat.findAll({ order: [['createdAt', 'DESC']], limit: 5 }),
      distribusiDiagnosa(),
    ]);
    res.render('dashboard', {
      title: 'Dashboard',
      // [label, nilai, ikon, link, warna]
      kartu: [
        ['Penyakit', penyakit, 'bi-virus', '/dokter/penyakit', 'tone-teal'],
        ['Gejala', gejala, 'bi-list-check', '/dokter/gejala', 'tone-sky'],
        ['Aturan', rule, 'bi-diagram-3', '/dokter/rule', 'tone-violet'],
        ['Total diagnosa', riwayat, 'bi-clipboard2-pulse', '/dokter/riwayat', 'tone-amber'],
      ],
      terbaru,
      distribusi,
    });
  } catch (err) {
    next(err);
  }
};
