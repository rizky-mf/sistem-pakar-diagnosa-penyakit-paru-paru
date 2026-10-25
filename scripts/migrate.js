/**
 * Memperbarui struktur tabel pada database yang sudah ada TANPA menghapus data utama:
 *  - riwayat.tanggal_diagnosa (waktu hasil diagnosa keluar), data lama diisi dari created_at
 *  - rule_gejala.cf (CF pakar per premis aturan), data lama diisi 1
 *  - tabel detail riwayat_gejala (riwayat_id, gejala_id, cf_user) dan
 *    riwayat_penyakit (riwayat_id, penyakit_id, cf); data lama dipindahkan dari kolom JSON
 *  - kolom salinan/JSON lama di tabel riwayat dan tabel detail dihapus
 *  - fitur dokter ketua & usulan dihapus: tabel usulan_* dan kolom user.ketua dihapus
 *  - semua kolom CF: FLOAT -> DECIMAL(5,4) dan CHECK (cf BETWEEN 0 AND 1)
 *  - UNIQUE (riwayat_id, gejala_id) dan (riwayat_id, penyakit_id) pada detail riwayat
 *  - riwayat tetap (immutable): riwayat.jumlah_iterasi, riwayat_penyakit.rule_kode/gejala_cocok/
 *    gejala_total, tabel riwayat_langkah, riwayat_jejak, riwayat_jejak_premis; riwayat lama
 *    dilengkapi sekali dengan basis aturan saat migrasi
 *  - user.kode_pasien (ID pasien PSN+tahun+nomor, UNIQUE) dan user.wajib_ganti_password;
 *    pasien lama diberi ID berurutan sesuai tanggal daftar; ID format lama PSN-2026-0001 diubah ke PSN20260001
 *
 * Aman dijalankan berulang kali. Jalankan: npm run db:migrate
 */
require('dotenv').config();
const { DataTypes } = require('sequelize');
const {
  sequelize,
  Penyakit,
  RiwayatGejala,
  RiwayatPenyakit,
  RiwayatLangkah,
  RiwayatJejak,
  RiwayatJejakPremis,
} = require('../models');
const { terapkanCheckCF } = require('../models/constraints');
const { muatRules } = require('../controllers/helpers');
const { jalankanInferensi, barisRiwayat } = require('../services/inferensi');
const { formatKode, nomorTerakhir } = require('../services/akunPasien');

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

// Nilai CF disimpan sebagai DECIMAL(5,4) agar pasti (FLOAT hanya nilai perkiraan)
async function jadikanDecimal(tabel, kolomCF, opsi = {}) {
  const info = (await kolom(tabel))[kolomCF];
  if (!info || !/^(FLOAT|DOUBLE)/i.test(info.type)) return;
  await qi.changeColumn(tabel, kolomCF, { type: DataTypes.DECIMAL(5, 4), allowNull: false, ...opsi });
  console.log(`  ~ ${tabel}.${kolomCF}: ${info.type} -> DECIMAL(5,4)`);
}

// Kunci unik gabungan; baris ganda dibuang lebih dulu (disisakan id terkecil)
async function tambahUnik(tabel, nama, kolomUnik) {
  const [ada] = await query(
    'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
    [tabel, nama]
  );
  if (ada.length) return;
  const sama = kolomUnik.map((k) => `a.\`${k}\` = b.\`${k}\``).join(' AND ');
  await query(`DELETE a FROM \`${tabel}\` a JOIN \`${tabel}\` b ON ${sama} AND a.id > b.id`);
  await qi.addIndex(tabel, kolomUnik, { name: nama, unique: true });
  console.log(`  + UNIQUE ${tabel} (${kolomUnik.join(', ')})`);
}

async function tambahKolom(tabel, nama, definisi) {
  if ((await kolom(tabel))[nama]) return;
  await qi.addColumn(tabel, nama, definisi);
  console.log(`  + ${tabel}.${nama}`);
}

// Pasien yang belum punya ID diberi ID berurutan per tahun daftar (created_at)
async function isiKodePasienLama() {
  const [tanpaKode] = await query(
    "SELECT id, YEAR(created_at) AS tahun FROM `user` WHERE role = 'pasien' AND kode_pasien IS NULL ORDER BY created_at, id"
  );
  if (!tanpaKode.length) return;
  const [ada] = await query('SELECT kode_pasien FROM `user` WHERE kode_pasien IS NOT NULL');
  const terakhir = {};
  for (const { id, tahun } of tanpaKode) {
    if (terakhir[tahun] === undefined) {
      terakhir[tahun] = nomorTerakhir(ada.map((r) => r.kode_pasien).filter((k) => k.startsWith(`PSN${tahun}`)));
    }
    terakhir[tahun] += 1;
    await query('UPDATE `user` SET kode_pasien = ? WHERE id = ?', [formatKode(tahun, terakhir[tahun]), id]);
  }
  console.log(`  ${tanpaKode.length} pasien lama diberi ID pasien`);
}

/**
 * Riwayat yang dibuat sebelum hasil disimpan lengkap hanya punya CF akhir.
 * Jejak penalaran dan langkah perhitungannya dilengkapi SEKALI memakai basis aturan
 * saat migrasi; setelah itu tersimpan tetap. Nilai CF akhir yang tersimpan tidak diubah.
 */
async function lengkapiRiwayatLama() {
  const [lama] = await query('SELECT id FROM riwayat WHERE jumlah_iterasi IS NULL');
  if (!lama.length) return;

  const rules = await muatRules();
  const idPenyakit = Object.fromEntries((await Penyakit.findAll()).map((p) => [p.kode, p.id]));

  for (const { id } of lama) {
    await sequelize.transaction(async (transaction) => {
      const [gejala] = await sequelize.query(
        `SELECT g.kode, rg.cf_user FROM riwayat_gejala rg JOIN gejala g ON g.id = rg.gejala_id
          WHERE rg.riwayat_id = ?`,
        { replacements: [id], transaction }
      );
      const cfUser = Object.fromEntries(gejala.map((g) => [g.kode, Number(g.cf_user)]));
      const baris = barisRiwayat(jalankanInferensi(rules, cfUser), idPenyakit);

      const tersimpan = await RiwayatPenyakit.findAll({ where: { riwayatId: id }, transaction });
      const byPenyakit = Object.fromEntries(tersimpan.map((rp) => [rp.penyakitId, rp]));
      for (const p of baris.daftarPenyakit) {
        const rp = byPenyakit[p.penyakitId];
        if (!rp) continue;
        await rp.update({ ruleKode: p.ruleKode, gejalaCocok: p.gejalaCocok, gejalaTotal: p.gejalaTotal }, { transaction });
        await RiwayatLangkah.bulkCreate(
          p.langkah.map((l) => ({ ...l, riwayatPenyakitId: rp.id })),
          { transaction }
        );
      }
      for (const j of baris.jejak) {
        await RiwayatJejak.create({ ...j, riwayatId: id }, { include: [{ association: 'premis' }], transaction });
      }
      await sequelize.query('UPDATE riwayat SET jumlah_iterasi = ? WHERE id = ?', {
        replacements: [baris.jumlahIterasi, id],
        transaction,
      });
    });
  }
  console.log(`  + ${lama.length} riwayat lama dilengkapi jejak penalaran & langkah perhitungan CF`);
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
    await qi.addColumn('rule_gejala', 'cf', { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 1 });
    console.log('  + rule_gejala.cf (isi nilai CF pakar lewat menu Aturan di panel dokter)');
  }

  // Tabel detail riwayat (dibuat jika belum ada)
  await RiwayatGejala.sync();
  await RiwayatPenyakit.sync();
  // Kolom hasil tetap (dibutuhkan model sebelum data lama dipindahkan)
  await tambahKolom('riwayat', 'jumlah_iterasi', { type: DataTypes.INTEGER, allowNull: true });
  await tambahKolom('riwayat_penyakit', 'rule_kode', { type: DataTypes.STRING(10), allowNull: true });
  await tambahKolom('riwayat_penyakit', 'gejala_cocok', { type: DataTypes.INTEGER, allowNull: true });
  await tambahKolom('riwayat_penyakit', 'gejala_total', { type: DataTypes.INTEGER, allowNull: true });
  if ((await kolom('riwayat')).gejala) await pindahkanDariJSON();

  // Sederhanakan tabel detail: hanya foreign key dan nilai CF
  await hapusKolom('riwayat_gejala', ['kode', 'nama']);
  await hapusKolom('riwayat_penyakit', [
    'kode', 'nama', 'deskripsi', 'solusi', 'peringkat', 'utama', 'rule', 'cocok', 'total', 'lengkap', 'langkah',
  ]);
  await query('UPDATE riwayat_gejala SET cf_user = 1 WHERE cf_user IS NULL');
  await query('UPDATE riwayat_penyakit SET cf = 0 WHERE cf IS NULL');
  await jadikanDecimal('riwayat_gejala', 'cf_user');
  await jadikanDecimal('riwayat_penyakit', 'cf');

  await aturFK('riwayat', 'user_id', 'user', 'CASCADE');
  await aturFK('riwayat_gejala', 'riwayat_id', 'riwayat', 'CASCADE');
  await aturFK('riwayat_gejala', 'gejala_id', 'gejala', 'RESTRICT');
  await aturFK('riwayat_penyakit', 'riwayat_id', 'riwayat', 'CASCADE');
  await aturFK('riwayat_penyakit', 'penyakit_id', 'penyakit', 'RESTRICT');

  // Data pasien kini diambil dari tabel user, hasil dari tabel detail
  await hapusKolom('riwayat', ['nama', 'umur', 'jenis_kelamin', 'hasil']);

  // Dokter (pakar) mengelola basis pengetahuan langsung: fitur dokter ketua & usulan dihapus.
  // Tabel anak dihapus lebih dulu karena memiliki foreign key ke tabel usulan induk.
  for (const t of ['usulan_rule_gejala', 'usulan_penyakit_gejala', 'usulan_rule', 'usulan_penyakit', 'usulan_gejala']) {
    const [ada] = await query('SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [t]);
    if (!ada.length) continue;
    await query(`DROP TABLE \`${t}\``);
    console.log(`  - tabel ${t}`);
  }
  await hapusKolom('user', ['ketua']);

  // Presisi & batas nilai CF
  await jadikanDecimal('rule_gejala', 'cf', { defaultValue: 1 });

  // Satu gejala / penyakit hanya sekali per riwayat
  await tambahUnik('riwayat_gejala', 'riwayat_gejala_unik', ['riwayat_id', 'gejala_id']);
  await tambahUnik('riwayat_penyakit', 'riwayat_penyakit_unik', ['riwayat_id', 'penyakit_id']);

  // Riwayat tetap: langkah perhitungan CF dan jejak penalaran disimpan saat diagnosa
  for (const M of [RiwayatLangkah, RiwayatJejak, RiwayatJejakPremis]) await M.sync();
  await lengkapiRiwayatLama();
  if ((await kolom('riwayat')).jumlah_iterasi.allowNull) {
    await qi.changeColumn('riwayat', 'jumlah_iterasi', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 });
  }

  await terapkanCheckCF(sequelize);

  // ID pasien dan kewajiban mengganti kata sandi awal dari admin
  await tambahKolom('user', 'kode_pasien', { type: DataTypes.STRING(20), allowNull: true, after: 'role' });
  await tambahKolom('user', 'wajib_ganti_password', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    after: 'tanggal_lahir',
  });
  // Format lama PSN-2026-0001 -> PSN20260001 (ID hanya huruf dan angka)
  const [berubah] = await query(
    "UPDATE `user` SET username = IF(username = kode_pasien, REPLACE(username, '-', ''), username), kode_pasien = REPLACE(kode_pasien, '-', '') WHERE kode_pasien LIKE 'PSN-%'"
  );
  if (berubah.affectedRows) console.log(`  ${berubah.affectedRows} ID pasien diubah ke format tanpa tanda hubung`);
  await isiKodePasienLama();
  const [indeksKode] = await query(
    "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'kode_pasien' AND NON_UNIQUE = 0 LIMIT 1"
  );
  if (!indeksKode.length) {
    await qi.addIndex('user', ['kode_pasien'], { name: 'kode_pasien', unique: true });
    console.log('  + UNIQUE user (kode_pasien)');
  }

  console.log('Migrasi selesai.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Gagal migrasi:', err.message);
  process.exit(1);
});
