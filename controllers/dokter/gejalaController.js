const { Gejala } = require('../../models');
const { pesanError } = require('../helpers');
const usulan = require('./usulanController');

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

exports.ambilInput = ambilInput;
exports.validasi = validasi;

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

// Ketua menyimpan langsung; dokter lain mengirim usulan untuk divalidasi ketua
exports.store = async (req, res) => {
  const data = ambilInput(req.body);
  const error = validasi(data) || ((await usulan.kodeDipakai('gejala', data.kode)) && 'Kode sudah digunakan, gunakan kode lain.');
  if (error) {
    req.flash('error', error);
    return res.redirect('/dokter/gejala/tambah');
  }
  try {
    if (req.isKetua) {
      await Gejala.create(data);
      req.flash('success', 'Gejala berhasil ditambahkan.');
      return res.redirect('/dokter/gejala');
    }
    await usulan.ajukan('gejala', data, null, req.session.user.id);
    req.flash('success', 'Usulan gejala dikirim ke dokter ketua untuk divalidasi.');
    res.redirect('/dokter/usulan');
  } catch (err) {
    req.flash('error', pesanError(err));
    res.redirect('/dokter/gejala/tambah');
  }
};

exports.edit = async (req, res, next) => {
  try {
    const item = await Gejala.findByPk(req.params.id);
    if (!item) return res.redirect('/dokter/gejala');
    // Dokter yang masih punya usulan untuk data ini melanjutkan usulannya
    const aktif = req.isKetua ? null : await usulan.usulanAktif('gejala', item.id, req.session.user.id);
    res.render('dokter/gejala/form', {
      title: 'Edit Gejala',
      item: aktif || item,
      action: `/dokter/gejala/${item.id}?_method=PUT`,
      usulan: aktif,
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res) => {
  const data = ambilInput(req.body);
  const id = Number(req.params.id);
  const error = validasi(data) || ((await usulan.kodeDipakai('gejala', data.kode, id)) && 'Kode sudah digunakan, gunakan kode lain.');
  if (error) {
    req.flash('error', error);
    return res.redirect(`/dokter/gejala/${id}/edit`);
  }
  try {
    if (!(await Gejala.findByPk(id))) return res.redirect('/dokter/gejala');
    if (req.isKetua) {
      await Gejala.update(data, { where: { id } });
      req.flash('success', 'Gejala berhasil diperbarui.');
      return res.redirect('/dokter/gejala');
    }
    await usulan.ajukan('gejala', data, id, req.session.user.id);
    req.flash('success', 'Usulan perubahan dikirim ke dokter ketua. Data lama tetap dipakai sampai disetujui.');
    res.redirect('/dokter/usulan');
  } catch (err) {
    req.flash('error', pesanError(err));
    res.redirect(`/dokter/gejala/${id}/edit`);
  }
};

// Data yang sudah disetujui hanya dapat dihapus ketua
exports.destroy = async (req, res) => {
  if (!req.isKetua) {
    req.flash('error', 'Hanya dokter ketua yang dapat menghapus data yang sudah disetujui.');
    return res.redirect('/dokter/gejala');
  }
  try {
    await Gejala.destroy({ where: { id: req.params.id } });
    req.flash('success', 'Gejala berhasil dihapus. Periksa kembali aturan yang menggunakan gejala ini.');
  } catch (err) {
    req.flash('error', pesanError(err));
  }
  res.redirect('/dokter/gejala');
};
