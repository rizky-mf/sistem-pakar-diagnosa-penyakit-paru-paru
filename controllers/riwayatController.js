// Dipakai bersama oleh admin dan dokter (path dasar dari req.baseUrl)
const { Riwayat, detailRiwayat, rincianRiwayat } = require('../models');
const { TINGKAT_KEYAKINAN } = require('../services/certaintyFactor');
const { dataHasil } = require('./helpers');

exports.index = async (req, res, next) => {
  try {
    const riwayat = await Riwayat.findAll(detailRiwayat);
    res.render('riwayat/index', { title: 'Riwayat Diagnosa', riwayat });
  } catch (err) {
    next(err);
  }
};

exports.show = async (req, res, next) => {
  try {
    const riwayat = await Riwayat.findByPk(req.params.id, rincianRiwayat);
    if (!riwayat) return res.redirect(`${req.baseUrl}/riwayat`);
    res.render('diagnosa/hasil', {
      title: 'Detail Riwayat',
      riwayat,
      ...dataHasil(riwayat),
      kembali: `${req.baseUrl}/riwayat`,
      tingkatKeyakinan: TINGKAT_KEYAKINAN,
    });
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
