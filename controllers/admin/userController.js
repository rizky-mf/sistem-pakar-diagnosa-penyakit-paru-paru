const bcrypt = require('bcryptjs');
const { User } = require('../../models');
const { pesanError, validasiDiriPasien, validasiUsername } = require('../helpers');
const { buatAkunPasien, buatPasswordAwal } = require('../../services/akunPasien');

const ROLE_STAF = ['admin', 'dokter'];

// Kata sandi awal hanya ditampilkan sekali: disimpan di session lalu dihapus saat halaman dibuka
function tampilkanKredensial(req, res, akun, password, judul) {
  req.session.kredensial = { nama: akun.nama, kodePasien: akun.kodePasien, password, judul };
  res.redirect('/admin/user/kredensial');
}

exports.index = async (req, res, next) => {
  try {
    const users = await User.findAll({ order: [['role', 'ASC'], ['nama', 'ASC']] });
    res.render('admin/user/index', { title: 'Kelola Akun', users });
  } catch (err) {
    next(err);
  }
};

exports.create = (req, res) => {
  res.render('admin/user/form', { title: 'Tambah Akun', item: { role: 'dokter' }, action: '/admin/user' });
};

// Admin/dokter: username dan password diisi admin.
// Pasien: ID pasien menjadi username, kata sandi awal dibuat acak dan wajib diganti saat login pertama.
exports.store = async (req, res) => {
  const nama = (req.body.nama || '').trim();
  const { role } = req.body;

  if (role === 'pasien') {
    const { jenisKelamin, tanggalLahir } = req.body;
    const errors = validasiDiriPasien({ nama, jenisKelamin, tanggalLahir });
    if (errors.length) {
      req.flash('error', errors.join(' '));
      return res.redirect('/admin/user/tambah');
    }
    try {
      const password = buatPasswordAwal();
      const akun = await buatAkunPasien(User, {
        nama,
        jenisKelamin,
        tanggalLahir,
        password: await bcrypt.hash(password, 10),
        wajibGantiPassword: true,
      });
      return tampilkanKredensial(req, res, akun, password, 'Akun pasien berhasil dibuat');
    } catch (err) {
      req.flash('error', pesanError(err));
      return res.redirect('/admin/user/tambah');
    }
  }

  const username = (req.body.username || '').trim();
  const { password } = req.body;
  const errors = [];
  if (!nama || !username || !password || password.length < 6 || !ROLE_STAF.includes(role)) {
    errors.push('Lengkapi semua kolom (password minimal 6 karakter).');
  }
  if (username) errors.push(...validasiUsername(username));
  if (errors.length) {
    req.flash('error', errors.join(' '));
    return res.redirect('/admin/user/tambah');
  }
  try {
    await User.create({ nama, username, role, password: await bcrypt.hash(password, 10) });
    req.flash('success', 'Akun berhasil ditambahkan.');
    res.redirect('/admin/user');
  } catch (err) {
    req.flash('error', err.name === 'SequelizeUniqueConstraintError' ? 'Username sudah digunakan.' : pesanError(err));
    res.redirect('/admin/user/tambah');
  }
};

exports.kredensial = (req, res) => {
  const data = req.session.kredensial;
  if (!data) return res.redirect('/admin/user');
  delete req.session.kredensial;
  res.set('Cache-Control', 'no-store');
  res.render('admin/user/kredensial', { title: data.judul, data });
};

exports.edit = async (req, res, next) => {
  try {
    const item = await User.findByPk(req.params.id);
    if (!item) return res.redirect('/admin/user');
    res.render('admin/user/form', { title: 'Edit Akun', item, action: `/admin/user/${item.id}?_method=PUT` });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res) => {
  const kembali = `/admin/user/${req.params.id}/edit`;
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.redirect('/admin/user');

    const nama = (req.body.nama || '').trim();
    const username = (req.body.username || '').trim();
    const pasien = user.role === 'pasien';
    const { password, jenisKelamin, tanggalLahir } = req.body;

    const errors = pasien ? validasiDiriPasien({ nama, jenisKelamin, tanggalLahir }) : nama ? [] : ['Nama wajib diisi.'];
    if (!username) errors.push('Username wajib diisi.');
    else errors.push(...validasiUsername(username, user.kodePasien));
    if (errors.length) {
      req.flash('error', errors.join(' '));
      return res.redirect(kembali);
    }

    const data = { nama, username, role: user.role };
    if (pasien) {
      // Kata sandi pasien tidak diisi manual; gunakan tombol reset kata sandi
      Object.assign(data, { jenisKelamin, tanggalLahir });
      await user.update(data);
    } else {
      // Admin tidak bisa mengubah role dirinya sendiri
      if (user.id !== req.session.user.id && ROLE_STAF.includes(req.body.role)) data.role = req.body.role;
      if (password) {
        if (password.length < 6) {
          req.flash('error', 'Password minimal 6 karakter.');
          return res.redirect(kembali);
        }
        data.password = await bcrypt.hash(password, 10);
      }
      await user.update(data);
    }
    req.flash('success', 'Akun berhasil diperbarui.');
    res.redirect('/admin/user');
  } catch (err) {
    req.flash('error', err.name === 'SequelizeUniqueConstraintError' ? 'Username sudah digunakan.' : pesanError(err));
    res.redirect(kembali);
  }
};

// Khusus pasien: membuat kata sandi acak baru yang wajib diganti saat login berikutnya
exports.resetPassword = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user || user.role !== 'pasien') return res.redirect('/admin/user');
    const password = buatPasswordAwal();
    await user.update({ password: await bcrypt.hash(password, 10), wajibGantiPassword: true });
    tampilkanKredensial(req, res, user, password, 'Kata sandi pasien berhasil di-reset');
  } catch (err) {
    req.flash('error', pesanError(err));
    res.redirect(`/admin/user/${req.params.id}/edit`);
  }
};

exports.destroy = async (req, res) => {
  if (Number(req.params.id) === req.session.user.id) {
    req.flash('error', 'Tidak dapat menghapus akun yang sedang digunakan.');
    return res.redirect('/admin/user');
  }
  try {
    await User.destroy({ where: { id: req.params.id } });
    req.flash('success', 'Akun berhasil dihapus.');
  } catch (err) {
    req.flash('error', pesanError(err));
  }
  res.redirect('/admin/user');
};
