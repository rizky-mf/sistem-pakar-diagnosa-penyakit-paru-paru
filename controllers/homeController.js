const { Penyakit } = require('../models');
const kontak = require('../config/kontak');

exports.kontak = (req, res) => {
  res.render('kontak', { title: 'Kontak Kami', kontak });
};

exports.penyakit = async (req, res, next) => {
  try {
    const penyakit = await Penyakit.findAll({ order: [['kode', 'ASC']] });
    res.render('penyakit', { title: 'Info Penyakit', penyakit });
  } catch (err) {
    next(err);
  }
};
