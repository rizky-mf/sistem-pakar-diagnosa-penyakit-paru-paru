const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../models');
const { validasiDataPasien } = require('./helpers');
const { berandaRole } = require('../middleware/auth');

// Pasien mengisi data diri lengkap; dokter dan admin cukup nama dan username
function render(req, res, old, errors = [], status = 200) {
  const role = req.session.user.role;
  res.status(status).render('profil', {
    title: 'Profil Saya',
    old,
    errors,
    dataPasien: role === 'pasien',
    kembali: berandaRole(role),
  });
}

exports.form = async (req, res, next) => {
  try {
    const akun = await User.findByPk(req.session.user.id);
    render(req, res, {
      nama: akun.nama,
      username: akun.username,
      jenisKelamin: akun.jenisKelamin,
      tanggalLahir: akun.tanggalLahir,
    });
  } catch (err) {
    next(err);
  }
};

// Data diri wajib; kata sandi hanya diganti bila kolom kata sandi baru diisi
exports.update = async (req, res, next) => {
  try {
    const akun = await User.findByPk(req.session.user.id);
    const pasien = akun.role === 'pasien';
    const nama = (req.body.nama || '').trim();
    const username = (req.body.username || '').trim();
    const { jenisKelamin, tanggalLahir, passwordLama, passwordBaru, konfirmasi } = req.body;
    const old = { nama, username, jenisKelamin, tanggalLahir };

    let errors;
    if (pasien) {
      errors = validasiDataPasien(old);
    } else {
      errors = [];
      if (!nama) errors.push('Nama wajib diisi.');
      if (!/^[a-zA-Z0-9_.]{4,50}$/.test(username)) errors.push('Username 4-50 karakter (huruf, angka, titik, garis bawah).');
    }
    if (passwordBaru) {
      if (!(await bcrypt.compare(passwordLama || '', akun.password))) errors.push('Kata sandi lama salah.');
      if (passwordBaru.length < 6) errors.push('Kata sandi baru minimal 6 karakter.');
      if (passwordBaru !== konfirmasi) errors.push('Konfirmasi kata sandi baru tidak sama.');
    }
    if (!errors.length && (await User.findOne({ where: { username, id: { [Op.ne]: akun.id } } }))) {
      errors.push('Username sudah digunakan.');
    }
    if (errors.length) return render(req, res, old, errors, 422);

    const perubahan = pasien ? { nama, username, jenisKelamin, tanggalLahir } : { nama, username };
    if (passwordBaru) perubahan.password = await bcrypt.hash(passwordBaru, 10);
    await akun.update(perubahan);

    Object.assign(req.session.user, { nama, username });
    req.flash('success', 'Profil berhasil diperbarui.');
    res.redirect('/profil');
  } catch (err) {
    next(err);
  }
};
