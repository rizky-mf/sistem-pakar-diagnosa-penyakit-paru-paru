/**
 * DATA AWAL BASIS PENGETAHUAN
 *
 * PENTING: Data ini disusun dari literatur umum sebagai CONTOH.
 * Untuk skripsi, seluruh penyakit, gejala, dan aturan WAJIB divalidasi
 * oleh pakar (dokter spesialis paru) sebelum digunakan.
 */

const penyakit = [
  {
    kode: 'P01',
    nama: 'Tuberkulosis (TBC) Paru',
    deskripsi:
      'Penyakit infeksi menular yang disebabkan oleh bakteri Mycobacterium tuberculosis, terutama menyerang paru-paru dan menular melalui percikan dahak (droplet) penderita.',
    solusi:
      'Segera periksa ke puskesmas/rumah sakit untuk tes dahak (BTA/TCM) dan rontgen dada. Pengobatan OAT (Obat Anti Tuberkulosis) harus diminum teratur minimal 6 bulan tanpa putus. Gunakan masker, jaga ventilasi rumah, dan konsumsi makanan bergizi.',
  },
  {
    kode: 'P02',
    nama: 'Pneumonia',
    deskripsi:
      'Infeksi yang menyebabkan peradangan pada kantung udara (alveolus) di salah satu atau kedua paru-paru, yang dapat terisi cairan atau nanah. Dapat disebabkan oleh bakteri, virus, atau jamur.',
    solusi:
      'Periksakan diri ke dokter untuk pemeriksaan fisik dan rontgen dada. Pengobatan dapat berupa antibiotik (jika bakteri) sesuai resep dokter. Istirahat cukup, perbanyak minum air putih. Segera ke IGD bila sesak berat atau bibir kebiruan.',
  },
  {
    kode: 'P03',
    nama: 'Asma',
    deskripsi:
      'Penyakit kronis berupa peradangan dan penyempitan saluran napas yang menyebabkan sesak napas kambuhan, mengi, dan dada terasa berat, sering dipicu oleh alergen, debu, udara dingin, atau aktivitas fisik.',
    solusi:
      'Konsultasikan ke dokter untuk mendapatkan obat pelega (reliever) dan pengontrol (controller) inhaler. Kenali dan hindari faktor pemicu, jangan merokok, dan selalu bawa inhaler. Segera ke IGD bila serangan tidak membaik dengan inhaler.',
  },
  {
    kode: 'P04',
    nama: 'Penyakit Paru Obstruktif Kronis (PPOK)',
    deskripsi:
      'Penyakit paru kronis progresif yang menghambat aliran udara dari paru-paru, mencakup bronkitis kronis dan emfisema. Penyebab utamanya adalah kebiasaan merokok jangka panjang dan paparan polusi.',
    solusi:
      'Berhenti merokok adalah langkah terpenting. Periksakan ke dokter paru untuk spirometri dan terapi bronkodilator. Ikuti program rehabilitasi paru, lakukan vaksinasi influenza, dan hindari polusi udara.',
  },
  {
    kode: 'P05',
    nama: 'Bronkitis Akut',
    deskripsi:
      'Peradangan pada saluran bronkus yang umumnya disebabkan oleh infeksi virus, ditandai batuk berdahak yang biasanya berlangsung kurang dari 3 minggu.',
    solusi:
      'Istirahat yang cukup, perbanyak minum air hangat, dan hindari asap rokok. Obat pereda gejala dapat digunakan sesuai anjuran dokter/apoteker. Periksa ke dokter bila batuk lebih dari 3 minggu atau disertai demam tinggi.',
  },
  {
    kode: 'P06',
    nama: 'Kanker Paru',
    deskripsi:
      'Pertumbuhan sel abnormal yang tidak terkendali di jaringan paru-paru. Faktor risiko utama adalah merokok, paparan asap rokok, polusi, dan zat karsinogenik.',
    solusi:
      'Segera konsultasikan ke dokter spesialis paru untuk pemeriksaan lanjutan (rontgen, CT-scan, biopsi). Penanganan dapat berupa operasi, kemoterapi, radioterapi, atau terapi target sesuai stadium. Hentikan kebiasaan merokok.',
  },
  {
    kode: 'P07',
    nama: 'Efusi Pleura',
    deskripsi:
      'Penumpukan cairan berlebih di rongga pleura (selaput pembungkus paru-paru) yang menekan paru-paru sehingga menimbulkan sesak napas dan nyeri dada.',
    solusi:
      'Segera periksa ke dokter untuk rontgen/USG dada. Penanganan dapat berupa pengeluaran cairan (torakosentesis) dan pengobatan penyakit penyebabnya. Jangan menunda pemeriksaan bila sesak semakin berat.',
  },
  {
    kode: 'P08',
    nama: 'Bronkiektasis',
    deskripsi:
      'Kondisi pelebaran dan kerusakan permanen pada saluran bronkus sehingga lendir menumpuk dan mudah terjadi infeksi berulang.',
    solusi:
      'Konsultasikan ke dokter spesialis paru. Penanganan meliputi fisioterapi dada untuk membantu mengeluarkan dahak, antibiotik saat infeksi, dan obat pengencer dahak. Hindari rokok dan lakukan vaksinasi.',
  },
];

const gejala = [
  { kode: 'G01', nama: 'Batuk lebih dari 2 minggu' },
  { kode: 'G02', nama: 'Batuk berdahak' },
  { kode: 'G03', nama: 'Batuk kering (tidak berdahak)' },
  { kode: 'G04', nama: 'Batuk berdarah' },
  { kode: 'G05', nama: 'Sesak napas' },
  { kode: 'G06', nama: 'Napas berbunyi (mengi)' },
  { kode: 'G07', nama: 'Nyeri dada' },
  { kode: 'G08', nama: 'Demam' },
  { kode: 'G09', nama: 'Demam tinggi disertai menggigil' },
  { kode: 'G10', nama: 'Berkeringat di malam hari tanpa aktivitas' },
  { kode: 'G11', nama: 'Berat badan turun tanpa sebab yang jelas' },
  { kode: 'G12', nama: 'Nafsu makan menurun' },
  { kode: 'G13', nama: 'Badan lemas / mudah lelah' },
  { kode: 'G14', nama: 'Dahak kental berwarna kuning atau hijau' },
  { kode: 'G15', nama: 'Napas cepat dan dangkal' },
  { kode: 'G16', nama: 'Sesak napas kambuhan dipicu debu, udara dingin, atau alergen' },
  { kode: 'G17', nama: 'Dada terasa berat atau tertekan' },
  { kode: 'G18', nama: 'Riwayat merokok jangka panjang' },
  { kode: 'G19', nama: 'Sesak napas bertambah saat beraktivitas' },
  { kode: 'G20', nama: 'Batuk berdahak menahun (hampir setiap hari)' },
  { kode: 'G21', nama: 'Suara serak yang tidak kunjung sembuh' },
  { kode: 'G22', nama: 'Nyeri dada bertambah saat menarik napas dalam' },
  { kode: 'G23', nama: 'Sesak napas saat berbaring' },
  { kode: 'G24', nama: 'Bibir atau ujung jari kebiruan' },
  { kode: 'G25', nama: 'Dahak berbau busuk dalam jumlah banyak' },
];

// IF premis[0] AND premis[1] AND ... THEN penyakit
const rules = [
  { kode: 'R01', penyakit: 'P01', premis: ['G01', 'G02', 'G08', 'G10', 'G11', 'G12'] },
  { kode: 'R02', penyakit: 'P02', premis: ['G02', 'G05', 'G07', 'G09', 'G14', 'G15'] },
  { kode: 'R03', penyakit: 'P03', premis: ['G03', 'G05', 'G06', 'G16', 'G17'] },
  { kode: 'R04', penyakit: 'P04', premis: ['G05', 'G06', 'G18', 'G19', 'G20'] },
  { kode: 'R05', penyakit: 'P05', premis: ['G02', 'G08', 'G13', 'G17'] },
  { kode: 'R06', penyakit: 'P06', premis: ['G01', 'G04', 'G07', 'G11', 'G18', 'G21'] },
  { kode: 'R07', penyakit: 'P07', premis: ['G03', 'G05', 'G22', 'G23'] },
  { kode: 'R08', penyakit: 'P08', premis: ['G01', 'G04', 'G05', 'G25'] },
];

// Akun awal untuk setiap aktor
const users = [
  { nama: 'Administrator', username: 'admin', password: 'admin123', role: 'admin' },
  { nama: 'dr. Pakar Paru, Sp.P', username: 'dokter', password: 'dokter123', role: 'dokter' },
  {
    nama: 'Pasien Contoh',
    username: 'pasien',
    password: 'pasien123',
    role: 'pasien',
    jenisKelamin: 'L',
    tanggalLahir: '1995-05-17',
  },
];

module.exports = { penyakit, gejala, rules, users };
