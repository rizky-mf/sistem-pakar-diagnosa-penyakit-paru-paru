/**
 * Constraint database yang tidak bisa dideklarasikan lewat model Sequelize.
 * Dipakai oleh scripts/setup-db.js dan scripts/migrate.js.
 *
 * CHECK memastikan nilai CF selalu 0-1 walaupun data dimasukkan langsung lewat
 * SQL / phpMyAdmin (validasi di model hanya berlaku lewat aplikasi).
 * Didukung MySQL 8.0.16+ dan MariaDB 10.2+.
 */
const KOLOM_CF = [
  ['rule_gejala', 'cf'],
  ['riwayat_gejala', 'cf_user'],
  ['riwayat_penyakit', 'cf'],
  ['riwayat_langkah', 'cf_pakar'],
  ['riwayat_langkah', 'cf_user'],
  ['riwayat_langkah', 'cf_gejala'],
  ['riwayat_langkah', 'cf_kombinasi'],
];

async function terapkanCheckCF(sequelize) {
  for (const [tabel, kolom] of KOLOM_CF) {
    const nama = `${tabel}_${kolom}_cek`;
    const [ada] = await sequelize.query(
      'SELECT 1 FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?',
      { replacements: [nama], type: 'SELECT' }
    );
    if (ada) continue;
    await sequelize.query(
      `ALTER TABLE \`${tabel}\` ADD CONSTRAINT \`${nama}\` CHECK (\`${kolom}\` BETWEEN 0 AND 1)`
    );
    console.log(`  + CHECK ${tabel}.${kolom} BETWEEN 0 AND 1`);
  }
}

module.exports = { KOLOM_CF, terapkanCheckCF };
