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
- Soal mendukung **LaTeX/rumus matematika** (merender `$...$`) via KaTeX
- Soal bisa berisi **blok kode** (diapit ` ``` `) yang ditampilkan rapi seperti editor kode
- Mendukung **soal esai/uraian** (dijawab menulis teks, tidak dikoreksi otomatis; guru
  menilai manual di menu Laporan Nilai)
- Ujian bisa diarahkan ke **kelas (X/XI/XII)** dan **jurusan (kode pendek: MPLB, AKL, PMS, ULP, TJKT, TK)**
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
├── ubah-password.html      ubah password (admin & siswa)
├── kelola-soal.html        daftar bank soal (import & export)
├── form-soal.html          form tambah/edit soal
├── kelola-ujian.html       kelola ujian
├── kelola-siswa.html       data siswa (import massal)
  ├── kelola-guru.html       kelola akun admin/guru (menu "Data Guru")
  ├── css/                    file style
├── js/                     file javascript
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

> **PENTING:** jalankan `11-fase9-esai-kelas.sql` sebelum memakai fitur soal esai dan
> dropdown Kelas/Jurusan yang baru. Tanpa file ini, soal esai tidak bisa disimpan
> (kolom `tipe` belum ada) dan guru tidak bisa menyimpan penilaian manual.

File `04-fase2-user-dummy.sql` berisi panduan membuat user dummy untuk test.

> Catatan: supabase URL & key sudah di-hardcode di `js/supabase.js`
> agar siap dipakai di Netlify. File `.env` disediakan sebagai backup/arsip.

## Data Guru (Akun Admin Tambahan)

Menu **Data Guru** dipakai untuk membuat akun admin baru (mis. guru-guru utama per mapel).
Guru yang dibuat otomatis berperan admin: bisa login, menambah/mengelola soal & ujian,
dan melihat laporan. Form membuat akun meminta nama, email login, password (min. 6 karakter),
dan mata pelajaran yang diampu (opsional). Akun yang sedang dipakai tidak bisa dihapus/direset dari menu ini.

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

Baris opsi diawali `A.` - `D.`, kunci di baris `Jawaban: <huruf>`,
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
- Persyaratan: SQL `11-fase9-esai-kelas.sql` harus sudah dijalankan.

## Kelola Ujian: Kelas & Jurusan

Form Kelola Ujian sekarang hanya menampilkan **Kelas X / XI / XII** dan **Jurusan dengan
kode pendek** (MPLB, AKL, PMS, ULP, TJKT, TK) — bukan nama panjang. Keduanya opsional;
kalau keduanya diisi, ujian dikaitkan ke kelas yang cocok (mis. Kelas X + TJKT → "X TJKT").
Daftar soal pilihan per topik kini tampil sebagai **accordion** (klik nama topik untuk
membuka/menutup daftar soalnya, tombol "Pilih semua" tetap bisa dipakai).

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