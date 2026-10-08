const { Penyakit } = require('../../models');
const { pesanError } = require('../helpers');

function ambilInput(body) {
  return {
    kode: (body.kode || '').trim().toUpperCase(),
    nama: (body.nama || '').trim(),
    deskripsi: (body.deskripsi || '').trim(),
    solusi: (body.solusi || '').trim(),
  };
}

function validasi(data) {
  if (!data.kode || !data.nama || !data.deskripsi || !data.solusi) return 'Semua kolom wajib diisi.';
  return null;
}

exports.index = async (req, res, next) => {
  try {
    const penyakit = await Penyakit.findAll({ order: [['kode', 'ASC']] });
    res.render('dokter/penyakit/index', { title: 'Data Penyakit', penyakit });
  } catch (err) {
    next(err);
  }
};

exports.create = (req, res) => {
  res.render('dokter/penyakit/form', { title: 'Tambah Penyakit', item: {}, action: '/dokter/penyakit', method: 'POST' });
};

exports.store = async (req, res) => {
  const data = ambilInput(req.body);
  const error = validasi(data);
  if (error) {
    req.flash('error', error);
    return res.redirect('/dokter/penyakit/tambah');
  }
  try {
    await Penyakit.create(data);
    req.flash('success', 'Penyakit berhasil ditambahkan.');
    res.redirect('/dokter/penyakit');
  } catch (err) {
    req.flash('error', pesanError(err));
    res.redirect('/dokter/penyakit/tambah');
  }
};

exports.edit = async (req, res, next) => {
  try {
    const item = await Penyakit.findByPk(req.params.id);
    if (!item) return res.redirect('/dokter/penyakit');
    res.render('dokter/penyakit/form', {
      title: 'Edit Penyakit',
      item,
      action: `/dokter/penyakit/${item.id}?_method=PUT`,
      method: 'PUT',
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res) => {
  const data = ambilInput(req.body);
  const error = validasi(data);
  if (error) {
    req.flash('error', error);
    return res.redirect(`/dokter/penyakit/${req.params.id}/edit`);
  }
  try {
    await Penyakit.update(data, { where: { id: req.params.id } });
    req.flash('success', 'Penyakit berhasil diperbarui.');
    res.redirect('/dokter/penyakit');
  } catch (err) {
    req.flash('error', pesanError(err));
    res.redirect(`/dokter/penyakit/${req.params.id}/edit`);
  }
};

exports.destroy = async (req, res) => {
  try {
    await Penyakit.destroy({ where: { id: req.params.id } });
    req.flash('success', 'Penyakit beserta aturannya berhasil dihapus.');
  } catch (err) {
    req.flash('error', pesanError(err));
  }
  res.redirect('/dokter/penyakit');
};
