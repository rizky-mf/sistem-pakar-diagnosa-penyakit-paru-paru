const bcrypt = require('bcryptjs');
const { User } = require('../../models');
const { pesanError } = require('../helpers');

const ROLE_STAF = ['admin', 'dokter'];

exports.index = async (req, res, next) => {
  try {
    const users = await User.findAll({ order: [['role', 'ASC'], ['nama', 'ASC']] });
    res.render('admin/user/index', { title: 'Kelola Akun', users });
  } catch (err) {
    next(err);
  }
};

// Admin hanya membuat akun admin/dokter. Pasien mendaftar sendiri.
exports.create = (req, res) => {
  res.render('admin/user/form', { title: 'Tambah Akun', item: { role: 'dokter' }, action: '/admin/user' });
};

exports.store = async (req, res) => {
  const nama = (req.body.nama || '').trim();
  const username = (req.body.username || '').trim();
  const { password, role } = req.body;

  if (!nama || !username || !password || password.length < 6 || !ROLE_STAF.includes(role)) {
    req.flash('error', 'Lengkapi semua kolom (password minimal 6 karakter).');
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
    const { password } = req.body;
    if (!nama || !username) {
      req.flash('error', 'Nama dan username wajib diisi.');
      return res.redirect(kembali);
    }

    const data = { nama, username };
    // Role pasien tidak bisa diubah, dan admin tidak bisa menurunkan role dirinya sendiri
    if (user.role !== 'pasien' && user.id !== req.session.user.id && ROLE_STAF.includes(req.body.role)) {
      data.role = req.body.role;
    }
    if (password) {
      if (password.length < 6) {
        req.flash('error', 'Password minimal 6 karakter.');
        return res.redirect(kembali);
      }
      data.password = await bcrypt.hash(password, 10);
    }

    await user.update(data);
    req.flash('success', 'Akun berhasil diperbarui.');
    res.redirect('/admin/user');
  } catch (err) {
    req.flash('error', err.name === 'SequelizeUniqueConstraintError' ? 'Username sudah digunakan.' : pesanError(err));
    res.redirect(kembali);
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
