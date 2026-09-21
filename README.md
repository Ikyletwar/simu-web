# SIMU - Sistem Informasi Manajemen Ujian

Aplikasi ujian sekolah berbasis web untuk **SMK Negeri 1 Maluku Tengah**.

## Deskripsi

- Login siswa (NIS + password) dan login admin (email + password)
- Admin/guru: CRUD soal, import & export soal, buat ujian, import siswa massal (akun otomatis),
  atur data siswa, laporan nilai per ujian (+ detail jawaban siswa + export CSV), lihat ranking,
  kelola akun admin/guru lain (tambah, reset password, hapus) via menu "Data Guru"
- Siswa: kerjakan ujian dengan timer, lihat nilai, lihat ranking, ubah password
- Ranking: filter Global / Per Jurusan / Per Kelas
- Bank soal dikelompokkan per **topik** dalam mapel (opsional), import & export mendukung baris `Topik:`
- **Mata pelajaran** bisa dikelola (tambah/ubah/hapus) langsung dari halaman Kelola Soal
- Soal pilihan ganda mendukung **hingga 6 opsi (A-F)**; opsi E/F opsional, A-D wajib
- Soal mendukung **LaTeX/rumus matematika** (merender `$...$`) via KaTeX
- Soal bisa berisi **blok kode** (diapit ` ``` `) yang ditampilkan rapi seperti editor kode
- Mendukung **soal esai/uraian** (dijawab menulis teks, tidak dikoreksi otomatis; guru
  menilai manual di menu Laporan Nilai)
- **Koreksi esai massal** (halaman Koreksi Esai): nilai satu soal esai untuk semua siswa
  sekaligus (mode *Per Soal*) atau nilai semua esai satu siswa (mode *Per Siswa*), dengan
  progres penilaian
- Ujian bisa diarahkan ke **kelas (X/XI/XII)** dan **jurusan (kode pendek: MPLB, AKL, PMS, ULP, TJKT, TK)**
- **Jadwal ujian**: tanggal & jam mulai/selesai; dashboard siswa tampil countdown real-time
  dan otomatis pindah ke bagian "Ujian Tersedia" saat waktunya tiba
- **Anti curang**: urutan soal & pilihan diacak per siswa (bisa dimatikan per ujian
  lewat toggle "Acak Urutan Soal" di Kelola Ujian), deteksi pindah tab/layar penuh
  (peringatan, otomatis dikumpulkan setelah 3x), blokir klik kanan & pintasan umum
- **Autosave jawaban**: jawaban disimpan otomatis di perangkat (localStorage) tiap beberapa
  detik. Kalau koneksi putus / tab tertutup, ujian bisa dilanjutkan dari soal terakhir
- Data siswa kini punya **pencarian & filter**, tombol **Tambah Siswa** (1 akun), **Reset
  Password**, dan **Hapus** (memakai RPC `create_students`, `reset_guru_password`, `delete_guru`)
- Form **Tambah Siswa**: Kelas hanya X/XI/XII; jurusan TJKT & TK otomatis memunculkan pilihan
  **rombel 1/2** (contoh `XI TJKT 1`, `X TK 2`). Import teks/Excel juga mendukung nama kelas
  ber-rombel di kolom Kelas, dan jurusan boleh diisi kode (TJKT) atau nama lengkap
- Data guru punya **pencarian**, tombol lihat/sembunyikan password, dan **panel salin
  kredensial** setelah akun dibuat
- Animasi boot SIMU setiap kali membuka atau me-refresh halaman login
- Responsif untuk HP dan PC
- Design monokrom (hitam-putih-abu) dengan warna status untuk feedback

## Tech Stack

- HTML5, CSS3, JavaScript vanilla
- Supabase (Auth + Database) via CDN: `@supabase/supabase-js@2`
- Lucide Icons via CDN
- Font Inter via Google Fonts

## Struktur Folder

```
simu-web/
├── index.html              halaman login siswa (auto redirect ke boot dulu)
├── boot.html               animasi boot SIMU
├── admin.html              login admin
├── dashboard-siswa.html    dashboard siswa
├── dashboard-admin.html    dashboard admin
├── ujian.html              halaman kerjakan ujian
├── hasil.html              halaman hasil ujian
├── ranking.html            halaman ranking (siswa & admin)
├── laporan.html            laporan nilai per ujian (admin)
├── koreksi-esai.html       koreksi esai massal: per soal & per siswa (admin)
├── ubah-password.html      ubah password (admin & siswa)
├── kelola-soal.html        daftar bank soal (import & export)
├── form-soal.html          form tambah/edit soal
├── kelola-ujian.html       kelola ujian
├── kelola-siswa.html       data siswa (import massal)
├── kelola-guru.html        kelola akun admin/guru (menu "Data Guru")
├── css/                    file style
├── js/                     file javascript (auth.js, common.js, dst.)
├── assets/logo.svg         logo SIMU
├── sql/                    skrip SQL untuk Supabase
├── .env                    kredensial Supabase
└── README.md
```

## Setup Database (Supabase)

Jalankan file SQL di folder `sql/` secara berurutan di **Supabase SQL Editor**:

1. `01-fase2-tabel-dasar.sql` - tabel majors, classes, subjects, users
2. `02-fase2-trigger-signup.sql` - trigger user signup + policy
3. `03-fase2-seed-master.sql` - data jurusan, kelas, mapel
4. `05-fase3-tabel-questions.sql` - tabel bank soal
5. `06-fase4-tabel-ujian.sql` - tabel exams, exam_questions, submissions
6. `07-fase5-ranking.sql` - function ranking (+ pastikan versi sudah pakai alias `c.nama`/`m.nama`)
7. `08-fase6-import-siswa.sql` - function `create_students` untuk import siswa massal
8. `09-fase7-topik.sql` - tabel `topics` + kolom `topic_id` pada `questions`
9. `10-fase8-guru.sql` - kolom `subject_id` pada `users` + RPC `create_guru`, `reset_guru_password`, `delete_guru`
10. `11-fase9-esai-kelas.sql` - **soal esai** (kolom `questions.tipe`, pilihan/kunci jadi opsional),
    penilaian manual (`submissions.nilai_esai` + policy update admin), dan seed kelas semua jurusan
    (untuk dropdown Kelas X/XI/XII di Kelola Ujian)
11. `13-fase11-rombel-tjkt-tk.sql` - kelas rombel **TJKT 1/2 & TK 1/2** (X/XI/XII) + versi lengkap fungsi
    `create_students`, `reset_guru_password`, `delete_guru` untuk akun siswa (sekali paste).
    File 13 sudah termasuk perbaikan `RETURN NEXT` dan cocok menggantikan `08` & bagian akun `10`.
12. `14-fase12-mapel-opsi-acak.sql` - policy admin untuk **CRUD mata pelajaran**, opsi soal baru
     `pilihan_e`/`pilihan_f` (maksimal 6 pilihan A-F), dan kolom `exams.acak_soal` (toggle "Acak
     Urutan Soal" per ujian). Tanpa file ini, tambah/ubah/hapus mapel, opsi E/F, dan toggle acak
     belum berfungsi.
13. `15-fase13-ubah-login-siswa.sql` - RPC **`update_siswa_login`** untuk mengubah kredensial
    login siswa (NIS/username, email, password) dari halaman Data Siswa. Tanpa file ini,
    tombol "Login" di Data Siswa belum berfungsi.
14. `16-fase14-kelas-gabungan.sql` - kelas sasaran **agregat rombel**: menambah kelas
    "X/XI/XII TJKT" dan "X/XI/XII TK" (tanpa nomor rombel) sehingga di Kelola Ujian pilih
    `XI TJKT` = menargetkan XI TJKT 1 **dan** XI TJKT 2 sekaligus. Tanpa file ini, opsi
    "XI TJKT" belum ada di dropdown Kelas Sasaran.
15. `17-fase15-login-guru.sql` - login guru/admin memakai **email atau username**: `create_guru`
    diubah (username tanpa `@` otomatis jadi `<username>@simu.local`) + RPC baru
    `update_guru_login` untuk mengubah email/username dan password akun admin dari
    menu Data Guru. Tanpa file ini, menu "Login" di Data Guru belum berfungsi.
16. `18-fase16-edit-hapus-guru.sql` - RPC `update_guru_profil` (ubah nama & mapel admin) dan
    `delete_guru` yang membolehkan menghapus **akun mana pun termasuk akun sendiri / "Admin
    Sekolah"**. Menghidupkan tombol **Edit** dan **Hapus** untuk semua akun di menu Data Guru.

> **PENTING:** jalankan `11-fase9-esai-kelas.sql` sebelum memakai fitur soal esai dan
> dropdown Kelas/Jurusan yang baru. Tanpa file ini, soal esai tidak bisa disimpan
> (kolom `tipe` belum ada) dan guru tidak bisa menyimpan penilaian manual.

File `04-fase2-user-dummy.sql` berisi panduan membuat user dummy untuk test.

> Catatan: supabase URL & key sudah di-hardcode di `js/supabase.js`
> agar siap dipakai di Netlify. File `.env` disediakan sebagai backup/arsip.

## Data Siswa: Ubah Kredensial Login

Setiap siswa login memakai **NIS** sebagai username. Dari tombol **Login** pada tiap baris di
menu **Data Siswa**, admin bisa:

- Mengubah **NIS / username login** (perlu SQL `15-fase13-ubah-login-siswa.sql`).
- Mengubah **email akun** (opsional). Bila dikosongkan, email otomatis `<NIS>@simu.local`.
  Jika email custom diisi, siswa juga bisa login memakai email tersebut langsung.
- Mengatur **password baru** (opsional, min. 6 karakter).

Kolom yang dikosongkan tidak diubah. NIS dan email dicek keunikannya di server.

## Data Guru (Akun Admin Tambahan)

Menu **Data Guru** dipakai untuk membuat akun admin baru (mis. guru-guru utama per mapel).
Guru yang dibuat otomatis berperan admin: bisa login, menambah/mengelola soal & ujian,
dan melihat laporan. Form membuat akun meminta nama, **email atau username** login
(username tanpa `@` otomatis menjadi `<username>@simu.local`), password (min. 6 karakter),
dan mata pelajaran yang diampu (opsional). Setiap baris punya tombol **Edit** (ubah nama,
mapel, email/username, password), **Reset** (ganti password), dan **Hapus**. Semua akun —
termasuk akun sendiri / "Admin Sekolah" — bisa diedit dan dihapus; saat menghapus akun sendiri
Anda akan otomatis keluar. Perlu SQL `17-fase15-login-guru.sql` dan `18-fase16-edit-hapus-guru.sql`.

## Format Import Soal (Kelola Soal)

Satu blok per soal, dipisah baris kosong. Baris `Topik:` bersifat opsional dan
dipakai untuk mengelompokkan soal ke dalam topik tertentu di dalam mapel.

```
1. Pertanyaan pertama?
A. Pilihan A
B. Pilihan B
C. Pilihan C
D. Pilihan D
Jawaban: B
Topik: Routing Dasar
```

Baris opsi diawali `A.` - `F.` (**A-D wajib**, E/F opsional dan harus kontigu),
kunci di baris `Jawaban: <huruf>`,
dan `Topik: <nama>` opsional (dibuat otomatis jika belum ada).
Soal **esai** cukup tulis pertanyaannya lalu tambahkan baris `Jenis: Esai`
(tanpa pilihan A-D dan tanpa kunci):

```
3. Jelaskan fungsi dari sistem operasi!
Jenis: Esai
```

Blok **kode** di dalam soal ditulis dengan pembatas tiga backtick di awal dan akhir:

```
4. Tuliskan output dari kode berikut:
```python
print("Hello SIMU")
```
Jenis: Esai
```

## Format Import Siswa (Data Siswa)

Setiap baris: `NIS;Nama;Kelas;Jurusan;Password`
(Kelas & Jurusan boleh dikosongkan). Email login otomatis: `NIS@simu.local`.

```
12345;Budi Santoso;XI TJKT;TJKT;12345
12346;Ani Rahma;XI AKL;AKL;12346
```

Fitur ini membutuhkan SQL `08-fase6-import-siswa.sql` dijalankan dulu di Supabase.

## Menulis Rumus Matematika (LaTeX)

Soal dan opsi jawaban bisa memuat rumus matematika. Tulis rumus dalam tanda `$ ... $`
(inline) atau `$$ ... $$` (baris terpisah/besar). Contoh:

```
Hitung integral berikut: $$\int_0^1 x^2\,dx$$
Jika $f(x) = 2x + 3$, berapakah nilai $f(5)$?
```

Rumus dirender otomatis (KaTeX) di daftar soal, form soal, pemilih soal, halaman ujian,
hasil ujian, dan laporan. Kimia juga didukung, mis. `\ce{H2O}`. Saat menulis soal, cukup
ketik rumus mentah; saat ditampilkan akan dirender. Tanpa koneksi internet, rumus tetap
tampil sebagai teks `$...$` biasa.

## Soal Esai & Penilaian Manual

- Buat soal esai lewat **Kelola Soal → Form → Jenis Soal: Esai / Uraian**, atau via import
  dengan baris `Jenis: Esai`. Soal esai tidak punya pilihan A-D.
- Saat mengerjakan ujian, siswa menulis jawabannya di kotak teks. Jawaban esai **tidak
  dikoreksi otomatis** — nilai setelah submit baru dari soal pilihan ganda saja
  (halaman hasil menampilkan catatan itu bila ujiannya mengandung esai).
- Guru menilai manual di **Laporan Nilai → tombol Detail** siswa: jawaban esai tampil,
  isi nilai 0–100, lalu klik **Simpan Penilaian Esai**. Nilai akhir dihitung ulang
  dengan bobot satu soal = satu poin (PG benar + nilai esai di-skala ke 100).
- **Koreksi Esai Massal** — halaman **Koreksi Esai** (menu sidebar) mempercepat koreksi:
  - Pilih ujian (hanya ujian berisi esai yang muncul).
  - Mode **Per Soal**: pilih satu soal, semua jawaban siswa tampil berurutan; isi nilai
    beberapa siswa lalu **Simpan** sekaligus. Tekan **Enter** untuk pindah ke siswa berikutnya.
  - Mode **Per Siswa**: nilai semua soal esai satu siswa, lalu pindah siswa lewat tombol
    Sebelumnya/Berikutnya.
  - Progres penilaian (sudah/belum dinilai) tampil per soal, per siswa, dan keseluruhan.
  - Nilai akhir dihitung dengan rumus yang sama seperti di Laporan Nilai.
  - Tombol **Koreksi Esai** juga tersedia di halaman Laporan Nilai (otomatis membuka ujian
    yang sedang dipilih).
- Persyaratan: SQL `11-fase9-esai-kelas.sql` harus sudah dijalankan. Halaman Koreksi Esai
  tidak butuh SQL tambahan (memakai policy `submissions_update_admin` yang sama).

## Keamanan Ujian (Anti Curang, Autosave & Jadwal)

Semua fitur ini sudah aktif tanpa perlu SQL tambahan (berjalan di sisi browser):

- **Jadwal ujian** — kolom "Tanggal & Jam Mulai / Selesai" di Kelola Ujian menentukan
  kapan ujian tersedia. Dashboard siswa menampilkan hitung mundur & otomatis memindahkan
  ujian ke bagian "Ujian Tersedia" saat jadwal mulai (refresh tiap 20 detik).
- **Urutan acak** — urutan soal diacak per siswa (deterministik, tetap sama saat reload),
  dan posisi pilihan A–F ikut diacak. Penilaian tetap memakai kunci asli. Di form **Kelola
  Ujian** ada toggle "Acak Urutan Soal": matikan kalau ingin siswa menerima urutan soal
  sesuai daftar yang dipilih (butuh SQL `14-fase12-mapel-opsi-acak.sql`).
- **Deteksi pindah tab / keluar aplikasi** — setiap pergantian tab, kehilangan fokus,
  atau keluar dari mode layar penuh langsung dihitung **1 pelanggaran** (tanpa menunggu
  5 detik). Setelah 3 pelanggaran, ujian **otomatis dikumpulkan dan nilai dijadikan 0**.
  Seluruh bukti pelanggaran (jenis, waktu, durasi) tercatat di `_meta.catatan` pada
  `submissions.jawaban` dan ditampilkan di **Laporan Nilai → Detail** siswa serta halaman
  **Hasil** siswa.
- **Autosave** — setiap menjawab dan tiap 5 detik, jawaban + posisi soal + sisa waktu
  disimpan di `localStorage`. Kalau koneksi putus atau browser ditutup, buka kembali
  ujian yang sama → muncul "Lanjutkan Ujian" dan waktu/jawaban dipulihkan.
- **Blokir shortcut** — klik kanan, Ctrl+S/P/C/U/I/J, dan screenshot dinonaktifkan selama ujian.

> Catatan: pengerjaan yang disimpan otomatis berada di perangkat si siswa. Nilai tetap
> hanya "dikunci" (hanya-sekali-submit, fase 10) saat tombol Submit ditekan.

## Kelola Ujian: Kelas & Jurusan

Form Kelola Ujian hanya menampilkan **Kelas X / XI / XII** dan **Jurusan dengan kode pendek**
(MPLB, AKL, PMS, ULP, TJKT, TK) — bukan nama panjang. Keduanya opsional:

- Kosongkan keduanya → ujian untuk **semua siswa**.
- Isi jurusan saja → ujian untuk **semua kelas** jurusan itu.
- Isi kelas **dan** jurusan → muncul dropdown **Pilih Kelas Sasaran**. Untuk jurusan ber-rombel
  (TJKT & TK) pilih rombel spesifiknya (mis. `XI TJKT 1` atau `XI TJKT 2`); untuk jurusan lain
  kelasnya otomatis terpilih. Bila ingin menargetkan kedua rombel, buat dua ujian terpisah.

Dashboard siswa & halaman ujian otomatis menyaring: siswa hanya melihat/mengerjakan ujian yang
dialamatkan ke kelas/jurusan mereka (atau ujian umum). Daftar soal pilihan per topik tampil sebagai
**accordion** (klik nama topik untuk membuka/menutup daftar soalnya, tombol "Pilih semua" tetap ada).

## Panduan Pengembangan

Dokumen ini untuk memudahkan menambah fitur ke depan.

### Peran file JavaScript

- `js/supabase.js` — inisialisasi klien Supabase (`supabaseClient`). URL & key ada di sini.
- `js/auth.js` — `guard(role)`, `getProfile()`, `logout()`, `showSnackbar()`. Dipanggil di
  **setiap** halaman (urutan paling awal).
- `js/common.js` — helper bersama: `escapeHtml()`, `truncateText()`, `formatNilai()`, `optionKeys()`.
  Dimuat setelah `auth.js` di semua halaman. **Tambahkan helper umum baru di sini**, jangan
  menyalin fungsi yang sama ke banyak halaman.
- `js/*.js` lain (`soal.js`, `ujian.js`, `guru.js`, `ranking.js`, `backup.js`, `katex-render.js`)
  berisi logika per-fitur; halaman memanggilnya via `<script src>`.

### Alur data umum

1. Halaman HTML memuat `supabase.js` → `auth.js` → `common.js` → skrip fitur.
2. `guard(role)` memastikan sesi & peran; hasilnya dipakai sebagai `profile`.
3. Query/`rpc()` ke Supabase mengembalikan `{ data, error }`. **Selalu cek `error`**
   (supabase-js v2 tidak melempar exception), lalu sembunyikan spinner di `finally`/setelahnya.

### Menambah halaman baru

1. Salin struktur sidebar & `<head>` dari halaman yang mirip.
2. Sertakan `css/style.css`, `css/dashboard.css`, lalu `js/supabase.js`, `js/auth.js`,
   `js/common.js` sebelum skrip inline.
3. Panggil `await guard('admin')` (atau `'siswa'`) di `DOMContentLoaded`.

### Menambah fungsi database (RPC)

1. Tulis `CREATE OR REPLACE FUNCTION` di file `sql/` baru (ikuti pola file 07/08/10/13).
2. Beri `GRANT EXECUTE ... TO authenticated;`.
3. Jalankan di Supabase SQL Editor, lalu panggil dari JS dengan
   `supabaseClient.rpc('nama_fungsi', { param: nilai })`.
4. Jalankan `NOTIFY pgrst, 'reload schema';` bila PostgREST belum mengenali fungsi baru.

### Urutan file SQL

Jalankan sesuai urutan di bagian **Setup Database**. Untuk instalasi baru, urutan aman:
`01 → 02 → 03 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 13 → 14 → 15 → 16 → 17 → 18`.
File `13` memuat versi terbaru `create_students`, `handle_new_user`, dan RPC guru (menggantikan
`08` & bagian akun di `10`). File `14` sampai `18` **bisa dijalankan kapan saja** pada
database yang sudah ada: `14` (policy CRUD mapel, opsi E/F, `exams.acak_soal`),
`15` (RPC `update_siswa_login`), `16` (kelas sasaran agregat rombel TJKT/TK),
`17` (login guru dengan email/username + RPC `update_guru_login`),
`18` (RPC `update_guru_profil` + hapus akun sendiri dengan pengaman admin terakhir).

## Cara Menjalankan (Lokal)

Buka `http://localhost:8080` di browser. Halaman login (`index.html`) akan otomatis
mengarahkan ke animasi boot (`boot.html`) dulu sebelum menampilkan form login.
Animasi bisa di-klik untuk skip. Setiap kali me-refresh halaman login, animasi boot
akan dimainkan kembali.

```bash
python3 -m http.server 8080
```

Lalu buka `http://localhost:8080`.

## User Dummy

- Siswa: NIS `12345`, password `password123` (email `12345@simu.local`)
- Admin: email `admin@simu.local`, password `admin1234`
- Admin tambahan dapat dibuat dari aplikasi lewat menu **Data Guru** (perlu SQL `10-fase8-guru.sql`).

## Deploy ke Netlify

1. Buka https://app.netlify.com/drop
2. Tarik folder `simu-web` ke halaman tersebut
3. Selesai. Link URL diberikan otomatis.

## Lisensi

Proyek sekolah / internal. Tidak untuk dijual.