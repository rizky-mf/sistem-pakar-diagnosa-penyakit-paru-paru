const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { interpretasi } = require('../services/certaintyFactor');

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
  cf: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1, validate: { min: 0, max: 1 } },
});

// Aktor: admin (kelola akun & sistem), dokter (pakar, kelola basis pengetahuan), pasien (diagnosa)
const User = sequelize.define('user', {
  nama: { type: DataTypes.STRING(100), allowNull: false },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'dokter', 'pasien'), allowNull: false, defaultValue: 'pasien' },
  // Khusus pasien
  jenisKelamin: { type: DataTypes.ENUM('L', 'P'), allowNull: true },
  tanggalLahir: { type: DataTypes.DATEONLY, allowNull: true },
  // Khusus dokter: ketua memvalidasi usulan basis pengetahuan dari dokter lain
  ketua: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

// ===== Usulan basis pengetahuan =====
// Tambahan/perubahan dari dokter (bukan ketua) disimpan sebagai usulan. Data di tabel
// penyakit, gejala, dan rule tetap versi yang sudah disetujui sampai usulan divalidasi ketua.
const kolomValidasi = {
  status: { type: DataTypes.ENUM('menunggu', 'disetujui', 'ditolak'), allowNull: false, defaultValue: 'menunggu' },
  catatan: { type: DataTypes.TEXT, allowNull: true }, // alasan dari ketua
  tanggalValidasi: { type: DataTypes.DATE, allowNull: true },
};

const UsulanPenyakit = sequelize.define('usulan_penyakit', {
  kode: { type: DataTypes.STRING(10), allowNull: false },
  nama: { type: DataTypes.STRING(100), allowNull: false },
  deskripsi: { type: DataTypes.TEXT, allowNull: false },
  solusi: { type: DataTypes.TEXT, allowNull: false },
  ...kolomValidasi,
});

const UsulanGejala = sequelize.define('usulan_gejala', {
  kode: { type: DataTypes.STRING(10), allowNull: false },
  nama: { type: DataTypes.STRING(255), allowNull: false },
  ...kolomValidasi,
});

const UsulanRule = sequelize.define('usulan_rule', {
  kode: { type: DataTypes.STRING(10), allowNull: false },
  ...kolomValidasi,
});

// Gejala yang diusulkan bersama penyakit baru (menjadi aturan saat disetujui).
// gejala_id terisi = gejala yang sudah ada; kosong = gejala baru dengan nama yang diusulkan.
const UsulanPenyakitGejala = sequelize.define('usulan_penyakit_gejala', {
  nama: { type: DataTypes.STRING(255), allowNull: true },
  cf: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1, validate: { min: 0, max: 1 } },
});

// Premis aturan yang diusulkan beserta CF pakar
const UsulanRuleGejala = sequelize.define('usulan_rule_gejala', {
  cf: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1, validate: { min: 0, max: 1 } },
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
  cfUser: { type: DataTypes.FLOAT, allowNull: false },
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
});

// Hasil diagnosa: nilai CF setiap penyakit
const RiwayatPenyakit = sequelize.define('riwayat_penyakit', {
  cf: { type: DataTypes.FLOAT, allowNull: false },
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
});

// Relasi
Penyakit.hasMany(Rule, { foreignKey: 'penyakitId', onDelete: 'CASCADE' });
Rule.belongsTo(Penyakit, { foreignKey: 'penyakitId' });

Rule.belongsToMany(Gejala, { through: RuleGejala, foreignKey: 'ruleId', otherKey: 'gejalaId' });
Gejala.belongsToMany(Rule, { through: RuleGejala, foreignKey: 'gejalaId', otherKey: 'ruleId' });

// Usulan: target kosong (NULL) berarti usulan data baru, terisi berarti usulan perubahan.
// Jika data target dihapus, usulannya ikut terhapus.
Penyakit.hasMany(UsulanPenyakit, { foreignKey: 'penyakitId', onDelete: 'CASCADE' });
UsulanPenyakit.belongsTo(Penyakit, { foreignKey: 'penyakitId', as: 'target' });
Gejala.hasMany(UsulanGejala, { foreignKey: 'gejalaId', onDelete: 'CASCADE' });
UsulanGejala.belongsTo(Gejala, { foreignKey: 'gejalaId', as: 'target' });
Rule.hasMany(UsulanRule, { foreignKey: 'ruleId', onDelete: 'CASCADE' });
UsulanRule.belongsTo(Rule, { foreignKey: 'ruleId', as: 'target' });

UsulanPenyakit.hasMany(UsulanPenyakitGejala, { as: 'daftarGejala', foreignKey: { name: 'usulanPenyakitId', allowNull: false }, onDelete: 'CASCADE' });
UsulanPenyakitGejala.belongsTo(UsulanPenyakit, { foreignKey: { name: 'usulanPenyakitId', allowNull: false } });
Gejala.hasMany(UsulanPenyakitGejala, { foreignKey: 'gejalaId', onDelete: 'CASCADE' });
UsulanPenyakitGejala.belongsTo(Gejala, { foreignKey: 'gejalaId' });

// Penyakit (THEN) dan gejala (IF) pada usulan aturan harus data yang sudah disetujui
Penyakit.hasMany(UsulanRule, { foreignKey: { name: 'penyakitId', allowNull: false }, as: 'usulanRuleThen', onDelete: 'CASCADE' });
UsulanRule.belongsTo(Penyakit, { foreignKey: { name: 'penyakitId', allowNull: false } });
UsulanRule.belongsToMany(Gejala, { through: UsulanRuleGejala, foreignKey: 'usulanRuleId', otherKey: 'gejalaId' });
Gejala.belongsToMany(UsulanRule, { through: UsulanRuleGejala, foreignKey: 'gejalaId', otherKey: 'usulanRuleId' });

// Pengusul dan validator (dokter). Jika akunnya dihapus, usulan tetap ada.
for (const Usulan of [UsulanPenyakit, UsulanGejala, UsulanRule]) {
  User.hasMany(Usulan, { foreignKey: 'diajukanOleh', as: `${Usulan.name}_diajukan`, onDelete: 'SET NULL' });
  Usulan.belongsTo(User, { foreignKey: 'diajukanOleh', as: 'pengusul' });
  User.hasMany(Usulan, { foreignKey: 'divalidasiOleh', as: `${Usulan.name}_divalidasi`, onDelete: 'SET NULL' });
  Usulan.belongsTo(User, { foreignKey: 'divalidasiOleh', as: 'validator' });
}

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

// Opsi query untuk memuat riwayat beserta pasien, gejala, dan penyakitnya
const detailRiwayat = {
  include: [
    { model: User, attributes: ['id', 'nama', 'jenisKelamin', 'tanggalLahir'] },
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
  UsulanPenyakit,
  UsulanPenyakitGejala,
  UsulanGejala,
  UsulanRule,
  UsulanRuleGejala,
  detailRiwayat,
  hitungUmur,
};
