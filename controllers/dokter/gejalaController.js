const { Gejala } = require('../../models');
const { pesanError } = require('../helpers');
const { kodeDipakai } = require('../../services/basisPengetahuan');

function ambilInput(body) {
  return {
    kode: (body.kode || '').trim().toUpperCase(),
    nama: (body.nama || '').trim(),
  };
}

function validasi(data) {
  if (!data.kode || !data.nama) return 'Kode dan nama gejala wajib diisi.';
  return null;
}

exports.index = async (req, res, next) => {
  try {
    const gejala = await Gejala.findAll({ order: [['kode', 'ASC']] });
    res.render('dokter/gejala/index', { title: 'Data Gejala', gejala });
  } catch (err) {
    next(err);
  }
};

exports.create = (req, res) => {
  res.render('dokter/gejala/form', { title: 'Tambah Gejala', item: {}, action: '/dokter/gejala' });
};

exports.store = async (req, res) => {
  const data = ambilInput(req.body);
  const error = validasi(data) || ((await kodeDipakai(Gejala, data.kode)) && 'Kode sudah digunakan, gunakan kode lain.');
  if (error) {
    req.flash('error', error);
    return res.redirect('/dokter/gejala/tambah');
  }
  try {
    await Gejala.create(data);
    req.flash('success', 'Gejala berhasil ditambahkan.');
    res.redirect('/dokter/gejala');
  } catch (err) {
    req.flash('error', pesanError(err));
    res.redirect('/dokter/gejala/tambah');
  }
};

exports.edit = async (req, res, next) => {
  try {
    const item = await Gejala.findByPk(req.params.id);
    if (!item) return res.redirect('/dokter/gejala');
    res.render('dokter/gejala/form', { title: 'Edit Gejala', item, action: `/dokter/gejala/${item.id}?_method=PUT` });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res) => {
  const data = ambilInput(req.body);
  const id = Number(req.params.id);
  const error = validasi(data) || ((await kodeDipakai(Gejala, data.kode, id)) && 'Kode sudah digunakan, gunakan kode lain.');
  if (error) {
    req.flash('error', error);
    return res.redirect(`/dokter/gejala/${id}/edit`);
  }
  try {
    if (!(await Gejala.findByPk(id))) return res.redirect('/dokter/gejala');
    await Gejala.update(data, { where: { id } });
    req.flash('success', 'Gejala berhasil diperbarui.');
    res.redirect('/dokter/gejala');
  } catch (err) {
    req.flash('error', pesanError(err));
    res.redirect(`/dokter/gejala/${id}/edit`);
  }
};

exports.destroy = async (req, res) => {
  try {
    await Gejala.destroy({ where: { id: req.params.id } });
    req.flash('success', 'Gejala berhasil dihapus. Periksa kembali aturan yang menggunakan gejala ini.');
  } catch (err) {
    req.flash('error', pesanError(err));
  }
  res.redirect('/dokter/gejala');
};
