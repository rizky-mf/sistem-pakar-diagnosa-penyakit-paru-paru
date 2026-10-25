# Sistem Pakar Diagnosa Penyakit Paru-Paru (Forward Chaining & Certainty Factor)

Aplikasi web sistem pakar untuk mendiagnosa penyakit paru-paru berdasarkan gejala
menggunakan metode **Forward Chaining** dan **Certainty Factor**.

**Stack:** Node.js, Express, EJS, MySQL (Sequelize), Bootstrap 5

## Persyaratan

- Node.js 20 atau lebih baru
- MySQL / MariaDB (misalnya lewat XAMPP atau Laragon)

## Instalasi

```bash
npm install
cp .env.example .env      # sesuaikan user/password database
npm run db:setup          # membuat database, tabel, dan data awal
# atau, jika database sudah berisi data dari versi sebelumnya:
npm run db:migrate        # menambah kolom baru tanpa menghapus data
npm run dev               # jalankan server (auto-restart saat file berubah)
```

Buka http://localhost:3000 (langsung diarahkan ke halaman login)

Akun bawaan (ganti password setelah login pertama):

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Dokter (pakar) | `dokter` | `dokter123` |
| Pasien | `pasien` | `pasien123` |

## Aktor dan Hak Akses

| Aktor | Hak akses |
|---|---|
| **Admin** | Kelola akun admin, dokter, dan pasien (akun pasien mendapat ID otomatis dan kata sandi awal acak), reset kata sandi pasien, lihat & hapus riwayat diagnosa |
| **Dokter (pakar)** | Kelola basis pengetahuan secara langsung (penyakit, gejala, aturan + CF pakar), lihat riwayat diagnosa pasien |
| **Pasien** | Daftar akun, login dengan username atau ID pasien, edit profil, melakukan diagnosa, melihat & mencetak hasil, melihat riwayat diagnosanya sendiri |

Tidak ada beranda publik: pengunjung yang belum login langsung diarahkan ke halaman login.

> `npm run db:setup` **menghapus seluruh data** lalu mengisi ulang data awal.

## Struktur Folder

```
app.js                      # entry point
config/database.js          # koneksi Sequelize
models/index.js             # model + relasi: Penyakit, Gejala, Rule, User, Riwayat
services/forwardChaining.js # MESIN INFERENSI forward chaining
services/certaintyFactor.js # perhitungan certainty factor
seeders/data.js             # data awal penyakit, gejala, aturan
scripts/setup-db.js         # setup database
scripts/migrate.js          # migrasi kolom baru tanpa hapus data
controllers/                # logika halaman (publik/pasien, admin/, dokter/)
routes/                     # index (publik & pasien), admin, dokter
middleware/auth.js          # login & pembatasan akses per role
views/                      # tampilan EJS
public/                     # CSS
tests/                      # unit test mesin inferensi (npm test)
```

## Rancangan Database

| Tabel | Kolom |
|---|---|
| `penyakit` | id, kode, nama, deskripsi, solusi |
| `gejala` | id, kode, nama |
| `rule` | id, kode, penyakit_id |
| `rule_gejala` | rule_id, gejala_id, cf (premis aturan + CF pakar) |
| `user` | id, nama, username, password, role (admin/dokter/pasien), kode_pasien (ID pasien, unik), jenis_kelamin, tanggal_lahir, wajib_ganti_password |
| `riwayat` | id, user_id, tanggal_diagnosa (waktu hasil diagnosa keluar), jumlah_iterasi |
| `riwayat_gejala` | id, riwayat_id, gejala_id, cf_user (gejala yang dirasakan pasien) |
| `riwayat_penyakit` | id, riwayat_id, penyakit_id, cf, rule_kode, gejala_cocok, gejala_total (CF tertinggi = hasil utama) |
| `riwayat_langkah` | id, riwayat_penyakit_id, urutan, kode_fakta, cf_pakar, cf_user, cf_gejala, cf_kombinasi |
| `riwayat_jejak` | id, riwayat_id, urutan, iterasi, rule_kode, konklusi_kode (jejak forward chaining) |
| `riwayat_jejak_premis` | id, riwayat_jejak_id, urutan, kode_fakta |

Relasi:

- `penyakit` 1–N `rule`, `rule` N–N `gejala` melalui `rule_gejala` (berisi CF pakar)
- `user` 1–N `riwayat`; `riwayat` 1–N `riwayat_gejala` N–1 `gejala`; `riwayat` 1–N `riwayat_penyakit` N–1 `penyakit`
- Menghapus akun pasien atau riwayat ikut menghapus detailnya (`CASCADE`). Gejala/penyakit
  yang sudah dipakai pada riwayat tidak dapat dihapus (`RESTRICT`).
- Data pasien (nama, umur saat diagnosa, jenis kelamin) diambil dari tabel `user`. Jejak
  forward chaining dan langkah perhitungan CF disimpan saat diagnosa, sehingga hasil lama
  tidak berubah walaupun aturan diubah kemudian.

## Cara Kerja Forward Chaining

1. **Fakta awal** adalah gejala yang dipilih pengguna (misalnya G01, G02, G08).
2. Setiap aturan `IF premis THEN konklusi` diperiksa. Jika **semua** premis ada di fakta,
   aturan dieksekusi dan konklusinya ditambahkan ke fakta (working memory).
3. Langkah 2 diulang sampai tidak ada fakta baru.
4. Aturan yang terpenuhi dicatat sebagai jejak penalaran; hasil akhir ditentukan oleh nilai certainty factor (lihat bagian berikut).

Jejak penalaran (aturan mana yang dieksekusi pada iterasi ke berapa) ditampilkan pada
halaman hasil sebagai **fasilitas penjelasan**.

## Cara Kerja Certainty Factor

1. **CF pakar** diisi dokter untuk setiap gejala pada aturan (0–1).
2. **CF user** dipilih pasien untuk setiap gejala: Tidak merasakan (0), Sedikit yakin (0,4),
   Cukup yakin (0,6), Yakin (0,8), Sangat yakin (1). Gejala bernilai 0 tidak ikut dihitung.
3. `CF gejala = CF pakar × CF user`
4. CF gejala digabung berurutan: `CF kombinasi = CF lama + CF gejala × (1 − CF lama)`
5. CF dihitung untuk **setiap penyakit yang memiliki minimal satu gejala cocok**
   (tidak harus semua premis terpenuhi). Penyakit dengan CF tertinggi menjadi
   **hasil diagnosa**, sisanya ditampilkan sebagai **kemungkinan lain**.
   Jika satu penyakit punya beberapa aturan, diambil aturan dengan CF tertinggi.

Forward chaining tetap dijalankan untuk menelusuri aturan yang seluruh premisnya
terpenuhi (ditampilkan sebagai jejak penalaran); kesimpulannya ikut menjadi fakta
beserta nilai CF-nya bila dipakai aturan berantai.

Tabel perhitungan langkah demi langkah ikut ditampilkan di halaman hasil.

## Basis Aturan Awal

| Aturan | IF | THEN |
|---|---|---|
| R01 | G01, G02, G08, G10, G11, G12 | P01 TBC Paru |
| R02 | G02, G05, G07, G09, G14, G15 | P02 Pneumonia |
| R03 | G03, G05, G06, G16, G17 | P03 Asma |
| R04 | G05, G06, G18, G19, G20 | P04 PPOK |
| R05 | G02, G08, G13, G17 | P05 Bronkitis Akut |
| R06 | G01, G04, G07, G11, G18, G21 | P06 Kanker Paru |
| R07 | G03, G05, G22, G23 | P07 Efusi Pleura |
| R08 | G01, G04, G05, G25 | P08 Bronkiektasis |

> **Penting:** data penyakit, gejala, dan aturan di atas disusun dari literatur umum sebagai
> contoh, termasuk nilai CF pakar di `seeders/data.js`. Untuk skripsi, seluruhnya **wajib divalidasi oleh pakar** (dokter spesialis paru).
> Setelah divalidasi, ubah di `seeders/data.js` lalu jalankan `npm run db:setup`,
> atau ubah langsung lewat halaman admin.
