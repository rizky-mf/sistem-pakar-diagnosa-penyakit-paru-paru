// Pesan sekali tampil (flash message) yang disimpan di session.
// Pengganti library connect-flash yang sudah tidak dirawat.
//   req.flash('success', 'Data tersimpan')  -> menyimpan pesan
//   req.flash('success')                    -> mengambil lalu menghapus pesan
function flash(req, res, next) {
  req.flash = (type, message) => {
    if (!req.session) throw new Error('flash membutuhkan express-session');
    const semua = (req.session.flash = req.session.flash || {});

    if (message === undefined) {
      const pesan = semua[type] || [];
      delete semua[type];
      return pesan;
    }

    semua[type] = [...(semua[type] || []), ...(Array.isArray(message) ? message : [message])];
    return semua[type].length;
  };
  next();
}

module.exports = flash;
