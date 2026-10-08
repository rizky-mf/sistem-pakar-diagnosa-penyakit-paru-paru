const router = require('express').Router();
const home = require('../controllers/homeController');
const diagnosa = require('../controllers/diagnosaController');
const auth = require('../controllers/authController');
const { guestOnly, requireLogin, requireRole } = require('../middleware/auth');

// Publik
router.get('/', home.index);
router.get('/penyakit', home.penyakit);

router.get('/login', guestOnly, auth.loginForm);
router.post('/login', guestOnly, auth.login);
router.get('/register', guestOnly, auth.registerForm);
router.post('/register', guestOnly, auth.register);
router.post('/logout', auth.logout);

// Pasien
router.get('/diagnosa', requireRole('pasien'), diagnosa.form);
router.post('/diagnosa', requireRole('pasien'), diagnosa.proses);
router.get('/riwayat-saya', requireRole('pasien'), diagnosa.riwayatSaya);

// Pasien (miliknya sendiri), dokter, dan admin
router.get('/diagnosa/hasil/:id', requireLogin, diagnosa.hasil);

module.exports = router;
