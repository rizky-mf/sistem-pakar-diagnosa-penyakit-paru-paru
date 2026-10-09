const { Penyakit, Gejala, Rule } = require('../models');

exports.index = async (req, res, next) => {
  try {
    const [daftarPenyakit, jumlahGejala, jumlahRule] = await Promise.all([
      Penyakit.findAll({ attributes: ['kode', 'nama'], order: [['kode', 'ASC']] }),
      Gejala.count(),
      Rule.count(),
    ]);
    res.render('index', {
      title: 'Beranda',
      daftarPenyakit,
      jumlahPenyakit: daftarPenyakit.length,
      jumlahGejala,
      jumlahRule,
    });
  } catch (err) {
    next(err);
  }
};

exports.penyakit = async (req, res, next) => {
  try {
    const penyakit = await Penyakit.findAll({ order: [['kode', 'ASC']] });
    res.render('penyakit', { title: 'Info Penyakit', penyakit });
  } catch (err) {
    next(err);
  }
};
