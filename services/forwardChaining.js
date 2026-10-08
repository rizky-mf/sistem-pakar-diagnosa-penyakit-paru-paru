/**
 * Mesin Inferensi Forward Chaining
 *
 * Penalaran dimulai dari fakta (gejala yang dipilih pengguna), lalu
 * setiap aturan diperiksa: jika SEMUA premis (IF) terpenuhi oleh fakta,
 * aturan "dieksekusi" (fire) dan konklusinya (THEN) ditambahkan ke fakta.
 * Proses diulang sampai tidak ada fakta baru yang dihasilkan.
 *
 * Format aturan:
 *   { kode: 'R01', premis: ['G01', 'G02'], konklusi: 'P01' }
 */
function forwardChaining(faktaAwal, rules) {
  const workingMemory = new Set(faktaAwal);
  const ruleTerpakai = new Set();
  const jejak = [];
  let iterasi = 0;
  let adaFaktaBaru = true;

  while (adaFaktaBaru) {
    adaFaktaBaru = false;
    iterasi++;

    for (const rule of rules) {
      if (ruleTerpakai.has(rule.kode)) continue;
      // Aturan tanpa premis tidak boleh dieksekusi
      if (!rule.premis || rule.premis.length === 0) continue;

      const terpenuhi = rule.premis.every((p) => workingMemory.has(p));
      if (!terpenuhi) continue;

      ruleTerpakai.add(rule.kode);
      const faktaBaru = !workingMemory.has(rule.konklusi);
      jejak.push({
        iterasi,
        rule: rule.kode,
        premis: rule.premis,
        konklusi: rule.konklusi,
        faktaBaru,
      });

      if (faktaBaru) {
        workingMemory.add(rule.konklusi);
        adaFaktaBaru = true;
      }
    }
  }

  const faktaAwalSet = new Set(faktaAwal);
  const kesimpulan = [...workingMemory].filter((f) => !faktaAwalSet.has(f));

  return {
    faktaAwal: [...faktaAwalSet],
    fakta: [...workingMemory],
    kesimpulan,
    jejak,
    jumlahIterasi: iterasi,
  };
}

/**
 * Menghitung persentase kecocokan premis untuk aturan yang TIDAK terpenuhi.
 * Ini bukan bagian dari forward chaining murni, hanya informasi tambahan
 * bagi pengguna ketika gejala belum cukup untuk memenuhi suatu aturan.
 */
function kecocokanParsial(fakta, rules, minimal = 50) {
  const faktaSet = new Set(fakta);
  return rules
    .filter((r) => r.premis && r.premis.length > 0)
    .map((r) => {
      const cocok = r.premis.filter((p) => faktaSet.has(p));
      return {
        rule: r.kode,
        konklusi: r.konklusi,
        cocok: cocok.length,
        total: r.premis.length,
        persen: Math.round((cocok.length / r.premis.length) * 100),
      };
    })
    .filter((r) => r.persen >= minimal && r.persen < 100)
    .sort((a, b) => b.persen - a.persen);
}

module.exports = { forwardChaining, kecocokanParsial };
