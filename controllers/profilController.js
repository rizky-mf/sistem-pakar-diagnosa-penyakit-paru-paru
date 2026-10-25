const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../models');
const { validasiDataPasien, validasiUsername } = require('./helpers');
const { berandaRole } = require('../middleware/auth');

// Pasien mengisi data diri lengkap; dokter dan admin cukup nama dan username
function render(req, res, akun, old, errors = [], status = 200) {
  const role = req.session.user.role;
  res.status(status).render('profil', {
    title: 'Profil Saya',
    old,
    errors,
    dataPasien: role === 'pasien',
    kodePasien: akun.kodePasien,
    wajibGanti: akun.wajibGantiPassword,
    kembali: berandaRole(role),
  });
}

exports.form = async (req, res, next) => {
  try {
    const akun = await User.findByPk(req.session.user.id);
    render(req, res, akun, {
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
      errors = validasiDataPasien(old, akun.kodePasien);
    } else {
      errors = [];
      if (!nama) errors.push('Nama wajib diisi.');
      errors.push(...validasiUsername(username));
    }
    if (akun.wajibGantiPassword && !passwordBaru) errors.push('Kata sandi baru wajib diisi untuk mengganti kata sandi awal.');
    if (passwordBaru) {
      // Akun dari admin baru saja login dengan kata sandi awal, jadi kata sandi lama tidak diminta lagi
      if (!akun.wajibGantiPassword && !(await bcrypt.compare(passwordLama || '', akun.password))) {
        errors.push('Kata sandi lama salah.');
      } else if (await bcrypt.compare(passwordBaru, akun.password)) {
        errors.push('Kata sandi baru harus berbeda dari kata sandi sebelumnya.');
      }
      if (passwordBaru.length < 6) errors.push('Kata sandi baru minimal 6 karakter.');
      if (passwordBaru !== konfirmasi) errors.push('Konfirmasi kata sandi baru tidak sama.');
    }
    if (!errors.length && (await User.findOne({ where: { username, id: { [Op.ne]: akun.id } } }))) {
      errors.push('Username sudah digunakan.');
    }
    if (errors.length) return render(req, res, akun, old, errors, 422);

    const perubahan = pasien ? { nama, username, jenisKelamin, tanggalLahir } : { nama, username };
    if (passwordBaru) {
      perubahan.password = await bcrypt.hash(passwordBaru, 10);
      perubahan.wajibGantiPassword = false;
    }
    const tadinyaWajib = akun.wajibGantiPassword;
    await akun.update(perubahan);

    Object.assign(req.session.user, { nama, username, wajibGantiPassword: akun.wajibGantiPassword });
    if (tadinyaWajib) {
      req.flash('success', 'Kata sandi berhasil diganti. Selamat menggunakan SiPakar Paru.');
      return res.redirect(berandaRole(akun.role));
    }
    req.flash('success', 'Profil berhasil diperbarui.');
    res.redirect('/profil');
  } catch (err) {
    next(err);
  }
};
