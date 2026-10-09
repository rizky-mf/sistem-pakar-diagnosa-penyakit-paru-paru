(() => {
  const root = document.documentElement;

  // ---------- Tema terang / gelap ----------
  const perbaruiIkonTema = () => {
    const gelap = root.getAttribute('data-bs-theme') === 'dark';
    document.querySelectorAll('[data-theme-toggle] i').forEach((i) => {
      i.className = gelap ? 'bi bi-sun' : 'bi bi-moon-stars';
    });
  };

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const tema = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-bs-theme', tema);
      try {
        localStorage.setItem('theme', tema);
      } catch (e) {}
      perbaruiIkonTema();
    })
  );
  perbaruiIkonTema();

  // Hasil cetak selalu memakai tema terang
  let temaSebelumCetak = null;
  window.addEventListener('beforeprint', () => {
    temaSebelumCetak = root.getAttribute('data-bs-theme');
    root.setAttribute('data-bs-theme', 'light');
  });
  window.addEventListener('afterprint', () => {
    if (temaSebelumCetak) root.setAttribute('data-bs-theme', temaSebelumCetak);
  });

  // ---------- Notifikasi (flash message) ----------
  document.querySelectorAll('.toast').forEach((el) => bootstrap.Toast.getOrCreateInstance(el, { delay: 4500 }).show());

  // ---------- Konfirmasi hapus: <form data-confirm="Pesan"> ----------
  const modalKonfirmasi = document.getElementById('confirmModal');
  if (modalKonfirmasi) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalKonfirmasi);
    let formTarget = null;

    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (!form.matches('form[data-confirm]')) return;
      e.preventDefault();
      formTarget = form;
      modalKonfirmasi.querySelector('[data-confirm-text]').textContent = form.dataset.confirm;
      modal.show();
    });

    modalKonfirmasi.querySelector('[data-confirm-ok]').addEventListener('click', () => {
      if (!formTarget) return;
      modal.hide();
      formTarget.submit(); // submit() tidak memicu event submit lagi
    });
  }

  // ---------- Pencarian daftar: <input data-filter="#wadah" data-filter-empty="#kosong"> ----------
  document.querySelectorAll('[data-filter]').forEach((input) => {
    const wadah = document.querySelector(input.dataset.filter);
    const kosong = input.dataset.filterEmpty ? document.querySelector(input.dataset.filterEmpty) : null;
    if (!wadah) return;

    input.addEventListener('input', () => {
      const kata = input.value.trim().toLowerCase();
      let tampil = 0;
      wadah.querySelectorAll('[data-filter-item]').forEach((item) => {
        const cocok = item.dataset.search.toLowerCase().includes(kata);
        item.hidden = !cocok;
        if (cocok) tampil++;
      });
      if (kosong) kosong.hidden = tampil > 0;
    });
  });

  // ---------- Hitung checkbox terpilih: <span data-count-checked="selector"> ----------
  document.querySelectorAll('[data-count-checked]').forEach((penghitung) => {
    const kotak = document.querySelectorAll(penghitung.dataset.countChecked);
    const tombol = document.querySelector('[data-requires-checked]');
    const perbarui = () => {
      const jumlah = [...kotak].filter((k) => k.checked).length;
      penghitung.textContent = jumlah;
      if (tombol) tombol.disabled = jumlah === 0;
    };
    kotak.forEach((k) => k.addEventListener('change', perbarui));
    document.querySelectorAll('[data-uncheck-all]').forEach((btn) =>
      btn.addEventListener('click', () => {
        kotak.forEach((k) => (k.checked = false));
        perbarui();
      })
    );
    perbarui();
  });

  // ---------- Modal detail penyakit ----------
  const modalDetail = document.getElementById('detailModal');
  if (modalDetail) {
    modalDetail.addEventListener('show.bs.modal', (e) => {
      const data = e.relatedTarget.dataset;
      ['kode', 'nama', 'deskripsi', 'solusi'].forEach((f) => {
        modalDetail.querySelector(`[data-field="${f}"]`).textContent = data[f];
      });
    });
  }
})();
