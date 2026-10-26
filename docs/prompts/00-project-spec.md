# Project Specification — Vibe Coding

## 1. Informasi Aplikasi

**Nama aplikasi:**  
`Student Grade Calculator`

**Deskripsi aplikasi:**  
Aplikasi web untuk mengelola data mahasiswa dan menghitung nilai akhir berdasarkan komponen penilaian berbobot. Aplikasi dapat menentukan nilai huruf dan predikat mahasiswa secara otomatis berdasarkan rentang nilai yang telah ditetapkan.

**Target pengguna:**
- Admin/Dosen: mengelola data mahasiswa, komponen penilaian, dan nilai.
- User: melihat hasil nilai mahasiswa sesuai hak akses yang diberikan.

**Masalah yang ingin diselesaikan:**  
Penghitungan nilai mahasiswa secara manual membutuhkan waktu dan berisiko menimbulkan kesalahan perhitungan. Aplikasi ini mengotomatisasi perhitungan nilai akhir, konversi nilai huruf, dan penyimpanan hasil penilaian.

## 2. Kebutuhan Aplikasi

### Fitur utama aplikasi

1. Registrasi akun dan login.
2. Logout dan autentikasi pengguna menggunakan JWT dalam cookie.
3. Dashboard yang menampilkan jumlah mahasiswa, jumlah penilaian, rata-rata nilai, dan distribusi nilai huruf.
4. CRUD data mahasiswa.
5. CRUD mata kuliah.
6. Input dan pengelolaan nilai mahasiswa.
7. Penghitungan nilai akhir secara otomatis menggunakan algoritma rata-rata berbobot.
8. Konversi nilai akhir menjadi nilai huruf dan predikat.
9. Menampilkan hasil penilaian dalam tabel.
10. Pencarian dan filter berdasarkan nama mahasiswa, NIM, mata kuliah, dan nilai huruf.
11. Validasi nilai dan bobot penilaian.
12. Pengujian algoritma perhitungan nilai menggunakan beberapa kasus uji.

### Halaman aplikasi

- **Login:** autentikasi menggunakan email dan password.
- **Register:** registrasi akun.
- **Dashboard:** ringkasan data mahasiswa dan hasil penilaian.
- **Data Mahasiswa:** menampilkan, menambah, mengedit, dan menghapus data mahasiswa.
- **Data Mata Kuliah:** mengelola mata kuliah.
- **Input Nilai:** memasukkan nilai tugas, kuis, UTS, dan UAS.
- **Hasil Penilaian:** menampilkan nilai komponen, nilai akhir, nilai huruf, dan predikat.
- **Profil dan Logout:** informasi akun dan fungsi logout.

## 3. Pilihan Teknologi

### A. Backend Framework

- [ ] 1. Go Standard Library (`net/http`)
- [x] 2. Gin
- [ ] 3. Lainnya

**Pilihan saya:** `2 — Gin`

### B. ORM (Object-Relational Mapping)

- [ ] 1. Tidak menggunakan ORM (SQL manual)
- [x] 2. GORM
- [ ] 3. Lainnya

**Pilihan saya:** `2 — GORM`

**Ketentuan:** Gunakan GORM untuk operasi database PostgreSQL dan pengelolaan relasi data. Terapkan validasi, penanganan error, dan migrasi skema database.

### C. Database

- [x] 1. PostgreSQL
- [ ] 2. MySQL
- [ ] 3. SQLite

**Pilihan saya:** `1 — PostgreSQL`

### D. Frontend

- [x] 1. HTML, CSS, JavaScript, dan jQuery
- [ ] 2. React
- [ ] 3. Vue

**Pilihan saya:** `1 — HTML, CSS, JavaScript, dan jQuery`

**Ketentuan:** Gunakan HTML untuk struktur halaman, CSS untuk tampilan, dan JavaScript dengan jQuery AJAX untuk interaksi serta komunikasi dengan backend tanpa memuat ulang halaman secara penuh.

### E. Sistem Autentikasi

- [ ] 1. Session
- [x] 2. JWT

**Pilihan saya:** `2 — JWT`

**Ketentuan:** Gunakan JWT untuk autentikasi. Backend memvalidasi token dan hak akses pengguna melalui middleware Gin. Password harus disimpan menggunakan algoritma hashing yang sesuai. JWT secret wajib dibaca dari environment variable.

### F. Penyimpanan Sesi atau Token

- [x] 1. Cookie
- [ ] 2. localStorage
- [ ] 3. Tidak diperlukan

**Pilihan saya:** `1 — Cookie`

**Ketentuan:**

1. Simpan JWT dalam cookie `HttpOnly` yang dibuat oleh backend.
2. Gunakan atribut `Secure` pada lingkungan HTTPS.
3. Atur `SameSite`, `Path`, dan masa berlaku cookie secara tepat.
4. Terapkan perlindungan CSRF pada request yang mengubah data.
5. Logout menghapus cookie dengan konfigurasi yang sesuai.
6. Jangan menyimpan JWT di `localStorage` atau `sessionStorage`.

### G. API

- [x] 1. REST API
- [ ] 2. Tidak membutuhkan API terpisah

**Pilihan saya:** `1 — REST API`

**Ketentuan:** Backend menyediakan REST API untuk autentikasi, data mahasiswa, mata kuliah, input nilai, dan hasil perhitungan. Frontend mengakses API menggunakan jQuery AJAX dengan `$.ajax()`. Gunakan JSON, HTTP status code yang sesuai, dan pesan error yang tidak membocorkan informasi sensitif.

Rancangan endpoint awal:

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/auth/register` | Registrasi akun |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Identitas pengguna aktif |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/private/dashboard/summary` | Ringkasan dashboard |
| GET | `/api/private/students` | Daftar mahasiswa |
| POST | `/api/private/students` | Tambah mahasiswa |
| GET | `/api/private/students/:id` | Detail mahasiswa |
| PUT | `/api/private/students/:id` | Edit mahasiswa |
| DELETE | `/api/private/students/:id` | Hapus mahasiswa |
| GET | `/api/private/courses` | Daftar mata kuliah |
| POST | `/api/private/courses` | Tambah mata kuliah |
| PUT | `/api/private/courses/:id` | Edit mata kuliah |
| DELETE | `/api/private/courses/:id` | Hapus mata kuliah |
| GET | `/api/private/grades` | Daftar hasil penilaian |
| POST | `/api/private/grades` | Input nilai mahasiswa |
| GET | `/api/private/grades/:id` | Detail hasil penilaian |
| PUT | `/api/private/grades/:id` | Perbarui nilai |
| DELETE | `/api/private/grades/:id` | Hapus penilaian |

Endpoint dan hak akses akhir harus disesuaikan dengan struktur aplikasi yang disetujui.

## 4. Algoritma Penghitungan Nilai

### A. Algoritma utama: Weighted Average

Nilai akhir dihitung menggunakan rata-rata berbobot berdasarkan komponen penilaian.

**Komponen dan bobot awal:**

| Komponen | Bobot |
|---|---:|
| Tugas | 20% |
| Kuis | 20% |
| UTS | 25% |
| UAS | 35% |
| **Total** | **100%** |

**Rumus nilai akhir:**

`Nilai Akhir = (Tugas × 0,20) + (Kuis × 0,20) + (UTS × 0,25) + (UAS × 0,35)`

Contoh:

- Tugas = 85
- Kuis = 80
- UTS = 75
- UAS = 90

Perhitungan:

`Nilai Akhir = (85 × 0,20) + (80 × 0,20) + (75 × 0,25) + (90 × 0,35)`

`Nilai Akhir = 17 + 16 + 18,75 + 31,5 = 83,25`

### B. Konversi Nilai Huruf

Gunakan rentang nilai awal berikut:

| Nilai akhir | Nilai huruf | Predikat |
|---|---|---|
| 85–100 | A | Sangat Baik |
| 80–84,99 | AB | Baik Sekali |
| 75–79,99 | B | Baik |
| 70–74,99 | BC | Cukup Baik |
| 65–69,99 | C | Cukup |
| 50–64,99 | D | Kurang |
| 0–49,99 | E | Sangat Kurang |

Rentang nilai dan predikat harus dapat disesuaikan dengan kebijakan akademik yang berlaku.

### C. Ketentuan algoritma

1. Semua nilai komponen berada dalam rentang 0–100.
2. Bobot komponen harus berjumlah tepat 100%.
3. Nilai akhir dihitung oleh backend agar hasilnya konsisten dan tidak dapat dimanipulasi melalui frontend.
4. Nilai akhir disimpan dengan presisi desimal yang memadai.
5. Konversi nilai huruf menggunakan nilai akhir sebelum pembulatan tampilan.
6. Nilai huruf ditentukan berdasarkan rentang yang tidak tumpang tindih.
7. Penghitungan ulang dilakukan ketika nilai komponen berubah.
8. Nilai yang belum lengkap tidak boleh dianggap sebagai nilai akhir final tanpa aturan yang jelas.

## 5. Detail Autentikasi dan Hak Akses

**Registrasi akun:** Ya  
**Login:** Ya  
**Logout:** Ya

**Role pengguna:**

1. **Admin:** mengelola akun pengguna dan konfigurasi aplikasi jika diperlukan.
2. **Dosen:** mengelola mahasiswa, mata kuliah, input nilai, dan hasil penilaian.
3. **User/Mahasiswa:** melihat hasil penilaian miliknya sendiri.

**Aturan akses:**

1. Endpoint privat hanya dapat diakses pengguna dengan token JWT valid.
2. Hak akses diperiksa di backend, bukan hanya dengan menyembunyikan menu frontend.
3. Admin dapat mengelola akun dan pengaturan sesuai kewenangannya.
4. Dosen hanya dapat mengelola data dan nilai yang menjadi kewenangannya.
5. Mahasiswa hanya dapat melihat hasil penilaiannya sendiri.
6. Backend tidak boleh mempercayai `user_id` atau identitas mahasiswa yang dikirim bebas oleh frontend.
7. Password harus disimpan dalam bentuk hash.
8. Cookie autentikasi harus dikonfigurasi dengan atribut keamanan yang sesuai.
9. Operasi yang mengubah data harus dilindungi dari CSRF.
10. Logout menghapus cookie autentikasi dan menjalankan pencabutan token di backend jika mekanisme tersebut diterapkan.

## 6. Konfigurasi Environment dan Database

**Ketentuan wajib:**

1. Semua konfigurasi sensitif menggunakan environment variable.
2. Gunakan `.env` untuk pengembangan lokal.
3. Sediakan `.env.example` tanpa kredensial asli.
4. File `.env` wajib masuk ke `.gitignore`.
5. Connection string PostgreSQL harus dibaca melalui `DATABASE_URL`.
6. Jangan melakukan hardcode terhadap kredensial database atau JWT secret.
7. Tampilkan pesan error konfigurasi yang jelas tanpa membocorkan informasi rahasia.
8. Gunakan konfigurasi SSL sesuai kebutuhan lingkungan database.
9. Jangan mencetak token atau password pada log.

Contoh `.env.example`:

```dotenv
APP_PORT=8080
DATABASE_URL=postgres://username:password@localhost:5432/student_grade_calculator?sslmode=disable
JWT_SECRET=replace-with-a-random-secret
JWT_EXPIRES_IN=15m
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
```

Nilai tersebut hanya contoh untuk pengembangan lokal. Pada produksi, gunakan secret yang kuat dan HTTPS dengan konfigurasi cookie yang aman.

## 7. Batasan Pengembangan

- [x] Struktur folder sederhana.
- [x] Kode mudah dipahami pemula.
- [x] Tidak menambahkan teknologi di luar pilihan tanpa persetujuan.
- [x] Memisahkan frontend dan backend.
- [x] Menggunakan environment variable untuk konfigurasi.
- [x] Membuat pengujian dasar.
- [x] Menjelaskan kode dan perubahan yang dibuat AI.

**Batasan tambahan:**

1. Backend menggunakan Go dan Gin.
2. Database menggunakan PostgreSQL dan GORM.
3. Frontend menggunakan HTML, CSS, JavaScript, dan jQuery AJAX.
4. Autentikasi menggunakan JWT dalam cookie `HttpOnly`.
5. Tidak menggunakan React atau Vue.
6. Tidak menambahkan dependensi tanpa menjelaskan alasan dan meminta persetujuan.
7. Pengembangan dilakukan bertahap, dimulai dari struktur folder, konfigurasi, database, autentikasi, CRUD, algoritma perhitungan, dashboard, dan pengujian.
8. Setiap tahap harus dijelaskan dan diuji sebelum melanjutkan.
9. Jangan membuat atau mengubah file sebelum struktur folder disetujui.

### 7.1. Fitur yang Tidak Dibutuhkan

- Integrasi dengan sistem akademik eksternal.
- Pembayaran atau langganan.
- Aplikasi mobile native.
- Integrasi AI.
- Analisis prediktif nilai mahasiswa.
- Penghitungan IPK lintas semester.
- KRS dan KHS lengkap.
- Pengelolaan presensi otomatis.
- Notifikasi SMS atau WhatsApp.
- Integrasi dengan LMS eksternal.

## 8. Pemeriksaan Sebelum Vibe Coding

- [x] Nama dan tujuan aplikasi sudah jelas.
- [x] Fitur utama sudah ditentukan.
- [x] Pilihan teknologi sudah diisi.
- [x] Kebutuhan autentikasi dan hak akses sudah ditentukan.
- [x] Algoritma dan rumus perhitungan sudah ditentukan.
- [x] Batasan proyek sudah ditentukan.
- [x] Penggunaan `.env` dan `DATABASE_URL` sudah ditentukan.

**Status spesifikasi:** Siap diperiksa dan disetujui sebelum implementasi.

## 9. Instruksi untuk Agy

Baca dan pahami file `docs/prompts/00-project-spec.md` secara lengkap.

Gunakan spesifikasi ini sebagai acuan utama pengembangan.

1. Periksa kelengkapan dan konsistensi spesifikasi.
2. Tanyakan jika ada informasi penting yang belum jelas.
3. Usulkan struktur folder sederhana dan jelaskan fungsi folder serta file utama.
4. Jangan langsung membuat seluruh aplikasi sekaligus.
5. Jangan membuat, mengubah, atau menghapus file sebelum saya menyetujui struktur folder.
6. Implementasikan aplikasi secara bertahap setelah mendapat persetujuan.
7. Jelaskan perubahan kode dan cara menguji setiap tahap.
8. Jangan mengganti teknologi atau menambahkan dependensi tanpa penjelasan dan persetujuan.
9. Pastikan `DATABASE_URL` dibaca dari environment variable dan tidak di-hardcode.
10. Pastikan `.env` masuk ke `.gitignore` dan `.env.example` boleh disimpan di Git.
11. Jangan menampilkan nilai rahasia dari `.env` pada log atau respons API.
12. Pastikan autentikasi, otorisasi, dan perlindungan CSRF diterapkan dengan benar.
13. Pastikan algoritma perhitungan nilai akhir dijalankan di backend.
14. Buat pengujian untuk perhitungan nilai akhir, validasi bobot, konversi nilai huruf, dan pembatasan akses.
15. Tunggu persetujuan eksplisit saya sebelum membuat atau memodifikasi file.
16. Jika terdapat konflik atau ketidakjelasan dalam spesifikasi, minta klarifikasi sebelum melanjutkan.
17. Mulai dengan memeriksa spesifikasi dan mengusulkan struktur folder. Jangan langsung menulis kode aplikasi.
