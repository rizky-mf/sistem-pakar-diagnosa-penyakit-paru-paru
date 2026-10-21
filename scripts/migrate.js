/**
 * Memperbarui struktur tabel pada database yang sudah ada TANPA menghapus data:
 *  - riwayat.tanggal_diagnosa (waktu hasil diagnosa keluar), data lama diisi dari created_at
 *  - rule_gejala.cf (CF pakar per premis aturan), data lama diisi 1
 *
 * Aman dijalankan berulang kali. Jalankan: npm run db:migrate
 */
require('dotenv').config();
const { DataTypes } = require('sequelize');
const { sequelize } = require('../models');

async function main() {
  const qi = sequelize.getQueryInterface();

  const riwayat = await qi.describeTable('riwayat');
  if (!riwayat.tanggal_diagnosa) {
    await qi.addColumn('riwayat', 'tanggal_diagnosa', { type: DataTypes.DATE, allowNull: true });
    await sequelize.query('UPDATE riwayat SET tanggal_diagnosa = created_at');
    await qi.changeColumn('riwayat', 'tanggal_diagnosa', { type: DataTypes.DATE, allowNull: false });
    console.log('  + riwayat.tanggal_diagnosa');
  }

  const ruleGejala = await qi.describeTable('rule_gejala');
  if (!ruleGejala.cf) {
    await qi.addColumn('rule_gejala', 'cf', { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1 });
    console.log('  + rule_gejala.cf (isi nilai CF pakar lewat menu Aturan di panel dokter)');
  }

  console.log('Migrasi selesai.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Gagal migrasi:', err.message);
  process.exit(1);
});
