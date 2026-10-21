const { sequelize, Rule, RuleGejala, Penyakit, Gejala } = require('../../models');
const { pesanError } = require('../helpers');
const usulan = require('./usulanController');

function ambilInput(body) {
  let gejalaIds = body.gejala || [];
  if (!Array.isArray(gejalaIds)) gejalaIds = [gejalaIds];
  gejalaIds = gejalaIds.map(Number).filter(Boolean);
  return {
    kode: (body.kode || '').trim().toUpperCase(),
    penyakitId: parseInt(body.penyakitId, 10),
    gejalaIds,
    // CF pakar tiap premis dikirim sebagai cf_<id gejala>
    cf: Object.fromEntries(gejalaIds.map((id) => [id, parseFloat(body[`cf_${id}`])])),
  };
}

// Mengganti seluruh premis aturan beserta CF pakarnya
async function simpanPremis(ruleId, data, transaction) {
  await RuleGejala.destroy({ where: { ruleId }, transaction });
  await RuleGejala.bulkCreate(
    data.gejalaIds.map((gejalaId) => ({ ruleId, gejalaId, cf: data.cf[gejalaId] })),
    { transaction }
  );
}

function validasi(data) {
  if (!data.kode) return 'Kode aturan wajib diisi.';
  if (!data.penyakitId) return 'Penyakit (THEN) wajib dipilih.';
  if (data.gejalaIds.length === 0) return 'Pilih minimal satu gejala (IF).';
  if (Object.values(data.cf).some((cf) => !(cf > 0 && cf <= 1))) return 'Nilai CF pakar harus di antara 0 dan 1.';
  return null;
}

// Isi form aturan dari data aturan maupun dari usulan aturan
function itemForm(r, through) {
  return {
    kode: r.kode,
    penyakitId: r.penyakitId,
    gejalaIds: r.gejalas.map((g) => g.id),
    cf: Object.fromEntries(r.gejalas.map((g) => [g.id, g[through].cf])),
  };
}

exports.ambilInput = ambilInput;
exports.validasi = validasi;
exports.itemDariUsulan = (u) => itemForm(u, 'usulan_rule_gejala');
exports.dataForm = dataForm;

async function dataForm() {
  const [penyakit, gejala] = await Promise.all([
    Penyakit.findAll({ order: [['kode', 'ASC']] }),
    Gejala.findAll({ order: [['kode', 'ASC']] }),
  ]);
  return { penyakit, gejala };
}

exports.index = async (req, res, next) => {
  try {
    const rules = await Rule.findAll({
      include: [Penyakit, Gejala],
      order: [['kode', 'ASC'], [Gejala, 'kode', 'ASC']],
    });
    res.render('dokter/rule/index', { title: 'Data Aturan', rules });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    res.render('dokter/rule/form', {
      title: 'Tambah Aturan',
      item: { gejalaIds: [], cf: {} },
      action: '/dokter/rule',
      ...(await dataForm()),
    });
  } catch (err) {
    next(err);
  }
};

exports.store = async (req, res) => {
  const data = ambilInput(req.body);
  const error = validasi(data) || ((await usulan.kodeDipakai('rule', data.kode)) && 'Kode sudah digunakan, gunakan kode lain.');
  if (error) {
    req.flash('error', error);
    return res.redirect('/dokter/rule/tambah');
  }
  try {
    // Ketua menyimpan langsung; dokter lain mengirim usulan untuk divalidasi ketua
    if (!req.isKetua) {
      await usulan.ajukan('rule', data, null, req.session.user.id);
      req.flash('success', 'Usulan aturan dikirim ke dokter ketua untuk divalidasi.');
      return res.redirect('/dokter/usulan');
    }
    await sequelize.transaction(async (t) => {
      const rule = await Rule.create({ kode: data.kode, penyakitId: data.penyakitId }, { transaction: t });
      await simpanPremis(rule.id, data, t);
    });
    req.flash('success', 'Aturan berhasil ditambahkan.');
    res.redirect('/dokter/rule');
  } catch (err) {
    req.flash('error', pesanError(err));
    res.redirect('/dokter/rule/tambah');
  }
};

exports.edit = async (req, res, next) => {
  try {
    const rule = await Rule.findByPk(req.params.id, { include: [Gejala] });
    if (!rule) return res.redirect('/dokter/rule');
    // Dokter yang masih punya usulan untuk aturan ini melanjutkan usulannya
    const aktif = req.isKetua ? null : await usulan.usulanAktif('rule', rule.id, req.session.user.id);
    res.render('dokter/rule/form', {
      title: 'Edit Aturan',
      item: aktif ? itemForm(aktif, 'usulan_rule_gejala') : itemForm(rule, 'rule_gejala'),
      action: `/dokter/rule/${rule.id}?_method=PUT`,
      usulan: aktif,
      ...(await dataForm()),
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res) => {
  const data = ambilInput(req.body);
  const error = validasi(data) || ((await usulan.kodeDipakai('rule', data.kode, req.params.id)) && 'Kode sudah digunakan, gunakan kode lain.');
  if (error) {
    req.flash('error', error);
    return res.redirect(`/dokter/rule/${req.params.id}/edit`);
  }
  try {
    const rule = await Rule.findByPk(req.params.id);
    if (!rule) return res.redirect('/dokter/rule');
    if (!req.isKetua) {
      await usulan.ajukan('rule', data, rule.id, req.session.user.id);
      req.flash('success', 'Usulan perubahan dikirim ke dokter ketua. Aturan lama tetap dipakai sampai disetujui.');
      return res.redirect('/dokter/usulan');
    }
    await sequelize.transaction(async (t) => {
      await rule.update({ kode: data.kode, penyakitId: data.penyakitId }, { transaction: t });
      await simpanPremis(rule.id, data, t);
    });
    req.flash('success', 'Aturan berhasil diperbarui.');
    res.redirect('/dokter/rule');
  } catch (err) {
    req.flash('error', pesanError(err));
    res.redirect(`/dokter/rule/${req.params.id}/edit`);
  }
};

// Aturan yang sudah disetujui hanya dapat dihapus ketua
exports.destroy = async (req, res) => {
  if (!req.isKetua) {
    req.flash('error', 'Hanya dokter ketua yang dapat menghapus data yang sudah disetujui.');
    return res.redirect('/dokter/rule');
  }
  try {
    await Rule.destroy({ where: { id: req.params.id } });
    req.flash('success', 'Aturan berhasil dihapus.');
  } catch (err) {
    req.flash('error', pesanError(err));
  }
  res.redirect('/dokter/rule');
};
