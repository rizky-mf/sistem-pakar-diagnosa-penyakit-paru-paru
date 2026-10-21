const { Penyakit } = require('../models');

exports.penyakit = async (req, res, next) => {
  try {
    const penyakit = await Penyakit.findAll({ order: [['kode', 'ASC']] });
    res.render('penyakit', { title: 'Info Penyakit', penyakit });
  } catch (err) {
    next(err);
  }
};
