/**
 * Data halaman Kontak Kami (akun pasien).
 * Ganti nilai dalam tanda [ ] dengan data instansi tempat penelitian.
 * Kosongkan ('') salah satu kanal bila tidak tersedia; kartunya tidak akan ditampilkan.
 */
module.exports = {
  instansi: '[Nama Puskesmas / Klinik / Rumah Sakit]',
  alamat: '[Jl. Nama Jalan No. 00, Kelurahan, Kecamatan, Kota]',
  // Nomor ditulis bebas untuk ditampilkan; tautan dibuat dari angkanya saja
  telepon: '[(061) 000-0000]',
  // Format internasional tanpa tanda + dan tanpa 0 di depan, contoh: 6281200000000
  whatsapp: '[62xxxxxxxxxxx]',
  email: '[email@instansi.go.id]',
  jamLayanan: [
    ['Senin - Kamis', '08.00 - 14.00 WIB'],
    ['Jumat', '08.00 - 11.00 WIB'],
    ['Sabtu', '08.00 - 12.00 WIB'],
    ['Minggu & hari libur', 'Tutup (IGD tetap buka 24 jam)'],
  ],
};
