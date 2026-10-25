const { sequelize, Penyakit, Gejala } = require('../../models');
const { pesanError } = require('../helpers');
const { kodeBerikutnya, buatPenyakitLengkap } = require('../../services/basisPengetahuan');

const daftar = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

// Kode penyakit (P01, P02, ...) dibuat otomatis oleh sistem dan tidak dapat diubah.
// Form tambah penyakit (paket=1) juga berisi gejalanya: gejala yang sudah ada
// (gejala + cf_<id>) dan gejala baru (gejalaBaruNama + gejalaBaruCf)
function ambilInput(body) {
  const data = {
    nama: (body.nama || '').trim(),
    deskripsi: (body.deskripsi || '').trim(),
    solusi: (body.solusi || '').trim(),
  };
  if (body.paket !== '1') return data;

  const gejalaIds = daftar(body.gejala).map(Number).filter(Boolean);
  const cfBaru = daftar(body.gejalaBaruCf);
  return {
    ...data,
    gejalaIds,
    cf: Object.fromEntries(gejalaIds.map((id) => [id, parseFloat(body[`cf_${id}`])])),
    gejalaBaru: daftar(body.gejalaBaruNama)
      .map((nama, i) => ({ nama: String(nama).trim(), cf: parseFloat(cfBaru[i]) }))
      .filter((g) => g.nama),
  };
}

function validasi(data) {
  if (!data.nama || !data.deskripsi || !data.solusi) return 'Nama, deskripsi, dan solusi wajib diisi.';
  if (data.gejalaIds) {
    if (!data.gejalaIds.length && !data.gejalaBaru.length) return 'Pilih atau tambahkan minimal satu gejala untuk penyakit ini.';
    const semuaCf = [...Object.values(data.cf), ...data.gejalaBaru.map((g) => g.cf)];
    if (semuaCf.some((cf) => !(cf > 0 && cf <= 1))) return 'Nilai CF pakar harus di antara 0 dan 1.';
  }
  return null;
}

// Form tambah sekaligus memilih/menambah gejala (menjadi satu aturan); form edit hanya data penyakit
async function dataFormTambah() {
  return { denganGejala: true, gejala: await Gejala.findAll({ order: [['kode', 'ASC']] }) };
}

exports.index = async (req, res, next) => {
  try {
    const penyakit = await Penyakit.findAll({ order: [['kode', 'ASC']] });
    res.render('dokter/penyakit/index', { title: 'Data Penyakit', penyakit });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    res.render('dokter/penyakit/form', {
      title: 'Tambah Penyakit',
      // Perkiraan kode untuk ditampilkan; kode final ditentukan saat disimpan
      item: { kode: await kodeBerikutnya(Penyakit, 'P'), gejalaIds: [], cf: {}, gejalaBaru: [] },
      action: '/dokter/penyakit',
      ...(await dataFormTambah()),
    });
  } catch (err) {
    next(err);
  }
};

exports.store = async (req, res) => {
  const data = ambilInput({ ...req.body, paket: '1' });
  const error = validasi(data);
  if (error) {
    // Tampilkan ulang form beserta isian agar gejala yang sudah dipilih tidak hilang
    return res.status(422).render('dokter/penyakit/form', {
      title: 'Tambah Penyakit',
      item: { ...data, kode: await kodeBerikutnya(Penyakit, 'P') },
      action: '/dokter/penyakit',
      errorForm: error,
      ...(await dataFormTambah()),
    });
  }
  try {
    const penyakit = await sequelize.transaction((t) => buatPenyakitLengkap(data, t));
    req.flash('success', `Penyakit ${penyakit.kode} beserta gejala dan aturannya berhasil ditambahkan.`);
    res.redirect('/dokter/penyakit');
  } catch (err) {
    req.flash('error', pesanError(err));
    res.redirect('/dokter/penyakit/tambah');
  }
};

exports.edit = async (req, res, next) => {
  try {
    const item = await Penyakit.findByPk(req.params.id);
    if (!item) return res.redirect('/dokter/penyakit');
    res.render('dokter/penyakit/form', { title: 'Edit Penyakit', item, action: `/dokter/penyakit/${item.id}?_method=PUT` });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res) => {
  const data = ambilInput(req.body);
  const id = Number(req.params.id);
  const error = validasi(data);
  if (error) {
    req.flash('error', error);
    return res.redirect(`/dokter/penyakit/${id}/edit`);
  }
  try {
    if (!(await Penyakit.findByPk(id))) return res.redirect('/dokter/penyakit');
    await Penyakit.update(data, { where: { id } });
    req.flash('success', 'Penyakit berhasil diperbarui.');
    res.redirect('/dokter/penyakit');
  } catch (err) {
    req.flash('error', pesanError(err));
    res.redirect(`/dokter/penyakit/${id}/edit`);
  }
};

exports.destroy = async (req, res) => {
  try {
    await Penyakit.destroy({ where: { id: req.params.id } });
    req.flash('success', 'Penyakit beserta aturannya berhasil dihapus.');
  } catch (err) {
    req.flash('error', pesanError(err));
  }
  res.redirect('/dokter/penyakit');
};
