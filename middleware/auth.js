// Halaman awal setelah login untuk tiap aktor
const BERANDA = { admin: '/admin', dokter: '/dokter', pasien: '/diagnosa' };

function berandaRole(role) {
  return BERANDA[role] || '/login';
}

function requireLogin(req, res, next) {
  if (req.session.user) return next();
  req.flash('error', 'Silakan login terlebih dahulu.');
  res.redirect('/login');
}

// Contoh: requireRole('admin'), requireRole('admin', 'dokter')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return requireLogin(req, res, next);
    if (roles.includes(req.session.user.role)) return next();
    res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak memiliki akses ke halaman ini.' });
  };
}

function guestOnly(req, res, next) {
  if (req.session.user) return res.redirect(berandaRole(req.session.user.role));
  next();
}

/**
 * Khusus dokter: status ketua dibaca dari database setiap request agar perubahan
 * oleh admin langsung berlaku, di halaman mana pun (termasuk profil).
 * jumlahUsulan: ketua = usulan menunggu validasi, dokter lain = usulannya yang ditolak.
 */
async function statusDokter(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'dokter') return next();
  try {
    const { User, UsulanPenyakit, UsulanGejala, UsulanRule } = require('../models');
    const dokter = await User.findByPk(req.session.user.id, { attributes: ['ketua'] });
    req.isKetua = Boolean(dokter && dokter.ketua);
    const where = req.isKetua ? { status: 'menunggu' } : { status: 'ditolak', diajukanOleh: req.session.user.id };
    const jumlah = await Promise.all([UsulanPenyakit, UsulanGejala, UsulanRule].map((M) => M.count({ where })));
    res.locals.isKetua = req.isKetua;
    res.locals.jumlahUsulan = jumlah.reduce((a, b) => a + b, 0);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireLogin, requireRole, guestOnly, berandaRole, statusDokter };
