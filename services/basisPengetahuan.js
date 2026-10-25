/**
 * Pembantu pengelolaan basis pengetahuan oleh dokter (pakar).
 */
const { Op } = require('sequelize');
const { Penyakit, Gejala, Rule, RuleGejala } = require('../models');

// Kode unik per tabel (P01, G01, R01); kecualiId dipakai saat edit
async function kodeDipakai(Model, kode, kecualiId) {
  const ada = await Model.findOne({ where: { kode, id: { [Op.ne]: kecualiId || 0 } } });
  return Boolean(ada);
}

// Kode berikutnya berdasarkan angka terbesar, misalnya G25 -> G26
async function kodeBerikutnya(Model, awalan, transaction) {
  const semua = await Model.findAll({ attributes: ['kode'], transaction });
  const angka = semua.map((m) => parseInt(String(m.kode).replace(/^\D+/, ''), 10)).filter((n) => !isNaN(n));
  return awalan + String(Math.max(0, ...angka) + 1).padStart(2, '0');
}

/**
 * Membuat penyakit baru beserta gejala barunya dan satu aturan
 * IF gejala... THEN penyakit (dengan CF pakar). Kode penyakit, gejala, dan aturan dibuat otomatis.
 * data: { nama, deskripsi, solusi, gejalaIds, cf: {gejalaId: cf}, gejalaBaru: [{ nama, cf }] }
 */
async function buatPenyakitLengkap(data, transaction) {
  const { nama, deskripsi, solusi } = data;
  const kode = await kodeBerikutnya(Penyakit, 'P', transaction);
  const penyakit = await Penyakit.create({ kode, nama, deskripsi, solusi }, { transaction });
  const premis = (data.gejalaIds || []).map((gejalaId) => ({ gejalaId, cf: data.cf[gejalaId] }));
  for (const g of data.gejalaBaru || []) {
    const baru = await Gejala.create({ kode: await kodeBerikutnya(Gejala, 'G', transaction), nama: g.nama }, { transaction });
    premis.push({ gejalaId: baru.id, cf: g.cf });
  }
  if (premis.length) {
    const rule = await Rule.create({ kode: await kodeBerikutnya(Rule, 'R', transaction), penyakitId: penyakit.id }, { transaction });
    await RuleGejala.bulkCreate(premis.map((p) => ({ ...p, ruleId: rule.id })), { transaction });
  }
  return penyakit;
}

module.exports = { kodeDipakai, kodeBerikutnya, buatPenyakitLengkap };
