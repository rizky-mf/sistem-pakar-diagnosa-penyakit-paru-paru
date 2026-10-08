// Dipakai bersama oleh admin dan dokter (path dasar dari req.baseUrl)
const { Riwayat } = require('../models');

exports.index = async (req, res, next) => {
  try {
    const riwayat = await Riwayat.findAll({ order: [['createdAt', 'DESC']] });
    res.render('riwayat/index', { title: 'Riwayat Diagnosa', riwayat });
  } catch (err) {
    next(err);
  }
};

exports.show = async (req, res, next) => {
  try {
    const riwayat = await Riwayat.findByPk(req.params.id);
    if (!riwayat) return res.redirect(`${req.baseUrl}/riwayat`);
    res.render('diagnosa/hasil', { title: 'Detail Riwayat', riwayat, kembali: `${req.baseUrl}/riwayat` });
  } catch (err) {
    next(err);
  }
};

exports.destroy = async (req, res) => {
  try {
    await Riwayat.destroy({ where: { id: req.params.id } });
    req.flash('success', 'Riwayat berhasil dihapus.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Gagal menghapus riwayat.');
  }
  res.redirect(`${req.baseUrl}/riwayat`);
};
