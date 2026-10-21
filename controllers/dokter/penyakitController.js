const { sequelize, Penyakit, Gejala } = require('../../models');
const { pesanError } = require('../helpers');
const usulan = require('./usulanController');

const daftar = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

// Form tambah penyakit (paket=1) juga berisi gejalanya: gejala yang sudah ada
// (gejala + cf_<id>) dan gejala baru (gejalaBaruNama + gejalaBaruCf)
function ambilInput(body) {
  const data = {
    kode: (body.kode || '').trim().toUpperCase(),
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
  if (!data.kode || !data.nama || !data.deskripsi || !data.solusi) return 'Semua kolom wajib diisi.';
  if (data.gejalaIds) {
    if (!data.gejalaIds.length && !data.gejalaBaru.length) return 'Pilih atau tambahkan minimal satu gejala untuk penyakit ini.';
    const semuaCf = [...Object.values(data.cf), ...data.gejalaBaru.map((g) => g.cf)];
    if (semuaCf.some((cf) => !(cf > 0 && cf <= 1))) return 'Nilai CF pakar harus di antara 0 dan 1.';
  }
  return null;
}

// Usulan penyakit baru (tanpa target) diedit beserta gejalanya
exports.itemDariUsulan = (u) => (u.penyakitId ? u : usulan.dataPaketPenyakit(u));
exports.dataForm = async (u) => {
  if (u && u.penyakitId) return { denganGejala: false };
  return { denganGejala: true, gejala: await Gejala.findAll({ order: [['kode', 'ASC']] }) };
};

exports.ambilInput = ambilInput;
exports.validasi = validasi;

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
      item: { gejalaIds: [], cf: {}, gejalaBaru: [] },
      action: '/dokter/penyakit',
      ...(await exports.dataForm()),
    });
  } catch (err) {
    next(err);
  }
};

// Ketua menyimpan langsung; dokter lain mengirim usulan untuk divalidasi ketua
exports.store = async (req, res) => {
  const data = ambilInput({ ...req.body, paket: '1' });
  const error = validasi(data) || ((await usulan.kodeDipakai('penyakit', data.kode)) && 'Kode sudah digunakan, gunakan kode lain.');
  if (error) {
    // Tampilkan ulang form beserta isian agar gejala yang sudah dipilih tidak hilang
    return res.status(422).render('dokter/penyakit/form', {
      title: 'Tambah Penyakit',
      item: data,
      action: '/dokter/penyakit',
      errorForm: error,
      ...(await exports.dataForm()),
    });
  }
  try {
    if (req.isKetua) {
      await sequelize.transaction((t) => usulan.buatPenyakitLengkap(data, t));
      req.flash('success', 'Penyakit beserta gejala dan aturannya berhasil ditambahkan.');
      return res.redirect('/dokter/penyakit');
    }
    await usulan.ajukan('penyakit', data, null, req.session.user.id);
    req.flash('success', 'Usulan penyakit beserta gejalanya dikirim ke dokter ketua untuk divalidasi.');
    res.redirect('/dokter/usulan');
  } catch (err) {
    req.flash('error', pesanError(err));
    res.redirect('/dokter/penyakit/tambah');
  }
};

exports.edit = async (req, res, next) => {
  try {
    const item = await Penyakit.findByPk(req.params.id);
    if (!item) return res.redirect('/dokter/penyakit');
    // Dokter yang masih punya usulan untuk data ini melanjutkan usulannya
    const aktif = req.isKetua ? null : await usulan.usulanAktif('penyakit', item.id, req.session.user.id);
    res.render('dokter/penyakit/form', {
      title: 'Edit Penyakit',
      item: aktif || item,
      action: `/dokter/penyakit/${item.id}?_method=PUT`,
      usulan: aktif,
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res) => {
  const data = ambilInput(req.body);
  const id = Number(req.params.id);
  const error = validasi(data) || ((await usulan.kodeDipakai('penyakit', data.kode, id)) && 'Kode sudah digunakan, gunakan kode lain.');
  if (error) {
    req.flash('error', error);
    return res.redirect(`/dokter/penyakit/${id}/edit`);
  }
  try {
    if (!(await Penyakit.findByPk(id))) return res.redirect('/dokter/penyakit');
    if (req.isKetua) {
      await Penyakit.update(data, { where: { id } });
      req.flash('success', 'Penyakit berhasil diperbarui.');
      return res.redirect('/dokter/penyakit');
    }
    await usulan.ajukan('penyakit', data, id, req.session.user.id);
    req.flash('success', 'Usulan perubahan dikirim ke dokter ketua. Data lama tetap dipakai sampai disetujui.');
    res.redirect('/dokter/usulan');
  } catch (err) {
    req.flash('error', pesanError(err));
    res.redirect(`/dokter/penyakit/${id}/edit`);
  }
};

// Data yang sudah disetujui hanya dapat dihapus ketua
exports.destroy = async (req, res) => {
  if (!req.isKetua) {
    req.flash('error', 'Hanya dokter ketua yang dapat menghapus data yang sudah disetujui.');
    return res.redirect('/dokter/penyakit');
  }
  try {
    await Penyakit.destroy({ where: { id: req.params.id } });
    req.flash('success', 'Penyakit beserta aturannya berhasil dihapus.');
  } catch (err) {
    req.flash('error', pesanError(err));
  }
  res.redirect('/dokter/penyakit');
};
