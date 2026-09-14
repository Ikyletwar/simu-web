-- ============================================================
-- FASE 2 - MEMBUAT USER DUMMY UNTUK TEST
-- ============================================================
-- CARA:
-- 1. Buka Supabase Dashboard > Authentication > Users > "Add user"
-- 2. Buat 2 akun:
--    a. Akun SISWA:
--       Email    : 12345@simu.local
--       Password : password123
--       (auto-confirm: centang "Auto Confirm User")
--    b. Akun ADMIN:
--       Email    : admin@simu.local
--       Password : admin1234
--       (auto-confirm: centang "Auto Confirm User")
-- 3. Setelah kedua akun dibuat, jalankan SQL di bawah ini
--    untuk mengisi profil (nama, nis, role, kelas, jurusan).
-- ============================================================

-- Set profil siswa dummy (ganti NIS/nama sesuai kebutuhan)
UPDATE public.users
SET
  nama = 'Budi Santoso',
  nis = '12345',
  role = 'siswa',
  class_id = (SELECT id FROM public.classes WHERE nama = 'XI TJKT'),
  major_id = (SELECT id FROM public.majors WHERE kode = 'TJKT')
WHERE email = '12345@simu.local';

-- Set profil admin dummy
UPDATE public.users
SET
  nama = 'Admin Sekolah',
  role = 'admin',
  major_id = NULL,
  class_id = NULL
WHERE email = 'admin@simu.local';

-- Cek hasil
SELECT id, nama, nis, email, role, class_id, major_id FROM public.users;