# Changelog Peningkatan SIMU

Tanggal: 4 November 2026
Backup sebelum perubahan: `../simu-web-pre-enhance-2026-11-03-192738/`

## 1. Anti-Curang & UI Ujian

### `ujian.html`
- Header ujian baru:
  - status penyimpanan jawaban (titik + teks "Tersimpan HH:MM"),
  - penghitung pelanggaran (`0/3`),
  - timer dengan ikon dan warna peringatan.
- Progress bar sticky di bawah header.
- Toolbar progres: jumlah soal terjawab dan posisi soal.
- Banner pengingat layar penuh dengan tombol "Kembali Layar Penuh".
- Modal peringatan pelanggaran dengan meter 0–3.
- Subjudul ujian: durasi + mode aman.

### `js/ujian.js`
- `attemptFullscreen()` dipakai ulang; banner fullscreen muncul saat mode layar penuh keluar.
- Deteksi DevTools (selisih viewport) tiap 1,2 detik — tercatat sebagai pelanggaran `devtools`.
- Blokir copy, cut, paste, drag, drop, dan seleksi teks (textarea/input tetap bisa diedit).
- Blokir F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S, Ctrl+P, dan PrintScreen.
- Blokir dialog print (`beforeprint`).
- Jenis pelanggaran kini `tab`, `fullscreen`, `devtools`, dengan label yang jelas.
- `updateIntegrityUI()` dan `setSaveStatus()` menjaga header selalu sinkron.
- Submit gagal tidak lagi mengunci halaman: timer + autosave dinyalakan ulang, siswa bisa coba lagi.
- `_submitted` baru diset setelah upsert sukses.

### `css/ujian.css`
- Styling untuk header, progress bar, status simpan, badge pelanggaran, banner fullscreen,
  toolbar, modal pelanggaran, state fokus/terpilih opsi, peta soal berwarna, dan responsif.

## 2. UI Guru/Admin

### `dashboard-admin.html`
- Header halaman (`.page-head`) dengan tombol "Buat Soal" dan "Buat Ujian".
- Avatar inisial + label role pada topbar.
- Statistik berwarna (primary/warning/success/info).
- Panel "Aksi Cepat" berisi 4 kartu navigasi.
- Panel "Alur Kerja Singkat" (3 langkah).
- Empty state dengan tombol aksi untuk ujian/soal kosong.
- Label statistik untuk guru: "Soal Mapel Anda" / "Ujian Mapel Anda" (sesuai batas RLS).
- Snackbar error statistik hanya muncul sekali.

### `js/auth.js`
- `updateShellUser(profile)` mengisi `#userRole` dan `#userAvatar` di semua halaman yang
  memakai `guard()`, sehingga topbar konsisten tanpa mengubah JS tiap halaman.

### `css/dashboard.css`
- Komponen baru: `.page-head`, `.page-eyebrow`, `.page-head-actions`, `.user-meta`,
  `.user-role`, `.quick-*`, `.guide-*`, `.empty-inline`, varian `.stat-icon-warning/info`,
  hover card, dan responsif.

### Halaman lain
- Topbar seragam (avatar + role) di: `backup.html`, `form-soal.html`, `kelola-guru.html`,
  `kelola-siswa.html`, `kelola-soal.html`, `kelola-ujian.html`, `koreksi-esai.html`,
  `laporan.html`, `ranking.html`.

## 3. Dokumentasi
- `README.md`: bullet anti-curang diperbarui + bagian "Peningkatan UI & Anti-Curang".
- File ini (`ENHANCEMENTS.md`).

## 4. Batasan yang Diketahui
Perubahan ini **tidak** menutup celah berikut (butuh fase server-side):
1. `jawaban_benar` masih dikirim ke browser siswa.
2. Nilai dihitung di klien dan diterima server apa adanya.
3. Metadata anti-curang berasal dari klien.
4. Draft `localStorage` bisa diedit.
5. Ujian bisa dibuka di luar UI normal (console/iframe).

Rencana penutupan (belum dikerjakan): RPC `submit_exam` dengan `SECURITY DEFINER`,
scoring di server, view soal tanpa kolom kunci, dan pencabutan akses kolom `jawaban_benar`.

## 5. Cara Verifikasi Cepat
```bash
node --check js/ujian.js
node --check js/auth.js
python3 -m http.server 8080
# buka http://localhost:8080
```
