const router = require('express').Router();
const { requireRole } = require('../middleware/auth');
const dashboard = require('../controllers/admin/dashboardController');
const user = require('../controllers/admin/userController');
const riwayat = require('../controllers/riwayatController');

router.use(requireRole('admin'));
router.use((req, res, next) => {
  res.locals.base = req.baseUrl;
  next();
});

router.get('/', dashboard.index);

router.get('/user', user.index);
router.get('/user/tambah', user.create);
router.post('/user', user.store);
router.get('/user/:id/edit', user.edit);
router.put('/user/:id', user.update);
router.delete('/user/:id', user.destroy);

router.get('/riwayat', riwayat.index);
router.get('/riwayat/:id', riwayat.show);
router.delete('/riwayat/:id', riwayat.destroy);

module.exports = router;
