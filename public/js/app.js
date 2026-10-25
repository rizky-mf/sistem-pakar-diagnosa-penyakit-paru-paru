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

  // ---------- Hitung pilihan: <span data-count-checked="selector"> ----------
  // Menghitung checkbox yang dicentang atau dropdown yang nilainya lebih dari 0
  const terpilih = (el) => (el.type === 'checkbox' ? el.checked : parseFloat(el.value) > 0);
  document.querySelectorAll('[data-count-checked]').forEach((penghitung) => {
    const kotak = document.querySelectorAll(penghitung.dataset.countChecked);
    const tombol = document.querySelector('[data-requires-checked]');
    const perbarui = () => {
      const jumlah = [...kotak].filter(terpilih).length;
      penghitung.textContent = jumlah;
      if (tombol) tombol.disabled = jumlah === 0;
    };
    kotak.forEach((k) => k.addEventListener('change', perbarui));
    document.querySelectorAll('[data-uncheck-all]').forEach((btn) =>
      btn.addEventListener('click', () => {
        kotak.forEach((k) => {
          if (k.type === 'checkbox') k.checked = false;
          else k.selectedIndex = 0;
        });
        perbarui();
      })
    );
    perbarui();
  });

  // ---------- Tampilkan / sembunyikan kata sandi: <button data-toggle-password="#input"> ----------
  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    const input = document.querySelector(btn.dataset.togglePassword);
    if (!input) return;
    btn.addEventListener('click', () => {
      const tampil = input.type === 'password';
      input.type = tampil ? 'text' : 'password';
      btn.querySelector('i').className = tampil ? 'bi bi-eye-slash' : 'bi bi-eye';
      btn.setAttribute('aria-label', tampil ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
    });
  });

  // ---------- Baris dinamis: <button data-tambah-baris="#template" data-tujuan="#wadah"> ----------
  document.querySelectorAll('[data-tambah-baris]').forEach((btn) => {
    const template = document.querySelector(btn.dataset.tambahBaris);
    const tujuan = document.querySelector(btn.dataset.tujuan);
    if (!template || !tujuan) return;
    btn.addEventListener('click', () => {
      tujuan.appendChild(template.content.cloneNode(true));
      const input = tujuan.lastElementChild && tujuan.lastElementChild.querySelector('input');
      if (input) input.focus();
    });
  });
  document.addEventListener('click', (e) => {
    const hapus = e.target.closest('[data-hapus-baris]');
    if (hapus) hapus.closest('[data-baris]').remove();
  });

  // ---------- Isian sesuai role: <select data-role-switch> + <div data-untuk-role="pasien"> ----------
  // Bagian yang tidak sesuai disembunyikan dan isiannya dinonaktifkan agar tidak ikut dikirim/divalidasi
  document.querySelectorAll('[data-role-switch]').forEach((select) => {
    const form = select.closest('form');
    const terapkan = () => {
      form.querySelectorAll('[data-untuk-role]').forEach((el) => {
        const tampil = el.dataset.untukRole.split(' ').includes(select.value);
        el.hidden = !tampil;
        el.querySelectorAll('input, select, textarea').forEach((f) => (f.disabled = !tampil));
      });
    };
    select.addEventListener('change', terapkan);
    terapkan();
  });

  // ---------- Salin teks: <button data-copy="#input"> ----------
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const input = document.querySelector(btn.dataset.copy);
      if (!input) return;
      try {
        await navigator.clipboard.writeText(input.value);
      } catch (e) {
        input.select();
        document.execCommand('copy');
      }
      const asli = btn.innerHTML;
      btn.innerHTML = '<i class="bi bi-check2"></i> Tersalin';
      setTimeout(() => (btn.innerHTML = asli), 1500);
    });
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
