const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../models');
const { berandaRole } = require('../middleware/auth');
const { validasiDataPasien } = require('./helpers');
const { buatAkunPasien } = require('../services/akunPasien');

exports.loginForm = (req, res) => {
  res.render('login', { title: 'Login' });
};

// Login dengan username atau ID pasien (misalnya PSN20260001)
exports.login = async (req, res, next) => {
  try {
    const { password } = req.body;
    const identitas = (req.body.username || '').trim();
    const user = identitas
      ? await User.findOne({ where: { [Op.or]: [{ username: identitas }, { kodePasien: identitas.toUpperCase() }] } })
      : null;

    if (!user || !(await bcrypt.compare(password || '', user.password))) {
      req.flash('error', 'Username/ID pasien atau kata sandi salah.');
      return res.redirect('/login');
    }

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = {
        id: user.id,
        nama: user.nama,
        username: user.username,
        role: user.role,
        wajibGantiPassword: user.wajibGantiPassword,
      };
      if (user.wajibGantiPassword) {
        req.flash('error', 'Demi keamanan, ganti kata sandi awal Anda terlebih dahulu.');
        return res.redirect('/profil');
      }
      req.flash('success', `Selamat datang, ${user.nama}.`);
      res.redirect(berandaRole(user.role));
    });
  } catch (err) {
    next(err);
  }
};

exports.registerForm = (req, res) => {
  res.render('register', { title: 'Daftar Pasien', old: {}, errors: [] });
};

// Registrasi hanya untuk pasien. Akun dokter dan admin dibuat oleh admin.
exports.register = async (req, res, next) => {
  try {
    const nama = (req.body.nama || '').trim();
    const username = (req.body.username || '').trim();
    const { password, konfirmasi, jenisKelamin, tanggalLahir } = req.body;

    const errors = validasiDataPasien({ nama, username, jenisKelamin, tanggalLahir });
    if (!password || password.length < 6) errors.push('Password minimal 6 karakter.');
    if (password !== konfirmasi) errors.push('Konfirmasi password tidak sama.');
    if (!errors.length && (await User.findOne({ where: { username } }))) errors.push('Username sudah digunakan.');

    if (errors.length) {
      return res.status(422).render('register', {
        title: 'Daftar Pasien',
        old: { nama, username, jenisKelamin, tanggalLahir },
        errors,
      });
    }

    const akun = await buatAkunPasien(User, {
      nama,
      username,
      password: await bcrypt.hash(password, 10),
      jenisKelamin,
      tanggalLahir,
    });
    req.flash('success', `Pendaftaran berhasil. ID pasien Anda ${akun.kodePasien}. Silakan login dengan username atau ID pasien.`);
    res.redirect('/login');
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};
