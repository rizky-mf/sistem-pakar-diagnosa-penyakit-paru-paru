const router = require('express').Router();
const home = require('../controllers/homeController');
const diagnosa = require('../controllers/diagnosaController');
const auth = require('../controllers/authController');
const profil = require('../controllers/profilController');
const { guestOnly, requireLogin, requireRole, berandaRole } = require('../middleware/auth');

// Tidak ada beranda publik: tamu langsung ke login, pengguna ke halaman awal role-nya
router.get('/', (req, res) => res.redirect(req.session.user ? berandaRole(req.session.user.role) : '/login'));
router.get('/penyakit', requireLogin, home.penyakit);

router.get('/login', guestOnly, auth.loginForm);
router.post('/login', guestOnly, auth.login);
router.get('/register', guestOnly, auth.registerForm);
router.post('/register', guestOnly, auth.register);
router.post('/logout', auth.logout);

// Pasien
router.get('/diagnosa', requireRole('pasien'), diagnosa.form);
router.post('/diagnosa', requireRole('pasien'), diagnosa.proses);
router.get('/riwayat-saya', requireRole('pasien'), diagnosa.riwayatSaya);
router.get('/profil', requireRole('pasien'), profil.form);
router.post('/profil', requireRole('pasien'), profil.update);

// Pasien (miliknya sendiri), dokter, dan admin
router.get('/diagnosa/hasil/:id', requireLogin, diagnosa.hasil);

module.exports = router;
