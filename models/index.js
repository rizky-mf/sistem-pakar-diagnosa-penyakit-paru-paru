const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { interpretasi } = require('../services/certaintyFactor');

// Nilai certainty factor 0-1 disimpan sebagai DECIMAL (nilai pasti, bukan perkiraan
// seperti FLOAT). Batas 0-1 juga dijaga di database lewat CHECK (models/constraints.js).
const kolomCF = (opsi = {}) => ({
  type: DataTypes.DECIMAL(5, 4),
  allowNull: false,
  validate: { min: 0, max: 1 },
  ...opsi,
});

const Penyakit = sequelize.define('penyakit', {
  kode: { type: DataTypes.STRING(10), allowNull: false, unique: true },
  nama: { type: DataTypes.STRING(100), allowNull: false },
  deskripsi: { type: DataTypes.TEXT, allowNull: false },
  solusi: { type: DataTypes.TEXT, allowNull: false },
});

const Gejala = sequelize.define('gejala', {
  kode: { type: DataTypes.STRING(10), allowNull: false, unique: true },
  nama: { type: DataTypes.STRING(255), allowNull: false },
});

// Aturan (rule): IF gejala1 AND gejala2 AND ... THEN penyakit
const Rule = sequelize.define('rule', {
  kode: { type: DataTypes.STRING(10), allowNull: false, unique: true },
});

// Premis aturan beserta CF pakar (bobot keyakinan gejala terhadap penyakit, 0-1)
const RuleGejala = sequelize.define('rule_gejala', {
  cf: kolomCF({ defaultValue: 1 }),
});

// Aktor: admin (kelola akun & sistem), dokter (pakar, kelola basis pengetahuan), pasien (diagnosa)
const User = sequelize.define('user', {
  nama: { type: DataTypes.STRING(100), allowNull: false },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'dokter', 'pasien'), allowNull: false, defaultValue: 'pasien' },
  // Khusus pasien
  // ID pasien otomatis (PSN + tahun + nomor urut, misalnya PSN20260001), bisa dipakai untuk login; tidak dapat diubah
  kodePasien: { type: DataTypes.STRING(20), allowNull: true, unique: true },
  jenisKelamin: { type: DataTypes.ENUM('L', 'P'), allowNull: true },
  tanggalLahir: { type: DataTypes.DATEONLY, allowNull: true },
  // True untuk akun yang kata sandinya dibuat/di-reset admin: wajib diganti saat login berikutnya
  wajibGantiPassword: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

// Umur dihitung dari tanggal lahir
function hitungUmur(tanggalLahir, pada = new Date()) {
  const lahir = new Date(tanggalLahir);
  let umur = pada.getFullYear() - lahir.getFullYear();
  const belumUlangTahun =
    pada.getMonth() < lahir.getMonth() ||
    (pada.getMonth() === lahir.getMonth() && pada.getDate() < lahir.getDate());
  if (belumUlangTahun) umur--;
  return umur;
}

// Satu kali diagnosa (konsultasi) oleh pasien
const Riwayat = sequelize.define('riwayat', {
  // Waktu hasil diagnosa keluar setelah proses inferensi selesai
  tanggalDiagnosa: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  // Banyaknya iterasi forward chaining hingga tidak ada fakta baru
  jumlahIterasi: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  // Data pasien diambil dari relasi user (harus ikut dimuat lewat include)
  nama: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.user ? this.user.nama : '';
    },
  },
  jenisKelamin: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.user ? this.user.jenisKelamin : null;
    },
  },
  kodePasien: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.user ? this.user.kodePasien : null;
    },
  },
  // Umur pasien pada saat diagnosa
  umur: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.user ? hitungUmur(this.user.tanggalLahir, new Date(this.tanggalDiagnosa)) : null;
    },
  },
  // Penyakit diurutkan dari CF tertinggi: urutan pertama = hasil diagnosa, sisanya kemungkinan lain
  diagnosa: {
    type: DataTypes.VIRTUAL,
    get() {
      return (this.daftarPenyakit || []).slice(0, 1);
    },
  },
  lainnya: {
    type: DataTypes.VIRTUAL,
    get() {
      return (this.daftarPenyakit || []).slice(1);
    },
  },
});

// Detail gejala yang dirasakan pasien beserta tingkat keyakinannya (CF user)
const RiwayatGejala = sequelize.define('riwayat_gejala', {
  cfUser: kolomCF(),
  kode: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.gejala ? this.gejala.kode : '';
    },
  },
  nama: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.gejala ? this.gejala.nama : '';
    },
  },
}, {
  // Satu gejala hanya boleh tercatat sekali dalam satu riwayat
  indexes: [{ name: 'riwayat_gejala_unik', unique: true, fields: ['riwayat_id', 'gejala_id'] }],
});

// Hasil diagnosa: nilai CF setiap penyakit beserta aturan yang menghasilkannya.
// Disimpan saat diagnosa (snapshot) sehingga tidak berubah bila basis aturan diubah.
const RiwayatPenyakit = sequelize.define('riwayat_penyakit', {
  cf: kolomCF(),
  // Kosong hanya untuk riwayat lama yang aturannya sudah tidak ada saat migrasi
  ruleKode: { type: DataTypes.STRING(10), allowNull: true },
  gejalaCocok: { type: DataTypes.INTEGER, allowNull: true },
  gejalaTotal: { type: DataTypes.INTEGER, allowNull: true },
  ...Object.fromEntries(
    ['kode', 'nama', 'deskripsi', 'solusi'].map((f) => [
      f,
      {
        type: DataTypes.VIRTUAL,
        get() {
          return this.penyakit ? this.penyakit[f] : '';
        },
      },
    ])
  ),
  persen: {
    type: DataTypes.VIRTUAL,
    get() {
      return Math.round(this.getDataValue('cf') * 10000) / 100;
    },
  },
  interpretasi: {
    type: DataTypes.VIRTUAL,
    get() {
      return interpretasi(this.getDataValue('cf'));
    },
  },
}, {
  // Satu penyakit hanya boleh muncul sekali dalam satu riwayat
  indexes: [{ name: 'riwayat_penyakit_unik', unique: true, fields: ['riwayat_id', 'penyakit_id'] }],
});

// Langkah perhitungan certainty factor satu penyakit pada saat diagnosa.
// kodeFakta berupa kode gejala, atau kode penyakit bila hasil aturan berantai.
const RiwayatLangkah = sequelize.define('riwayat_langkah', {
  urutan: { type: DataTypes.INTEGER, allowNull: false },
  kodeFakta: { type: DataTypes.STRING(10), allowNull: false },
  cfPakar: kolomCF(),
  cfUser: kolomCF(),
  cfGejala: kolomCF(),
  cfKombinasi: kolomCF(),
}, {
  indexes: [{ name: 'riwayat_langkah_unik', unique: true, fields: ['riwayat_penyakit_id', 'urutan'] }],
});

// Jejak penalaran forward chaining: aturan yang terpenuhi pada saat diagnosa
const RiwayatJejak = sequelize.define('riwayat_jejak', {
  urutan: { type: DataTypes.INTEGER, allowNull: false },
  iterasi: { type: DataTypes.INTEGER, allowNull: false },
  ruleKode: { type: DataTypes.STRING(10), allowNull: false },
  konklusiKode: { type: DataTypes.STRING(10), allowNull: false },
}, {
  indexes: [{ name: 'riwayat_jejak_unik', unique: true, fields: ['riwayat_id', 'urutan'] }],
});

// Premis (IF) dari setiap aturan pada jejak penalaran
const RiwayatJejakPremis = sequelize.define('riwayat_jejak_premis', {
  urutan: { type: DataTypes.INTEGER, allowNull: false },
  kodeFakta: { type: DataTypes.STRING(10), allowNull: false },
}, {
  indexes: [{ name: 'riwayat_jejak_premis_unik', unique: true, fields: ['riwayat_jejak_id', 'urutan'] }],
});

// Relasi
Penyakit.hasMany(Rule, { foreignKey: 'penyakitId', onDelete: 'CASCADE' });
Rule.belongsTo(Penyakit, { foreignKey: 'penyakitId' });

Rule.belongsToMany(Gejala, { through: RuleGejala, foreignKey: 'ruleId', otherKey: 'gejalaId' });
Gejala.belongsToMany(Rule, { through: RuleGejala, foreignKey: 'gejalaId', otherKey: 'ruleId' });

// Menghapus akun pasien ikut menghapus riwayat diagnosanya
User.hasMany(Riwayat, { foreignKey: { name: 'userId', allowNull: false }, onDelete: 'CASCADE' });
Riwayat.belongsTo(User, { foreignKey: { name: 'userId', allowNull: false } });

// Detail riwayat ikut terhapus bersama riwayatnya. Gejala/penyakit yang sudah
// dipakai pada riwayat tidak dapat dihapus (RESTRICT).
Riwayat.hasMany(RiwayatGejala, { as: 'daftarGejala', foreignKey: { name: 'riwayatId', allowNull: false }, onDelete: 'CASCADE' });
RiwayatGejala.belongsTo(Riwayat, { foreignKey: { name: 'riwayatId', allowNull: false } });
Gejala.hasMany(RiwayatGejala, { foreignKey: { name: 'gejalaId', allowNull: false }, onDelete: 'RESTRICT' });
RiwayatGejala.belongsTo(Gejala, { foreignKey: { name: 'gejalaId', allowNull: false } });

Riwayat.hasMany(RiwayatPenyakit, { as: 'daftarPenyakit', foreignKey: { name: 'riwayatId', allowNull: false }, onDelete: 'CASCADE' });
RiwayatPenyakit.belongsTo(Riwayat, { foreignKey: { name: 'riwayatId', allowNull: false } });
Penyakit.hasMany(RiwayatPenyakit, { foreignKey: { name: 'penyakitId', allowNull: false }, onDelete: 'RESTRICT' });
RiwayatPenyakit.belongsTo(Penyakit, { foreignKey: { name: 'penyakitId', allowNull: false } });

RiwayatPenyakit.hasMany(RiwayatLangkah, { as: 'langkah', foreignKey: { name: 'riwayatPenyakitId', allowNull: false }, onDelete: 'CASCADE' });
RiwayatLangkah.belongsTo(RiwayatPenyakit, { foreignKey: { name: 'riwayatPenyakitId', allowNull: false } });

Riwayat.hasMany(RiwayatJejak, { as: 'jejak', foreignKey: { name: 'riwayatId', allowNull: false }, onDelete: 'CASCADE' });
RiwayatJejak.belongsTo(Riwayat, { foreignKey: { name: 'riwayatId', allowNull: false } });
RiwayatJejak.hasMany(RiwayatJejakPremis, { as: 'premis', foreignKey: { name: 'riwayatJejakId', allowNull: false }, onDelete: 'CASCADE' });
RiwayatJejakPremis.belongsTo(RiwayatJejak, { foreignKey: { name: 'riwayatJejakId', allowNull: false } });

// Opsi query untuk memuat riwayat beserta pasien, gejala, dan penyakitnya
const detailRiwayat = {
  include: [
    { model: User, attributes: ['id', 'nama', 'kodePasien', 'jenisKelamin', 'tanggalLahir'] },
    { model: RiwayatGejala, as: 'daftarGejala', include: [Gejala] },
    { model: RiwayatPenyakit, as: 'daftarPenyakit', include: [Penyakit] },
  ],
  order: [
    ['tanggalDiagnosa', 'DESC'],
    [{ model: RiwayatGejala, as: 'daftarGejala' }, Gejala, 'kode', 'ASC'],
    // Urutan simpan (id) menjaga aturan pemecah nilai CF yang sama
    [{ model: RiwayatPenyakit, as: 'daftarPenyakit' }, 'cf', 'DESC'],
    [{ model: RiwayatPenyakit, as: 'daftarPenyakit' }, 'id', 'ASC'],
  ],
};

// Seperti detailRiwayat, ditambah langkah perhitungan CF dan jejak penalaran
// (untuk halaman hasil satu riwayat)
const rincianRiwayat = {
  include: [
    detailRiwayat.include[0],
    detailRiwayat.include[1],
    {
      model: RiwayatPenyakit,
      as: 'daftarPenyakit',
      include: [Penyakit, { model: RiwayatLangkah, as: 'langkah' }],
    },
    { model: RiwayatJejak, as: 'jejak', include: [{ model: RiwayatJejakPremis, as: 'premis' }] },
  ],
  order: [
    ...detailRiwayat.order,
    [{ model: RiwayatPenyakit, as: 'daftarPenyakit' }, { model: RiwayatLangkah, as: 'langkah' }, 'urutan', 'ASC'],
    [{ model: RiwayatJejak, as: 'jejak' }, 'urutan', 'ASC'],
    [{ model: RiwayatJejak, as: 'jejak' }, { model: RiwayatJejakPremis, as: 'premis' }, 'urutan', 'ASC'],
  ],
};

module.exports = {
  sequelize,
  Penyakit,
  Gejala,
  Rule,
  RuleGejala,
  User,
  Riwayat,
  RiwayatGejala,
  RiwayatPenyakit,
  RiwayatLangkah,
  RiwayatJejak,
  RiwayatJejakPremis,
  detailRiwayat,
  rincianRiwayat,
  hitungUmur,
};
