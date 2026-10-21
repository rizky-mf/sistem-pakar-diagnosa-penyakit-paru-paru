const router = require('express').Router();
const { requireRole } = require('../middleware/auth');
const dashboard = require('../controllers/dokter/dashboardController');
const penyakit = require('../controllers/dokter/penyakitController');
const gejala = require('../controllers/dokter/gejalaController');
const rule = require('../controllers/dokter/ruleController');
const riwayat = require('../controllers/riwayatController');
const usulan = require('../controllers/dokter/usulanController');

// req.isKetua & jumlahUsulan disiapkan middleware statusDokter (app.js)
router.use(requireRole('dokter'));
router.use((req, res, next) => {
  res.locals.base = req.baseUrl;
  next();
});

function hanyaKetua(req, res, next) {
  if (req.isKetua) return next();
  res.status(403).render('error', { title: 'Akses Ditolak', message: 'Hanya dokter ketua yang dapat memvalidasi usulan.' });
}

router.get('/', dashboard.index);

// Basis pengetahuan dikelola oleh dokter (pakar)
router.get('/penyakit', penyakit.index);
router.get('/penyakit/tambah', penyakit.create);
router.post('/penyakit', penyakit.store);
router.get('/penyakit/:id/edit', penyakit.edit);
router.put('/penyakit/:id', penyakit.update);
router.delete('/penyakit/:id', penyakit.destroy);

router.get('/gejala', gejala.index);
router.get('/gejala/tambah', gejala.create);
router.post('/gejala', gejala.store);
router.get('/gejala/:id/edit', gejala.edit);
router.put('/gejala/:id', gejala.update);
router.delete('/gejala/:id', gejala.destroy);

router.get('/rule', rule.index);
router.get('/rule/tambah', rule.create);
router.post('/rule', rule.store);
router.get('/rule/:id/edit', rule.edit);
router.put('/rule/:id', rule.update);
router.delete('/rule/:id', rule.destroy);

// Usulan basis pengetahuan dan validasi oleh dokter ketua
router.get('/usulan', usulan.index);
router.get('/usulan/:jenis/:id', usulan.show);
router.get('/usulan/:jenis/:id/edit', usulan.edit);
router.put('/usulan/:jenis/:id', usulan.update);
router.delete('/usulan/:jenis/:id', usulan.destroy);
router.post('/usulan/:jenis/:id/setujui', hanyaKetua, usulan.setujui);
router.post('/usulan/:jenis/:id/tolak', hanyaKetua, usulan.tolak);

// Dokter hanya dapat melihat riwayat diagnosa pasien
router.get('/riwayat', riwayat.index);
router.get('/riwayat/:id', riwayat.show);

module.exports = router;
