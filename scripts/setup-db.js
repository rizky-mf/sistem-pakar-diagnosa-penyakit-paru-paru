/**
 * Membuat database (jika belum ada), membuat ulang semua tabel,
 * lalu mengisi data awal basis pengetahuan dan akun admin.
 *
 * PERINGATAN: semua data lama di tabel akan dihapus.
 * Jalankan: npm run db:setup
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function buatDatabase() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
  await conn.end();
}

async function main() {
  await buatDatabase();

  const { sequelize, Penyakit, Gejala, Rule, User } = require('../models');
  const data = require('../seeders/data');

  await sequelize.sync({ force: true });

  const penyakitList = await Penyakit.bulkCreate(data.penyakit);
  const gejalaList = await Gejala.bulkCreate(data.gejala);

  const penyakitByKode = Object.fromEntries(penyakitList.map((p) => [p.kode, p]));
  const gejalaByKode = Object.fromEntries(gejalaList.map((g) => [g.kode, g]));

  for (const r of data.rules) {
    const rule = await Rule.create({ kode: r.kode, penyakitId: penyakitByKode[r.penyakit].id });
    await rule.setGejalas(r.premis.map((k) => gejalaByKode[k]));
  }

  for (const u of data.users) {
    await User.create({ ...u, password: await bcrypt.hash(u.password, 10) });
  }

  console.log('Database siap.');
  console.log(`  ${data.penyakit.length} penyakit, ${data.gejala.length} gejala, ${data.rules.length} aturan`);
  console.log('  Akun login:');
  for (const u of data.users) console.log(`    ${u.role.padEnd(7)} ${u.username} / ${u.password}`);
  await sequelize.close();
}

main().catch((err) => {
  console.error('Gagal setup database:', err.message);
  process.exit(1);
});
