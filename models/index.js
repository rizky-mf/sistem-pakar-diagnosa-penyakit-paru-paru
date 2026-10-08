const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Helper: kolom TEXT yang otomatis di-serialize sebagai JSON
// (lebih kompatibel antara MySQL dan MariaDB dibanding tipe JSON).
const jsonColumn = (name) => ({
  type: DataTypes.TEXT('long'),
  allowNull: false,
  get() {
    const raw = this.getDataValue(name);
    return raw ? JSON.parse(raw) : null;
  },
  set(value) {
    this.setDataValue(name, JSON.stringify(value));
  },
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

// Aktor: admin (kelola akun & sistem), dokter (pakar, kelola basis pengetahuan), pasien (diagnosa)
const User = sequelize.define('user', {
  nama: { type: DataTypes.STRING(100), allowNull: false },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'dokter', 'pasien'), allowNull: false, defaultValue: 'pasien' },
  // Khusus pasien
  jenisKelamin: { type: DataTypes.ENUM('L', 'P'), allowNull: true },
  tanggalLahir: { type: DataTypes.DATEONLY, allowNull: true },
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

const Riwayat = sequelize.define('riwayat', {
  nama: { type: DataTypes.STRING(100), allowNull: false },
  umur: { type: DataTypes.INTEGER, allowNull: false },
  jenisKelamin: { type: DataTypes.ENUM('L', 'P'), allowNull: false },
  gejala: jsonColumn('gejala'), // snapshot gejala yang dipilih
  hasil: jsonColumn('hasil'), // snapshot hasil inferensi + jejak penalaran
});

// Relasi
Penyakit.hasMany(Rule, { foreignKey: 'penyakitId', onDelete: 'CASCADE' });
Rule.belongsTo(Penyakit, { foreignKey: 'penyakitId' });

Rule.belongsToMany(Gejala, { through: 'rule_gejala', foreignKey: 'ruleId', otherKey: 'gejalaId' });
Gejala.belongsToMany(Rule, { through: 'rule_gejala', foreignKey: 'gejalaId', otherKey: 'ruleId' });

// Riwayat tetap disimpan (sebagai snapshot) walaupun akun pasien dihapus
User.hasMany(Riwayat, { foreignKey: 'userId', onDelete: 'SET NULL' });
Riwayat.belongsTo(User, { foreignKey: 'userId' });

module.exports = { sequelize, Penyakit, Gejala, Rule, User, Riwayat, hitungUmur };
