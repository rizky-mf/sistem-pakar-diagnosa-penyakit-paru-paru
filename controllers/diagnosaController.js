const { Penyakit, Gejala, Rule, Riwayat, User, hitungUmur } = require('../models');
const { forwardChaining, kecocokanParsial } = require('../services/forwardChaining');

// Mengubah aturan dari database menjadi format yang dipahami mesin inferensi
async function muatRules() {
  const ruleList = await Rule.findAll({
    include: [Penyakit, Gejala],
    order: [['kode', 'ASC']],
  });
  return ruleList.map((r) => ({
    kode: r.kode,
    premis: r.gejalas.map((g) => g.kode).sort(),
    konklusi: r.penyakit.kode,
  }));
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
    res.render('diagnosa/form', { title: 'Diagnosa', gejala, pasien, dipilih: [], errors: [] });
  } catch (err) {
    next(err);
  }
};

exports.proses = async (req, res, next) => {
  try {
    let kodeGejala = req.body.gejala || [];
    if (!Array.isArray(kodeGejala)) kodeGejala = [kodeGejala];

    const [semuaGejala, semuaPenyakit, rules, pasien] = await Promise.all([
      Gejala.findAll({ order: [['kode', 'ASC']] }),
      Penyakit.findAll(),
      muatRules(),
      dataPasien(req.session.user.id),
    ]);

    if (kodeGejala.length === 0) {
      return res.status(422).render('diagnosa/form', {
        title: 'Diagnosa',
        gejala: semuaGejala,
        pasien,
        dipilih: [],
        errors: ['Pilih minimal satu gejala.'],
      });
    }

    const gejalaDipilih = semuaGejala
      .filter((g) => kodeGejala.includes(g.kode))
      .map((g) => ({ kode: g.kode, nama: g.nama }));
    const penyakitByKode = Object.fromEntries(semuaPenyakit.map((p) => [p.kode, p]));

    // === Proses inferensi forward chaining ===
    const fc = forwardChaining(gejalaDipilih.map((g) => g.kode), rules);

    const diagnosa = fc.kesimpulan
      .filter((kode) => penyakitByKode[kode])
      .map((kode) => {
        const p = penyakitByKode[kode];
        return { kode: p.kode, nama: p.nama, deskripsi: p.deskripsi, solusi: p.solusi };
      });

    const parsial = kecocokanParsial(fc.fakta, rules)
      .filter((p) => !fc.kesimpulan.includes(p.konklusi) && penyakitByKode[p.konklusi])
      .map((p) => ({ ...p, nama: penyakitByKode[p.konklusi].nama }));

    const riwayat = await Riwayat.create({
      userId: req.session.user.id,
      ...pasien,
      gejala: gejalaDipilih,
      hasil: { diagnosa, parsial, jejak: fc.jejak, jumlahIterasi: fc.jumlahIterasi },
    });

    res.redirect(`/diagnosa/hasil/${riwayat.id}`);
  } catch (err) {
    next(err);
  }
};

// Pasien hanya boleh melihat hasil miliknya sendiri; dokter dan admin boleh semua
exports.hasil = async (req, res, next) => {
  try {
    const { id: userId, role } = req.session.user;
    const riwayat = await Riwayat.findByPk(req.params.id);
    const boleh = riwayat && (role !== 'pasien' || riwayat.userId === userId);
    if (!boleh) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Hasil diagnosa tidak ditemukan.' });
    }
    const kembali = role === 'pasien' ? '/riwayat-saya' : `/${role}/riwayat`;
    res.render('diagnosa/hasil', { title: 'Hasil Diagnosa', riwayat, kembali });
  } catch (err) {
    next(err);
  }
};

exports.riwayatSaya = async (req, res, next) => {
  try {
    const riwayat = await Riwayat.findAll({
      where: { userId: req.session.user.id },
      order: [['createdAt', 'DESC']],
    });
    res.render('pasien/riwayat', { title: 'Riwayat Saya', riwayat });
  } catch (err) {
    next(err);
  }
};
