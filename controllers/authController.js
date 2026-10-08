const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { berandaRole } = require('../middleware/auth');

exports.loginForm = (req, res) => {
  res.render('login', { title: 'Login' });
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username: (username || '').trim() } });

    if (!user || !(await bcrypt.compare(password || '', user.password))) {
      req.flash('error', 'Username atau password salah.');
      return res.redirect('/login');
    }

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: user.id, nama: user.nama, username: user.username, role: user.role };
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

    const errors = [];
    if (!nama) errors.push('Nama wajib diisi.');
    if (!/^[a-zA-Z0-9_.]{4,50}$/.test(username)) errors.push('Username 4-50 karakter (huruf, angka, titik, garis bawah).');
    if (!password || password.length < 6) errors.push('Password minimal 6 karakter.');
    if (password !== konfirmasi) errors.push('Konfirmasi password tidak sama.');
    if (!['L', 'P'].includes(jenisKelamin)) errors.push('Jenis kelamin wajib dipilih.');
    const lahir = new Date(tanggalLahir);
    if (!tanggalLahir || isNaN(lahir) || lahir > new Date()) errors.push('Tanggal lahir tidak valid.');
    if (!errors.length && (await User.findOne({ where: { username } }))) errors.push('Username sudah digunakan.');

    if (errors.length) {
      return res.status(422).render('register', {
        title: 'Daftar Pasien',
        old: { nama, username, jenisKelamin, tanggalLahir },
        errors,
      });
    }

    await User.create({
      nama,
      username,
      password: await bcrypt.hash(password, 10),
      role: 'pasien',
      jenisKelamin,
      tanggalLahir,
    });
    req.flash('success', 'Pendaftaran berhasil. Silakan login.');
    res.redirect('/login');
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};
