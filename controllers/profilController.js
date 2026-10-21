const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../models');
const { validasiDataPasien } = require('./helpers');

function render(res, old, errors = [], status = 200) {
  res.status(status).render('pasien/profil', { title: 'Profil Saya', old, errors });
}

exports.form = async (req, res, next) => {
  try {
    const pasien = await User.findByPk(req.session.user.id);
    render(res, {
      nama: pasien.nama,
      username: pasien.username,
      jenisKelamin: pasien.jenisKelamin,
      tanggalLahir: pasien.tanggalLahir,
    });
  } catch (err) {
    next(err);
  }
};

// Data diri wajib; kata sandi hanya diganti bila kolom kata sandi baru diisi
exports.update = async (req, res, next) => {
  try {
    const pasien = await User.findByPk(req.session.user.id);
    const nama = (req.body.nama || '').trim();
    const username = (req.body.username || '').trim();
    const { jenisKelamin, tanggalLahir, passwordLama, passwordBaru, konfirmasi } = req.body;
    const old = { nama, username, jenisKelamin, tanggalLahir };

    const errors = validasiDataPasien(old);
    if (passwordBaru) {
      if (!(await bcrypt.compare(passwordLama || '', pasien.password))) errors.push('Kata sandi lama salah.');
      if (passwordBaru.length < 6) errors.push('Kata sandi baru minimal 6 karakter.');
      if (passwordBaru !== konfirmasi) errors.push('Konfirmasi kata sandi baru tidak sama.');
    }
    if (!errors.length && (await User.findOne({ where: { username, id: { [Op.ne]: pasien.id } } }))) {
      errors.push('Username sudah digunakan.');
    }
    if (errors.length) return render(res, old, errors, 422);

    const perubahan = { nama, username, jenisKelamin, tanggalLahir };
    if (passwordBaru) perubahan.password = await bcrypt.hash(passwordBaru, 10);
    await pasien.update(perubahan);

    Object.assign(req.session.user, { nama, username });
    req.flash('success', 'Profil berhasil diperbarui.');
    res.redirect('/profil');
  } catch (err) {
    next(err);
  }
};
