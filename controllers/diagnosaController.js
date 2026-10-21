const { sequelize, Penyakit, Gejala, Riwayat, User, detailRiwayat, hitungUmur } = require('../models');
const { muatRules, dataHasil } = require('./helpers');
const { forwardChaining } = require('../services/forwardChaining');
const { TINGKAT_KEYAKINAN, rankingPenyakit } = require('../services/certaintyFactor');

// Keyakinan pasien dikirim sebagai cf_<kode gejala>; hanya nilai > 0 yang dianggap dirasakan
function keyakinanUser(body, semuaGejala) {
  const valid = TINGKAT_KEYAKINAN.map((t) => t.nilai).filter((n) => n > 0);
  const hasil = {};
  for (const g of semuaGejala) {
    const nilai = parseFloat(body[`cf_${g.kode}`]);
    if (valid.includes(nilai)) hasil[g.kode] = nilai;
  }
  return hasil;
}

async function dataPasien(userId) {
  const pasien = await User.findByPk(userId);
  return {
    nama: pasien.nama,
    umur: hitungUmur(pasien.tanggalLahir),
    jenisKelamin: pasien.jenisKelamin,
  };
}

exports.form = async (req, res, next) => {
  try {
    const [gejala, pasien] = await Promise.all([
      Gejala.findAll({ order: [['kode', 'ASC']] }),
      dataPasien(req.session.user.id),
    ]);
    res.render('diagnosa/form', { title: 'Diagnosa', tingkatKeyakinan: TINGKAT_KEYAKINAN, gejala, pasien, errors: [] });
  } catch (err) {
    next(err);
  }
};

exports.proses = async (req, res, next) => {
  try {
    const [semuaGejala, semuaPenyakit, rules, pasien] = await Promise.all([
      Gejala.findAll({ order: [['kode', 'ASC']] }),
      Penyakit.findAll(),
      muatRules(),
      dataPasien(req.session.user.id),
    ]);

    const cfUser = keyakinanUser(req.body, semuaGejala);
    if (Object.keys(cfUser).length === 0) {
      return res.status(422).render('diagnosa/form', {
        title: 'Diagnosa',
        tingkatKeyakinan: TINGKAT_KEYAKINAN,
        gejala: semuaGejala,
        pasien,
        errors: ['Pilih minimal satu gejala yang Anda rasakan.'],
      });
    }

    const gejalaDipilih = semuaGejala
      .filter((g) => g.kode in cfUser)
      .map((g) => ({ gejalaId: g.id, cfUser: cfUser[g.kode] }));
    const penyakitByKode = Object.fromEntries(semuaPenyakit.map((p) => [p.kode, p]));

    // === 1. Forward chaining: telusuri aturan yang seluruh premisnya terpenuhi ===
    const fc = forwardChaining(Object.keys(cfUser), rules);

    // === 2. Certainty factor: hitung CF tiap penyakit dari gejala yang cocok, urutkan ===
    // Disimpan berurutan dari CF tertinggi; urutan pertama menjadi hasil diagnosa
    const hasilPenyakit = rankingPenyakit(rules, cfUser, fc.jejak)
      .filter((r) => penyakitByKode[r.konklusi])
      .map((r) => ({ penyakitId: penyakitByKode[r.konklusi].id, cf: r.cf }));

    const riwayat = await sequelize.transaction((transaction) =>
      Riwayat.create(
        {
          userId: req.session.user.id,
          tanggalDiagnosa: new Date(),
          daftarGejala: gejalaDipilih,
          daftarPenyakit: hasilPenyakit,
        },
        { include: [{ association: 'daftarGejala' }, { association: 'daftarPenyakit' }], transaction }
      )
    );

    res.redirect(`/diagnosa/hasil/${riwayat.id}`);
  } catch (err) {
    next(err);
  }
};

// Pasien hanya boleh melihat hasil miliknya sendiri; dokter dan admin boleh semua
exports.hasil = async (req, res, next) => {
  try {
    const { id: userId, role } = req.session.user;
    const riwayat = await Riwayat.findByPk(req.params.id, detailRiwayat);
    const boleh = riwayat && (role !== 'pasien' || riwayat.userId === userId);
    if (!boleh) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Hasil diagnosa tidak ditemukan.' });
    }
    const kembali = role === 'pasien' ? '/riwayat-saya' : `/${role}/riwayat`;
    res.render('diagnosa/hasil', {
      title: 'Hasil Diagnosa',
      riwayat,
      ...(await dataHasil(riwayat)),
      kembali,
      tingkatKeyakinan: TINGKAT_KEYAKINAN,
    });
  } catch (err) {
    next(err);
  }
};

exports.riwayatSaya = async (req, res, next) => {
  try {
    const riwayat = await Riwayat.findAll({ ...detailRiwayat, where: { userId: req.session.user.id } });
    res.render('pasien/riwayat', { title: 'Riwayat Saya', riwayat });
  } catch (err) {
    next(err);
  }
};
