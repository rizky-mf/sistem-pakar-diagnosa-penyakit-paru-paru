# Sistem Pakar Diagnosa Penyakit Paru-Paru (Forward Chaining)

Aplikasi web sistem pakar untuk mendiagnosa penyakit paru-paru berdasarkan gejala
menggunakan metode **Forward Chaining**.

**Stack:** Node.js, Express, EJS, MySQL (Sequelize), Bootstrap 5

## Persyaratan

- Node.js 20 atau lebih baru
- MySQL / MariaDB (misalnya lewat XAMPP atau Laragon)

## Instalasi

```bash
npm install
cp .env.example .env      # sesuaikan user/password database
npm run db:setup          # membuat database, tabel, dan data awal
npm run dev               # jalankan server (auto-restart saat file berubah)
```

Buka http://localhost:3000

Akun bawaan (ganti password setelah login pertama):

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Dokter | `dokter` | `dokter123` |
| Pasien | `pasien` | `pasien123` |

## Aktor dan Hak Akses

| Aktor | Hak akses |
|---|---|
| **Admin** | Kelola akun admin/dokter, lihat daftar pasien, lihat & hapus riwayat diagnosa |
| **Dokter (pakar)** | Kelola basis pengetahuan (penyakit, gejala, aturan), lihat riwayat diagnosa pasien |
| **Pasien** | Daftar akun, login, melakukan diagnosa, melihat & mencetak hasil, melihat riwayat diagnosanya sendiri |

Pengunjung yang belum login hanya bisa melihat beranda dan info penyakit.

> `npm run db:setup` **menghapus seluruh data** lalu mengisi ulang data awal.

## Struktur Folder

```
app.js                      # entry point
config/database.js          # koneksi Sequelize
models/index.js             # model + relasi: Penyakit, Gejala, Rule, User, Riwayat
services/forwardChaining.js # MESIN INFERENSI forward chaining
seeders/data.js             # data awal penyakit, gejala, aturan
scripts/setup-db.js         # setup database
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
| `rule_gejala` | rule_id, gejala_id (premis aturan) |
| `user` | id, nama, username, password, role (admin/dokter/pasien), jenis_kelamin, tanggal_lahir |
| `riwayat` | id, user_id, nama, umur, jenis_kelamin, gejala (JSON), hasil (JSON) |

## Cara Kerja Forward Chaining

1. **Fakta awal** adalah gejala yang dipilih pengguna (misalnya G01, G02, G08).
2. Setiap aturan `IF premis THEN konklusi` diperiksa. Jika **semua** premis ada di fakta,
   aturan dieksekusi dan konklusinya ditambahkan ke fakta (working memory).
3. Langkah 2 diulang sampai tidak ada fakta baru.
4. Fakta baru yang berupa kode penyakit menjadi **kesimpulan diagnosa**.

Jejak penalaran (aturan mana yang dieksekusi pada iterasi ke berapa) ditampilkan pada
halaman hasil sebagai **fasilitas penjelasan**.

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
> contoh. Untuk skripsi, seluruhnya **wajib divalidasi oleh pakar** (dokter spesialis paru).
> Setelah divalidasi, ubah di `seeders/data.js` lalu jalankan `npm run db:setup`,
> atau ubah langsung lewat halaman admin.
