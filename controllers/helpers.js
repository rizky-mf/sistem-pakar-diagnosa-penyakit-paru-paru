function pesanError(err) {
  if (err.name === 'SequelizeUniqueConstraintError') return 'Kode sudah digunakan, gunakan kode lain.';
  console.error(err);
  return 'Terjadi kesalahan saat menyimpan data.';
}

module.exports = { pesanError };
