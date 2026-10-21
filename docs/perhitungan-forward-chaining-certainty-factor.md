# Metode Forward Chaining dan Certainty Factor

Dokumen ini menjelaskan pemahaman, logika, contoh kasus, dan perhitungan metode
**Forward Chaining (FC)** dan **Certainty Factor (CF)** yang diterapkan pada
Sistem Pakar Diagnosa Penyakit Paru-Paru (SiPakar Paru).

Seluruh angka pada contoh kasus menggunakan basis pengetahuan awal sistem
(`seeders/data.js`) dan telah dicocokkan dengan hasil mesin inferensi aplikasi
(`services/forwardChaining.js` dan `services/certaintyFactor.js`).

---

## 1. Pemahaman

Sistem menggunakan dua metode yang saling melengkapi:

| Metode | Pertanyaan yang dijawab | Peran dalam sistem |
|---|---|---|
| **Forward Chaining** | Aturan mana yang syaratnya terpenuhi? | Menelusuri dari gejala (fakta) menuju aturan IF–THEN dan menghasilkan jejak penalaran |
| **Certainty Factor** | Seberapa yakin suatu penyakit benar? | Menghitung tingkat kepastian setiap penyakit (0–100%) dan menentukan hasil diagnosa |

### 1.1 Forward Chaining

Forward chaining adalah teknik penalaran **maju**: dimulai dari fakta yang diketahui
(gejala yang dirasakan pasien), lalu mencocokkan fakta tersebut dengan aturan
`IF premis THEN konklusi`. Jika seluruh premis suatu aturan terpenuhi, aturan
dieksekusi dan konklusinya ditambahkan sebagai fakta baru. Proses diulang sampai
tidak ada lagi fakta baru yang dihasilkan.

### 1.2 Certainty Factor

Certainty factor digunakan untuk menyatakan **tingkat keyakinan** terhadap suatu
kesimpulan ketika informasi yang tersedia tidak pasti. Ketidakpastian berasal dari
dua pihak:

- **Pakar (dokter)**: sebuah gejala tidak selalu menunjukkan penyakit tertentu.
  Misalnya batuk berdahak mendukung TBC, tetapi tidak sekuat berkeringat di malam
  hari. Bobot ini dinyatakan sebagai **CF pakar**.
- **Pasien**: pasien belum tentu yakin dengan gejala yang dirasakannya. Tingkat
  keyakinan ini dinyatakan sebagai **CF user**.

---

## 2. Logika dan Rumus

### Langkah 1 — Pasien memilih tingkat keyakinan (CF user)

Untuk setiap gejala, pasien memilih salah satu tingkat keyakinan berikut:

| Pilihan | Nilai CF user |
|---|---|
| Tidak merasakan | 0 (gejala tidak dihitung) |
| Sedikit yakin | 0,4 |
| Cukup yakin | 0,6 |
| Yakin | 0,8 |
| Sangat yakin | 1,0 |

### Langkah 2 — Forward chaining

1. Gejala dengan CF user > 0 menjadi **fakta awal** (working memory).
2. Setiap aturan diperiksa. Jika **semua** premis ada di fakta, aturan dieksekusi
   dan konklusinya ditambahkan ke fakta.
3. Aturan yang dieksekusi dicatat sebagai **jejak penalaran** (iterasi ke berapa,
   aturan apa).
4. Langkah 2–3 diulang sampai tidak ada fakta baru.

### Langkah 3 — CF setiap gejala

$$
CF(H,E) = CF_{pakar} \times CF_{user}
$$

### Langkah 4 — Kombinasi CF dalam satu aturan

Nilai CF gejala-gejala yang cocok pada satu aturan digabung secara berurutan:

$$
CF_{kombinasi} = CF_{lama} + CF_{baru} \times (1 - CF_{lama})
$$

Gejala pertama menjadi nilai awal ($CF_{lama}$), kemudian setiap gejala berikutnya
digabungkan menggunakan rumus di atas.

### Langkah 5 — Penentuan hasil diagnosa

1. CF dihitung untuk **setiap penyakit yang memiliki minimal satu gejala cocok**
   (tidak harus seluruh premis terpenuhi).
2. Jika satu penyakit memiliki beberapa aturan, diambil aturan dengan CF tertinggi.
3. Penyakit diurutkan dari CF tertinggi:
   - peringkat pertama menjadi **hasil diagnosa**;
   - sisanya ditampilkan sebagai **kemungkinan lain**.
4. Jika nilai CF sama, didahulukan aturan yang seluruh premisnya terpenuhi
   (hasil forward chaining), lalu aturan dengan rasio gejala cocok terbesar.

### Langkah 6 — Interpretasi nilai CF

| Nilai CF | Interpretasi |
|---|---|
| ≥ 0,8 | Hampir pasti |
| 0,6 – < 0,8 | Kemungkinan besar |
| 0,4 – < 0,6 | Kemungkinan |
| 0,2 – < 0,4 | Mungkin |
| < 0,2 | Tidak pasti |

---

## 3. Basis Pengetahuan

### 3.1 Data penyakit

| Kode | Penyakit |
|---|---|
| P01 | Tuberkulosis (TBC) Paru |
| P02 | Pneumonia |
| P03 | Asma |
| P04 | Penyakit Paru Obstruktif Kronis (PPOK) |
| P05 | Bronkitis Akut |
| P06 | Kanker Paru |
| P07 | Efusi Pleura |
| P08 | Bronkiektasis |

### 3.2 Aturan dan CF pakar

Nilai dalam kurung adalah CF pakar setiap gejala terhadap penyakit.

| Aturan | IF (gejala dan CF pakar) | THEN |
|---|---|---|
| R01 | G01 (0,8), G02 (0,6), G08 (0,4), G10 (0,8), G11 (0,6), G12 (0,4) | P01 |
| R02 | G02 (0,4), G05 (0,6), G07 (0,6), G09 (0,8), G14 (0,8), G15 (0,6) | P02 |
| R03 | G03 (0,4), G05 (0,6), G06 (0,8), G16 (1,0), G17 (0,6) | P03 |
| R04 | G05 (0,6), G06 (0,6), G18 (0,8), G19 (0,8), G20 (0,8) | P04 |
| R05 | G02 (0,8), G08 (0,4), G13 (0,4), G17 (0,6) | P05 |
| R06 | G01 (0,6), G04 (0,8), G07 (0,6), G11 (0,6), G18 (0,8), G21 (0,8) | P06 |
| R07 | G03 (0,4), G05 (0,6), G22 (0,8), G23 (0,8) | P07 |
| R08 | G01 (0,6), G04 (0,6), G05 (0,4), G25 (1,0) | P08 |

> Nilai CF pakar di atas adalah contoh dan wajib divalidasi oleh pakar
> (dokter spesialis paru).

---

## 4. Contoh Kasus

### 4.1 Input pasien

| Kode | Gejala | Pilihan | CF user |
|---|---|---|---|
| G01 | Batuk lebih dari 2 minggu | Yakin | 0,8 |
| G02 | Batuk berdahak | Sangat yakin | 1,0 |
| G05 | Sesak napas | Sedikit yakin | 0,4 |
| G08 | Demam | Cukup yakin | 0,6 |
| G10 | Berkeringat di malam hari tanpa aktivitas | Yakin | 0,8 |
| G11 | Berat badan turun tanpa sebab yang jelas | Sedikit yakin | 0,4 |
| G12 | Nafsu makan menurun | Cukup yakin | 0,6 |

Gejala lainnya diisi **Tidak merasakan** (0).

### 4.2 Proses forward chaining

**Fakta awal:** {G01, G02, G05, G08, G10, G11, G12}

**Iterasi 1**

| Aturan | Premis | Premis yang tidak ada | Status |
|---|---|---|---|
| R01 → P01 | G01, G02, G08, G10, G11, G12 | — | ✅ Dieksekusi, P01 ditambahkan ke fakta |
| R02 → P02 | G02, G05, G07, G09, G14, G15 | G07, G09, G14, G15 | ❌ |
| R03 → P03 | G03, G05, G06, G16, G17 | G03, G06, G16, G17 | ❌ |
| R04 → P04 | G05, G06, G18, G19, G20 | G06, G18, G19, G20 | ❌ |
| R05 → P05 | G02, G08, G13, G17 | G13, G17 | ❌ |
| R06 → P06 | G01, G04, G07, G11, G18, G21 | G04, G07, G18, G21 | ❌ |
| R07 → P07 | G03, G05, G22, G23 | G03, G22, G23 | ❌ |
| R08 → P08 | G01, G04, G05, G25 | G04, G25 | ❌ |

**Iterasi 2:** tidak ada aturan baru yang terpenuhi, sehingga proses berhenti.

**Jejak penalaran:** Iterasi 1 — Aturan R01 terpenuhi
(`IF G01 AND G02 AND G08 AND G10 AND G11 AND G12 THEN P01`).

### 4.3 Perhitungan CF — P01 TBC Paru (aturan R01)

| Gejala | CF pakar | CF user | CF gejala | CF kombinasi |
|---|---|---|---|---|
| G01 | 0,8 | 0,8 | 0,8 × 0,8 = 0,64 | **0,64** (nilai awal) |
| G02 | 0,6 | 1,0 | 0,6 × 1,0 = 0,60 | 0,64 + 0,60 × (1 − 0,64) = **0,856** |
| G08 | 0,4 | 0,6 | 0,4 × 0,6 = 0,24 | 0,856 + 0,24 × (1 − 0,856) = **0,8906** |
| G10 | 0,8 | 0,8 | 0,8 × 0,8 = 0,64 | 0,8906 + 0,64 × (1 − 0,8906) = **0,9606** |
| G11 | 0,6 | 0,4 | 0,6 × 0,4 = 0,24 | 0,9606 + 0,24 × (1 − 0,9606) = **0,9701** |
| G12 | 0,4 | 0,6 | 0,4 × 0,6 = 0,24 | 0,9701 + 0,24 × (1 − 0,9701) = **0,9772** |

**CF P01 = 0,9772 → 97,72% (Hampir pasti)**

### 4.4 Perhitungan CF — penyakit dengan gejala cocok sebagian

**P05 Bronkitis Akut (R05)** — gejala cocok: G02, G08

| Gejala | CF pakar | CF user | CF gejala | CF kombinasi |
|---|---|---|---|---|
| G02 | 0,8 | 1,0 | 0,80 | **0,80** |
| G08 | 0,4 | 0,6 | 0,24 | 0,80 + 0,24 × (1 − 0,80) = **0,848** |

**P06 Kanker Paru (R06)** — gejala cocok: G01, G11

| Gejala | CF pakar | CF user | CF gejala | CF kombinasi |
|---|---|---|---|---|
| G01 | 0,6 | 0,8 | 0,48 | **0,48** |
| G11 | 0,6 | 0,4 | 0,24 | 0,48 + 0,24 × (1 − 0,48) = **0,6048** |

**P08 Bronkiektasis (R08)** — gejala cocok: G01, G05

| Gejala | CF pakar | CF user | CF gejala | CF kombinasi |
|---|---|---|---|---|
| G01 | 0,6 | 0,8 | 0,48 | **0,48** |
| G05 | 0,4 | 0,4 | 0,16 | 0,48 + 0,16 × (1 − 0,48) = **0,5632** |

**P02 Pneumonia (R02)** — gejala cocok: G02, G05

| Gejala | CF pakar | CF user | CF gejala | CF kombinasi |
|---|---|---|---|---|
| G02 | 0,4 | 1,0 | 0,40 | **0,40** |
| G05 | 0,6 | 0,4 | 0,24 | 0,40 + 0,24 × (1 − 0,40) = **0,544** |

**P07 Efusi Pleura (R07), P03 Asma (R03), P04 PPOK (R04)** — gejala cocok: G05

| Gejala | CF pakar | CF user | CF gejala | CF kombinasi |
|---|---|---|---|---|
| G05 | 0,6 | 0,4 | 0,24 | **0,24** |

### 4.5 Hasil akhir

| Peringkat | Penyakit | Gejala cocok | CF | Persentase | Interpretasi |
|---|---|---|---|---|---|
| **1** | **TBC Paru** | 6/6 (lengkap) | 0,9772 | **97,72%** | Hampir pasti |
| 2 | Bronkitis Akut | 2/4 | 0,848 | 84,8% | Hampir pasti |
| 3 | Kanker Paru | 2/6 | 0,6048 | 60,48% | Kemungkinan besar |
| 4 | Bronkiektasis | 2/4 | 0,5632 | 56,32% | Kemungkinan |
| 5 | Pneumonia | 2/6 | 0,544 | 54,4% | Kemungkinan |
| 6 | Efusi Pleura | 1/4 | 0,24 | 24% | Mungkin |
| 7 | Asma | 1/5 | 0,24 | 24% | Mungkin |
| 8 | PPOK | 1/5 | 0,24 | 24% | Mungkin |

Peringkat 6–8 memiliki CF yang sama sehingga diurutkan berdasarkan rasio gejala
cocok (1/4 > 1/5).

**Kesimpulan:** pasien terindikasi **Tuberkulosis (TBC) Paru** dengan tingkat
kepastian **97,72% (Hampir pasti)**. Penyakit lainnya ditampilkan sebagai
kemungkinan lain beserta persentasenya.

---

## 5. Sifat dan Catatan Metode

1. **CF kombinasi hanya bertambah.** Setiap gejala tambahan yang cocok menaikkan
   nilai CF dan tidak pernah menurunkannya, dengan batas maksimum 1 (100%).
2. **Urutan gejala tidak memengaruhi hasil.** Rumus kombinasi bersifat komutatif,
   sehingga menghitung G01 → G12 maupun sebaliknya menghasilkan nilai yang sama
   (0,9772).
3. **Hasil bergantung pada nilai CF pakar.** Pada contoh di atas, Bronkitis Akut
   memperoleh 84,8% walaupun hanya 2 dari 4 gejala yang cocok, karena CF pakar G02
   terhadap Bronkitis Akut bernilai tinggi (0,8). Oleh karena itu nilai CF pakar
   perlu divalidasi oleh dokter.
4. **Peran forward chaining dan certainty factor.** Forward chaining menentukan
   aturan yang seluruh premisnya terpenuhi (pada contoh: R01, TBC 6/6) dan
   menghasilkan jejak penalaran sebagai fasilitas penjelasan. Certainty factor
   menentukan peringkat dan tingkat kepastian setiap penyakit.

---

## 6. Implementasi pada Kode

| Bagian | Lokasi |
|---|---|
| Mesin forward chaining | `services/forwardChaining.js` — fungsi `forwardChaining()` |
| Rumus CF per aturan | `services/certaintyFactor.js` — fungsi `hitungCFRule()` |
| Ranking penyakit berdasarkan CF | `services/certaintyFactor.js` — fungsi `rankingPenyakit()` |
| Interpretasi nilai CF | `services/certaintyFactor.js` — fungsi `interpretasi()` |
| Alur proses diagnosa | `controllers/diagnosaController.js` — fungsi `proses()` |
| Tampilan hasil dan tabel perhitungan | `views/diagnosa/hasil.ejs` |
| Data awal dan CF pakar | `seeders/data.js` |
| Unit test | `tests/forwardChaining.test.js`, `tests/certaintyFactor.test.js` |
