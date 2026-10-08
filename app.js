require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const { sequelize } = require('./models');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'rahasia',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 },
  })
);
app.use(flash());

// Variabel global untuk semua view
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;
  next();
});

app.use('/', require('./routes/index'));
app.use('/admin', require('./routes/admin'));
app.use('/dokter', require('./routes/dokter'));

app.use((req, res) => {
  res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Halaman tidak ditemukan.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Kesalahan Server', message: 'Terjadi kesalahan pada server.' });
});

const PORT = process.env.PORT || 3000;

sequelize
  .authenticate()
  .then(() => {
    app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Tidak dapat terhubung ke database:', err.message);
    console.error('Pastikan MySQL berjalan dan sudah menjalankan: npm run db:setup');
    process.exit(1);
  });
