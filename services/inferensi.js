/**
 * Proses inferensi lengkap satu kali diagnosa:
 *   1. Forward chaining  -> aturan yang seluruh premisnya terpenuhi (jejak penalaran)
 *   2. Certainty factor  -> nilai CF setiap penyakit, diurutkan dari tertinggi
 *
 * Hasilnya disimpan apa adanya ke riwayat agar hasil diagnosa tidak berubah
 * walaupun basis pengetahuan (aturan / CF pakar) diubah di kemudian hari.
 */
const { forwardChaining } = require('./forwardChaining');
const { rankingPenyakit } = require('./certaintyFactor');

/**
 * rules  : [{ kode, premis: [kode fakta], konklusi, cfPakar: { kode: nilai } }]
 * cfUser : { kodeGejala: keyakinan pasien }
 */
function jalankanInferensi(rules, cfUser) {
  const fc = forwardChaining(Object.keys(cfUser), rules);
  return {
    jejak: fc.jejak,
    jumlahIterasi: fc.jumlahIterasi,
    peringkat: rankingPenyakit(rules, cfUser, fc.jejak),
  };
}

/**
 * Mengubah hasil inferensi menjadi baris tabel riwayat:
 * riwayat_penyakit (+ riwayat_langkah) dan riwayat_jejak (+ riwayat_jejak_premis).
 * idPenyakit: { kodePenyakit: id } - penyakit yang tidak dikenal dilewati.
 */
function barisRiwayat(hasil, idPenyakit) {
  return {
    jumlahIterasi: hasil.jumlahIterasi,
    daftarPenyakit: hasil.peringkat
      .filter((p) => idPenyakit[p.konklusi])
      .map((p) => ({
        penyakitId: idPenyakit[p.konklusi],
        cf: p.cf,
        ruleKode: p.rule,
        gejalaCocok: p.cocok,
        gejalaTotal: p.total,
        langkah: p.langkah.map((l, i) => ({
          urutan: i + 1,
          kodeFakta: l.kode,
          cfPakar: l.cfPakar,
          cfUser: l.cfUser,
          cfGejala: l.cfGejala,
          cfKombinasi: l.cfKombinasi,
        })),
      })),
    jejak: hasil.jejak.map((j, i) => ({
      urutan: i + 1,
      iterasi: j.iterasi,
      ruleKode: j.rule,
      konklusiKode: j.konklusi,
      premis: j.premis.map((kode, k) => ({ urutan: k + 1, kodeFakta: kode })),
    })),
  };
}

module.exports = { jalankanInferensi, barisRiwayat };
