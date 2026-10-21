/**
 * Usulan basis pengetahuan (penyakit, gejala, aturan).
 *
 * Dokter yang bukan ketua tidak mengubah data secara langsung: tambahan dan
 * perubahannya disimpan sebagai usulan berstatus "menunggu". Data yang dipakai
 * diagnosa tetap versi yang sudah disetujui sampai dokter ketua menyetujui
 * usulan tersebut, lalu isinya diterapkan ke tabel utama.
 */
const { Op } = require('sequelize');
const {
  sequelize,
  Penyakit,
  Gejala,
  Rule,
  RuleGejala,
  UsulanPenyakit,
  UsulanPenyakitGejala,
  UsulanGejala,
  UsulanRule,
  UsulanRuleGejala,
} = require('../../models');

const JENIS = {
  penyakit: { Usulan: UsulanPenyakit, Data: Penyakit, fk: 'penyakitId', label: 'Penyakit', kolom: ['kode', 'nama', 'deskripsi', 'solusi'] },
  gejala: { Usulan: UsulanGejala, Data: Gejala, fk: 'gejalaId', label: 'Gejala', kolom: ['kode', 'nama'] },
  rule: { Usulan: UsulanRule, Data: Rule, fk: 'ruleId', label: 'Aturan', kolom: ['kode', 'penyakitId'] },
};

const pilih = (obj, kolom) => Object.fromEntries(kolom.map((k) => [k, obj[k]]));

function includeUsulan(jenis) {
  const include = [{ association: 'pengusul', attributes: ['id', 'nama'] }, { association: 'validator', attributes: ['id', 'nama'] }];
  if (jenis === 'rule') {
    include.push(Penyakit, Gejala, { association: 'target', include: [Penyakit, Gejala] });
  } else if (jenis === 'penyakit') {
    include.push({ association: 'target' }, { association: 'daftarGejala', include: [Gejala] });
  } else {
    include.push({ association: 'target' });
  }
  return include;
}

// Kode wajib unik di antara data yang sudah disetujui
async function kodeDipakai(jenis, kode, kecualiId) {
  const ada = await JENIS[jenis].Data.findOne({ where: { kode, id: { [Op.ne]: kecualiId || 0 } } });
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
 * IF gejala... THEN penyakit (dengan CF pakar). Dipakai ketua saat menambah
 * penyakit dan saat usulan penyakit baru disetujui.
 * data: { kode, nama, deskripsi, solusi, gejalaIds, cf: {gejalaId: cf}, gejalaBaru: [{ nama, cf }] }
 */
async function buatPenyakitLengkap(data, transaction) {
  const penyakit = await Penyakit.create(pilih(data, JENIS.penyakit.kolom), { transaction });
  const premis = (data.gejalaIds || []).map((gejalaId) => ({ gejalaId, cf: data.cf[gejalaId] }));
  for (const g of data.gejalaBaru || []) {
    const kode = await kodeBerikutnya(Gejala, 'G', transaction);
    const baru = await Gejala.create({ kode, nama: g.nama }, { transaction });
    premis.push({ gejalaId: baru.id, cf: g.cf });
  }
  if (premis.length) {
    const rule = await Rule.create({ kode: await kodeBerikutnya(Rule, 'R', transaction), penyakitId: penyakit.id }, { transaction });
    await RuleGejala.bulkCreate(premis.map((p) => ({ ...p, ruleId: rule.id })), { transaction });
  }
  return penyakit;
}

// Mengubah baris gejala usulan penyakit ke bentuk data form
function dataPaketPenyakit(usulan) {
  const baris = usulan.daftarGejala || [];
  const lama = baris.filter((b) => b.gejalaId);
  return {
    ...pilih(usulan, JENIS.penyakit.kolom),
    gejalaIds: lama.map((b) => b.gejalaId),
    cf: Object.fromEntries(lama.map((b) => [b.gejalaId, b.cf])),
    gejalaBaru: baris.filter((b) => !b.gejalaId).map((b) => ({ nama: b.nama, cf: b.cf })),
  };
}

// Premis usulan aturan diganti seluruhnya
async function simpanPremisUsulan(usulanRuleId, data, transaction) {
  await UsulanRuleGejala.destroy({ where: { usulanRuleId }, transaction });
  await UsulanRuleGejala.bulkCreate(
    data.gejalaIds.map((gejalaId) => ({ usulanRuleId, gejalaId, cf: data.cf[gejalaId] })),
    { transaction }
  );
}

// Usulan milik dokter yang belum disetujui untuk data tertentu (dipakai ulang saat dokter mengubah lagi)
function usulanAktif(jenis, targetId, userId) {
  const { Usulan, fk } = JENIS[jenis];
  return Usulan.findOne({
    where: { [fk]: targetId, diajukanOleh: userId, status: { [Op.ne]: 'disetujui' } },
    include: jenis === 'rule' ? [Gejala] : [],
    order: [['updatedAt', 'DESC']],
  });
}

// Membuat usulan baru atau memperbarui usulan yang ada; status kembali "menunggu"
async function simpanUsulan(jenis, data, { usulan, targetId = null, userId }) {
  const { Usulan, fk, kolom } = JENIS[jenis];
  return sequelize.transaction(async (transaction) => {
    const isi = { ...pilih(data, kolom), status: 'menunggu', catatan: null, tanggalValidasi: null, divalidasiOleh: null };
    let hasil = usulan;
    if (hasil) await hasil.update(isi, { transaction });
    else hasil = await Usulan.create({ ...isi, [fk]: targetId, diajukanOleh: userId }, { transaction });
    if (jenis === 'rule') await simpanPremisUsulan(hasil.id, data, transaction);
    // Usulan penyakit baru membawa daftar gejalanya
    if (jenis === 'penyakit' && data.gejalaIds) {
      await UsulanPenyakitGejala.destroy({ where: { usulanPenyakitId: hasil.id }, transaction });
      await UsulanPenyakitGejala.bulkCreate(
        [
          ...data.gejalaIds.map((gejalaId) => ({ usulanPenyakitId: hasil.id, gejalaId, cf: data.cf[gejalaId] })),
          ...data.gejalaBaru.map((g) => ({ usulanPenyakitId: hasil.id, nama: g.nama, cf: g.cf })),
        ],
        { transaction }
      );
    }
    return hasil;
  });
}

// Dipanggil controller penyakit/gejala/rule saat dokter (bukan ketua) menambah atau mengubah data
exports.ajukan = async (jenis, data, targetId, userId) => {
  const usulan = targetId ? await usulanAktif(jenis, targetId, userId) : null;
  return simpanUsulan(jenis, data, { usulan, targetId, userId });
};

exports.usulanAktif = usulanAktif;
exports.buatPenyakitLengkap = buatPenyakitLengkap;
exports.dataPaketPenyakit = dataPaketPenyakit;
exports.kodeDipakai = kodeDipakai;
exports.JENIS = JENIS;

// Menerapkan isi usulan ke tabel utama
async function terapkan(jenis, usulan, transaction) {
  const { Data, fk, kolom } = JENIS[jenis];
  // Usulan penyakit baru: buat penyakit, gejala baru, dan aturannya sekaligus
  if (jenis === 'penyakit' && !usulan[fk]) return buatPenyakitLengkap(dataPaketPenyakit(usulan), transaction);
  const isi = pilih(usulan, kolom);
  let data = usulan[fk] ? await Data.findByPk(usulan[fk], { transaction }) : null;
  if (data) await data.update(isi, { transaction });
  else data = await Data.create(isi, { transaction });

  if (jenis === 'rule') {
    await RuleGejala.destroy({ where: { ruleId: data.id }, transaction });
    await RuleGejala.bulkCreate(
      usulan.gejalas.map((g) => ({ ruleId: data.id, gejalaId: g.id, cf: g.usulan_rule_gejala.cf })),
      { transaction }
    );
  }
  return data;
}

// ===== Tampilan =====

function teksPremis(gejalas, through) {
  return [...gejalas]
    .sort((a, b) => a.kode.localeCompare(b.kode))
    .map((g) => `${g.kode} (CF ${g[through].cf})`)
    .join(', ');
}

function ringkas(jenis, u) {
  if (jenis === 'rule') return `IF ${u.gejalas.map((g) => g.kode).sort().join(' AND ')} THEN ${u.penyakit ? u.penyakit.kode : '-'}`;
  if (jenis === 'penyakit' && u.daftarGejala && u.daftarGejala.length) return `${u.nama} (${u.daftarGejala.length} gejala)`;
  return u.nama;
}

// Baris perbandingan data saat ini dan usulan
function perbandingan(jenis, u) {
  const t = u.target;
  if (jenis === 'rule') {
    return [
      ['Kode aturan', t && t.kode, u.kode],
      ['THEN (penyakit)', t && t.penyakit && `${t.penyakit.kode} - ${t.penyakit.nama}`, u.penyakit && `${u.penyakit.kode} - ${u.penyakit.nama}`],
      ['IF (gejala & CF pakar)', t && teksPremis(t.gejalas, 'rule_gejala'), teksPremis(u.gejalas, 'usulan_rule_gejala')],
    ];
  }
  const label = { kode: 'Kode', nama: 'Nama', deskripsi: 'Deskripsi', solusi: 'Solusi / penanganan' };
  const baris = JENIS[jenis].kolom.map((k) => [label[k], t && t[k], u[k]]);
  if (jenis === 'penyakit' && u.daftarGejala && u.daftarGejala.length) {
    const teks = u.daftarGejala
      .map((b) => (b.gejala ? `${b.gejala.kode} - ${b.gejala.nama}` : `Gejala baru: ${b.nama}`) + ` (CF ${b.cf})`)
      .join('; ');
    baris.push(['Gejala (IF) & CF pakar', null, teks]);
  }
  return baris;
}

async function cariUsulan(req, res) {
  const jenis = req.params.jenis;
  if (!JENIS[jenis]) return null;
  const usulan = await JENIS[jenis].Usulan.findByPk(req.params.id, { include: includeUsulan(jenis) });
  if (!usulan || (!req.isKetua && usulan.diajukanOleh !== req.session.user.id)) return null;
  return { jenis, usulan };
}

function tidakDitemukan(req, res) {
  req.flash('error', 'Usulan tidak ditemukan.');
  res.redirect('/dokter/usulan');
}

// Ketua: semua usulan menunggu + riwayat validasi. Dokter lain: usulan miliknya.
exports.index = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const daftar = [];
    for (const [jenis, { Usulan, fk, label }] of Object.entries(JENIS)) {
      const where = req.isKetua ? {} : { diajukanOleh: userId };
      const baris = await Usulan.findAll({ where, include: includeUsulan(jenis), order: [['updatedAt', 'DESC']], limit: 100 });
      for (const u of baris) {
        daftar.push({ jenis, label, u, aksi: u[fk] && u.target ? 'Ubah' : 'Tambah', ringkasan: ringkas(jenis, u) });
      }
    }
    daftar.sort((a, b) => b.u.updatedAt - a.u.updatedAt);
    res.render('dokter/usulan/index', {
      title: req.isKetua ? 'Validasi Usulan' : 'Usulan Saya',
      menunggu: daftar.filter((d) => d.u.status === 'menunggu'),
      lainnya: daftar.filter((d) => d.u.status !== 'menunggu'),
    });
  } catch (err) {
    next(err);
  }
};

exports.show = async (req, res, next) => {
  try {
    const hasil = await cariUsulan(req, res);
    if (!hasil) return tidakDitemukan(req, res);
    const { jenis, usulan } = hasil;
    res.render('dokter/usulan/show', {
      title: 'Detail Usulan',
      jenis,
      label: JENIS[jenis].label,
      usulan,
      ubah: Boolean(usulan.target),
      baris: perbandingan(jenis, usulan),
      milikSendiri: usulan.diajukanOleh === req.session.user.id,
    });
  } catch (err) {
    next(err);
  }
};

exports.setujui = async (req, res) => {
  const hasil = await cariUsulan(req, res).catch(() => null);
  if (!hasil || hasil.usulan.status !== 'menunggu') return tidakDitemukan(req, res);
  const { jenis, usulan } = hasil;
  const kembali = `/dokter/usulan/${jenis}/${usulan.id}`;
  try {
    if (await kodeDipakai(jenis, usulan.kode, usulan[JENIS[jenis].fk])) {
      req.flash('error', `Kode ${usulan.kode} sudah dipakai data lain. Tolak usulan ini atau minta pengusul mengganti kodenya.`);
      return res.redirect(kembali);
    }
    await sequelize.transaction(async (transaction) => {
      await terapkan(jenis, usulan, transaction);
      await usulan.update(
        { status: 'disetujui', divalidasiOleh: req.session.user.id, tanggalValidasi: new Date(), catatan: (req.body.catatan || '').trim() || null },
        { transaction }
      );
    });
    req.flash('success', `Usulan ${JENIS[jenis].label.toLowerCase()} ${usulan.kode} disetujui dan sudah diterapkan.`);
    res.redirect('/dokter/usulan');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Gagal menerapkan usulan.');
    res.redirect(kembali);
  }
};

exports.tolak = async (req, res) => {
  const hasil = await cariUsulan(req, res).catch(() => null);
  if (!hasil || hasil.usulan.status !== 'menunggu') return tidakDitemukan(req, res);
  const { jenis, usulan } = hasil;
  const catatan = (req.body.catatan || '').trim();
  if (!catatan) {
    req.flash('error', 'Tuliskan alasan penolakan agar pengusul dapat memperbaikinya.');
    return res.redirect(`/dokter/usulan/${jenis}/${usulan.id}`);
  }
  await usulan.update({ status: 'ditolak', catatan, divalidasiOleh: req.session.user.id, tanggalValidasi: new Date() });
  req.flash('success', `Usulan ${JENIS[jenis].label.toLowerCase()} ${usulan.kode} ditolak.`);
  res.redirect('/dokter/usulan');
};

// Ketua boleh menghapus usulan apa pun; pengusul hanya usulannya yang belum disetujui
exports.destroy = async (req, res) => {
  const hasil = await cariUsulan(req, res).catch(() => null);
  if (!hasil) return tidakDitemukan(req, res);
  const { jenis, usulan } = hasil;
  if (!req.isKetua && usulan.status === 'disetujui') {
    req.flash('error', 'Usulan yang sudah disetujui tidak dapat dihapus.');
    return res.redirect('/dokter/usulan');
  }
  await usulan.destroy();
  req.flash('success', `Usulan ${JENIS[jenis].label.toLowerCase()} ${usulan.kode} dihapus.`);
  res.redirect('/dokter/usulan');
};

// Pengusul memperbaiki usulannya (menunggu/ditolak) memakai form yang sama dengan data utama
exports.edit = async (req, res, next) => {
  try {
    const hasil = await cariUsulan(req, res);
    if (!hasil || hasil.usulan.diajukanOleh !== req.session.user.id || hasil.usulan.status === 'disetujui') {
      return tidakDitemukan(req, res);
    }
    const { jenis, usulan } = hasil;
    const form = require(`./${jenis}Controller`);
    res.render(`dokter/${jenis}/form`, {
      title: `Edit Usulan ${JENIS[jenis].label}`,
      item: form.itemDariUsulan ? form.itemDariUsulan(usulan) : usulan,
      action: `/dokter/usulan/${jenis}/${usulan.id}?_method=PUT`,
      usulan,
      ...(form.dataForm ? await form.dataForm(usulan) : {}),
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res) => {
  const hasil = await cariUsulan(req, res).catch(() => null);
  if (!hasil || hasil.usulan.diajukanOleh !== req.session.user.id || hasil.usulan.status === 'disetujui') {
    return tidakDitemukan(req, res);
  }
  const { jenis, usulan } = hasil;
  const form = require(`./${jenis}Controller`);
  const data = form.ambilInput(req.body, usulan);
  const error = form.validasi(data) || ((await kodeDipakai(jenis, data.kode, usulan[JENIS[jenis].fk])) && 'Kode sudah digunakan, gunakan kode lain.');
  if (error) {
    req.flash('error', error);
    return res.redirect(`/dokter/usulan/${jenis}/${usulan.id}/edit`);
  }
  await simpanUsulan(jenis, data, { usulan, userId: req.session.user.id });
  req.flash('success', 'Usulan diperbarui dan dikirim ulang ke dokter ketua.');
  res.redirect(`/dokter/usulan/${jenis}/${usulan.id}`);
};
