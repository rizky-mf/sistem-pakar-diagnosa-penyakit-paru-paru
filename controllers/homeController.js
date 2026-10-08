const { Penyakit, Gejala, Rule } = require('../models');

exports.index = async (req, res, next) => {
  try {
    const [jumlahPenyakit, jumlahGejala, jumlahRule] = await Promise.all([
      Penyakit.count(),
      Gejala.count(),
      Rule.count(),
    ]);
    res.render('index', { title: 'Beranda', jumlahPenyakit, jumlahGejala, jumlahRule });
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
