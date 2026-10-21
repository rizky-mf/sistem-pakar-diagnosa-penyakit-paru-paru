/**
 * Memperbarui struktur tabel pada database yang sudah ada TANPA menghapus data utama:
 *  - riwayat.tanggal_diagnosa (waktu hasil diagnosa keluar), data lama diisi dari created_at
 *  - rule_gejala.cf (CF pakar per premis aturan), data lama diisi 1
 *  - tabel detail riwayat_gejala (riwayat_id, gejala_id, cf_user) dan
 *    riwayat_penyakit (riwayat_id, penyakit_id, cf); data lama dipindahkan dari kolom JSON
 *  - kolom salinan/JSON lama di tabel riwayat dan tabel detail dihapus
 *  - user.ketua (dokter ketua) dan tabel usulan_penyakit, usulan_gejala, usulan_rule,
 *    usulan_rule_gejala, usulan_penyakit_gejala; akun "dokter" dijadikan ketua bila belum ada ketua
 *
 * Aman dijalankan berulang kali. Jalankan: npm run db:migrate
 */
require('dotenv').config();
const { DataTypes } = require('sequelize');
const {
  sequelize,
  User,
  RiwayatGejala,
  RiwayatPenyakit,
  UsulanPenyakit,
  UsulanPenyakitGejala,
  UsulanGejala,
  UsulanRule,
  UsulanRuleGejala,
} = require('../models');

const qi = sequelize.getQueryInterface();
const query = (sql, replacements) => sequelize.query(sql, { replacements });

async function kolom(tabel) {
  return qi.describeTable(tabel);
}

async function hapusKolom(tabel, daftar) {
  const ada = await kolom(tabel);
  const dihapus = daftar.filter((k) => ada[k]);
  for (const k of dihapus) await qi.removeColumn(tabel, k);
  if (dihapus.length) console.log(`  - ${tabel}: hapus kolom ${dihapus.join(', ')}`);
}

// Memastikan kolom foreign key NOT NULL dengan aturan ON DELETE yang diinginkan
async function aturFK(tabel, kolomFK, rujukan, onDelete) {
  const [[fk]] = await query(
    `SELECT k.CONSTRAINT_NAME nama, r.DELETE_RULE aturan, c.IS_NULLABLE kosong
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r
         ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       JOIN information_schema.COLUMNS c
         ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME AND c.COLUMN_NAME = k.COLUMN_NAME
      WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = ? AND k.COLUMN_NAME = ?`,
    [tabel, kolomFK]
  );
  if (fk && fk.aturan === onDelete && fk.kosong === 'NO') return;

  await query(`DELETE FROM \`${tabel}\` WHERE \`${kolomFK}\` IS NULL`);
  if (fk) await query(`ALTER TABLE \`${tabel}\` DROP FOREIGN KEY \`${fk.nama}\``);
  await query(`ALTER TABLE \`${tabel}\` MODIFY \`${kolomFK}\` INT(11) NOT NULL`);
  await query(
    `ALTER TABLE \`${tabel}\` ADD CONSTRAINT \`${tabel}_${kolomFK}_fk\` FOREIGN KEY (\`${kolomFK}\`)
     REFERENCES \`${rujukan}\` (\`id\`) ON DELETE ${onDelete} ON UPDATE CASCADE`
  );
  console.log(`  ~ ${tabel}.${kolomFK} -> ${rujukan}.id (NOT NULL, ON DELETE ${onDelete})`);
}

// Riwayat versi awal menyimpan gejala & hasil sebagai JSON di tabel riwayat
async function pindahkanDariJSON() {
  const [gejala] = await query('SELECT id, kode FROM gejala');
  const [penyakit] = await query('SELECT id, kode FROM penyakit');
  const gejalaId = Object.fromEntries(gejala.map((g) => [g.kode, g.id]));
  const penyakitId = Object.fromEntries(penyakit.map((p) => [p.kode, p.id]));
  const [baris] = await query('SELECT id, gejala, hasil FROM riwayat');

  for (const r of baris) {
    const daftarGejala = JSON.parse(r.gejala || '[]').filter((g) => gejalaId[g.kode]);
    const hasil = JSON.parse(r.hasil || '{}');
    const daftarPenyakit = [...(hasil.diagnosa || []), ...(hasil.lainnya || [])].filter((p) => penyakitId[p.kode]);

    await RiwayatGejala.bulkCreate(
      daftarGejala.map((g) => ({ riwayatId: r.id, gejalaId: gejalaId[g.kode], cfUser: g.cfUser ?? 1 }))
    );
    // Riwayat sebelum certainty factor tidak memiliki nilai CF
    await RiwayatPenyakit.bulkCreate(
      daftarPenyakit.map((p) => ({ riwayatId: r.id, penyakitId: penyakitId[p.kode], cf: p.cf ?? 0 }))
    );
  }
  await qi.removeColumn('riwayat', 'gejala');
  console.log(`  + ${baris.length} riwayat dipindahkan dari kolom JSON ke riwayat_gejala & riwayat_penyakit`);
}

async function main() {
  const riwayat = await kolom('riwayat');
  if (!riwayat.tanggal_diagnosa) {
    await qi.addColumn('riwayat', 'tanggal_diagnosa', { type: DataTypes.DATE, allowNull: true });
    await query('UPDATE riwayat SET tanggal_diagnosa = created_at');
    await qi.changeColumn('riwayat', 'tanggal_diagnosa', { type: DataTypes.DATE, allowNull: false });
    console.log('  + riwayat.tanggal_diagnosa');
  }

  if (!(await kolom('rule_gejala')).cf) {
    await qi.addColumn('rule_gejala', 'cf', { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1 });
    console.log('  + rule_gejala.cf (isi nilai CF pakar lewat menu Aturan di panel dokter)');
  }

  // Tabel detail riwayat (dibuat jika belum ada)
  await RiwayatGejala.sync();
  await RiwayatPenyakit.sync();
  if ((await kolom('riwayat')).gejala) await pindahkanDariJSON();

  // Sederhanakan tabel detail: hanya foreign key dan nilai CF
  await hapusKolom('riwayat_gejala', ['kode', 'nama']);
  await hapusKolom('riwayat_penyakit', [
    'kode', 'nama', 'deskripsi', 'solusi', 'peringkat', 'utama', 'rule', 'cocok', 'total', 'lengkap', 'langkah',
  ]);
  await query('UPDATE riwayat_gejala SET cf_user = 1 WHERE cf_user IS NULL');
  await query('UPDATE riwayat_penyakit SET cf = 0 WHERE cf IS NULL');
  await qi.changeColumn('riwayat_gejala', 'cf_user', { type: DataTypes.FLOAT, allowNull: false });
  await qi.changeColumn('riwayat_penyakit', 'cf', { type: DataTypes.FLOAT, allowNull: false });

  await aturFK('riwayat', 'user_id', 'user', 'CASCADE');
  await aturFK('riwayat_gejala', 'riwayat_id', 'riwayat', 'CASCADE');
  await aturFK('riwayat_gejala', 'gejala_id', 'gejala', 'RESTRICT');
  await aturFK('riwayat_penyakit', 'riwayat_id', 'riwayat', 'CASCADE');
  await aturFK('riwayat_penyakit', 'penyakit_id', 'penyakit', 'RESTRICT');

  // Data pasien kini diambil dari tabel user, hasil dari tabel detail
  await hapusKolom('riwayat', ['nama', 'umur', 'jenis_kelamin', 'hasil']);

  // Validasi basis pengetahuan oleh dokter ketua
  if (!(await kolom('user')).ketua) {
    await qi.addColumn('user', 'ketua', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
    console.log('  + user.ketua');
  }
  if (!(await User.count({ where: { ketua: true } }))) {
    const [n] = await User.update({ ketua: true }, { where: { username: 'dokter', role: 'dokter' } });
    if (n) console.log('  ~ akun "dokter" dijadikan dokter ketua');
  }
  for (const M of [UsulanPenyakit, UsulanPenyakitGejala, UsulanGejala, UsulanRule, UsulanRuleGejala]) await M.sync();

  console.log('Migrasi selesai.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Gagal migrasi:', err.message);
  process.exit(1);
});
