/**
 * Metode Certainty Factor (CF)
 *
 * Melengkapi forward chaining dengan tingkat kepastian hasil diagnosa.
 * - CF pakar  : bobot keyakinan dokter bahwa suatu gejala mendukung penyakit (per premis aturan).
 * - CF user   : tingkat keyakinan pasien bahwa ia mengalami gejala tersebut.
 * - CF gejala : CF pakar x CF user
 * - Kombinasi : CFkombinasi = CFlama + CFbaru x (1 - CFlama)
 *
 * Format aturan:
 *   { kode: 'R01', premis: ['G01', 'G02'], konklusi: 'P01', cfPakar: { G01: 0.8, G02: 0.6 } }
 */

// Pilihan keyakinan pasien terhadap gejala; 0 berarti gejala tidak dirasakan
const TINGKAT_KEYAKINAN = [
  { nilai: 0, label: 'Tidak merasakan' },
  { nilai: 0.4, label: 'Sedikit yakin' },
  { nilai: 0.6, label: 'Cukup yakin' },
  { nilai: 0.8, label: 'Yakin' },
  { nilai: 1, label: 'Sangat yakin' },
];

const bulat = (n) => Math.round(n * 10000) / 10000;

function kombinasi(cfLama, cfBaru) {
  return cfLama + cfBaru * (1 - cfLama);
}

// CF pakar yang tidak diisi dianggap 1 (pakar yakin penuh)
function cfPakarPremis(rule, kode) {
  const nilai = rule.cfPakar && rule.cfPakar[kode];
  return typeof nilai === 'number' ? nilai : 1;
}

/**
 * Menghitung CF satu aturan dari premis yang ada di fakta.
 * cfFakta: { kode: nilai keyakinan } untuk setiap fakta (gejala atau kesimpulan sebelumnya).
 */
function hitungCFRule(rule, cfFakta) {
  let cf = 0;
  const langkah = [];
  for (const kode of rule.premis) {
    if (!(kode in cfFakta)) continue;
    const cfPakar = cfPakarPremis(rule, kode);
    const cfUser = cfFakta[kode];
    const cfGejala = cfPakar * cfUser;
    cf = langkah.length ? kombinasi(cf, cfGejala) : cfGejala;
    langkah.push({ kode, cfPakar, cfUser, cfGejala: bulat(cfGejala), cfKombinasi: bulat(cf) });
  }
  return { cf: bulat(cf), langkah };
}

/**
 * Menghitung CF setiap kesimpulan dari jejak forward chaining.
 * Jejak diproses berurutan sehingga kesimpulan yang menjadi premis aturan
 * berikutnya (chaining) ikut membawa nilai CF-nya. Jika satu penyakit
 * disimpulkan oleh beberapa aturan, diambil nilai CF tertinggi.
 */
function cfKesimpulan(jejak, rules, cfUser) {
  const ruleByKode = Object.fromEntries(rules.map((r) => [r.kode, r]));
  const cfFakta = { ...cfUser };
  const hasil = {};

  for (const j of jejak) {
    const rule = ruleByKode[j.rule];
    if (!rule) continue;
    const { cf, langkah } = hitungCFRule(rule, cfFakta);
    if (!hasil[j.konklusi] || cf > hasil[j.konklusi].cf) {
      hasil[j.konklusi] = { cf, rule: rule.kode, langkah };
      cfFakta[j.konklusi] = cf;
    }
  }
  return hasil;
}

/**
 * Menghitung CF setiap penyakit yang memiliki minimal satu gejala cocok
 * (tidak harus semua premis terpenuhi), lalu diurutkan dari CF tertinggi.
 * Nilai CF kesimpulan hasil forward chaining ikut dipakai sebagai fakta
 * untuk aturan berantai. Jika satu penyakit punya beberapa aturan, diambil
 * aturan dengan CF tertinggi.
 */
function rankingPenyakit(rules, cfUser, jejak = []) {
  const cfFakta = { ...cfUser };
  for (const [kode, { cf }] of Object.entries(cfKesimpulan(jejak, rules, cfUser))) cfFakta[kode] = cf;
  const terpenuhi = new Set(jejak.map((j) => j.rule));

  const terbaik = {};
  for (const rule of rules) {
    if (!rule.premis || rule.premis.length === 0) continue;
    const { cf, langkah } = hitungCFRule(rule, cfFakta);
    if (!langkah.length || cf <= 0) continue;
    const kandidat = {
      konklusi: rule.konklusi,
      rule: rule.kode,
      cf,
      langkah,
      cocok: langkah.length,
      total: rule.premis.length,
      lengkap: terpenuhi.has(rule.kode),
    };
    if (!terbaik[rule.konklusi] || cf > terbaik[rule.konklusi].cf) terbaik[rule.konklusi] = kandidat;
  }

  // CF sama: dahulukan aturan yang lengkap, lalu rasio gejala cocok terbesar
  return Object.values(terbaik).sort(
    (a, b) => b.cf - a.cf || b.lengkap - a.lengkap || b.cocok / b.total - a.cocok / a.total
  );
}

function interpretasi(cf) {
  if (cf >= 0.8) return 'Hampir pasti';
  if (cf >= 0.6) return 'Kemungkinan besar';
  if (cf >= 0.4) return 'Kemungkinan';
  if (cf >= 0.2) return 'Mungkin';
  return 'Tidak pasti';
}

module.exports = {
  TINGKAT_KEYAKINAN,
  kombinasi,
  hitungCFRule,
  cfKesimpulan,
  rankingPenyakit,
  interpretasi,
};
