const { sequelize, Rule, RuleGejala, Penyakit, Gejala } = require('../../models');
const { pesanError } = require('../helpers');

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
  const error = validasi(data);
  if (error) {
    req.flash('error', error);
    return res.redirect('/dokter/rule/tambah');
  }
  try {
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
    res.render('dokter/rule/form', {
      title: 'Edit Aturan',
      item: {
        kode: rule.kode,
        penyakitId: rule.penyakitId,
        gejalaIds: rule.gejalas.map((g) => g.id),
        cf: Object.fromEntries(rule.gejalas.map((g) => [g.id, g.rule_gejala.cf])),
      },
      action: `/dokter/rule/${rule.id}?_method=PUT`,
      ...(await dataForm()),
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res) => {
  const data = ambilInput(req.body);
  const error = validasi(data);
  if (error) {
    req.flash('error', error);
    return res.redirect(`/dokter/rule/${req.params.id}/edit`);
  }
  try {
    const rule = await Rule.findByPk(req.params.id);
    if (!rule) return res.redirect('/dokter/rule');
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

exports.destroy = async (req, res) => {
  try {
    await Rule.destroy({ where: { id: req.params.id } });
    req.flash('success', 'Aturan berhasil dihapus.');
  } catch (err) {
    req.flash('error', pesanError(err));
  }
  res.redirect('/dokter/rule');
};
