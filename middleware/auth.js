// Halaman awal setelah login untuk tiap aktor
const BERANDA = { admin: '/admin', dokter: '/dokter', pasien: '/diagnosa' };

function berandaRole(role) {
  return BERANDA[role] || '/';
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

// Akun dengan kata sandi dari admin hanya boleh membuka profil (untuk menggantinya) dan keluar
const BOLEH_SAAT_WAJIB_GANTI = ['/profil', '/logout'];
function wajibGantiPassword(req, res, next) {
  const user = req.session.user;
  if (!user || !user.wajibGantiPassword || BOLEH_SAAT_WAJIB_GANTI.includes(req.path)) return next();
  req.flash('error', 'Ganti kata sandi awal Anda terlebih dahulu sebelum menggunakan aplikasi.');
  res.redirect('/profil');
}

module.exports = { requireLogin, requireRole, guestOnly, berandaRole, wajibGantiPassword };
