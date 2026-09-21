-- ============================================================
-- FASE 10 - KUNCI UJIAN "HANYA SEKALI"  (sudah submit => terkunci)
--
-- CARA PAKAI:
--   1. Buka Supabase (dashboard proyek simu)
--   2. Masuk ke menu SQL Editor
--   3. TEMPEL semua baris dari file ini, lalu klik RUN
--   4. Harus muncul tulisan "Success. No rows returned"
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) CABUT izin siswa untuk mengubah submission-nya sendiri.
--    Dulu policy "submissions_update_own" dibuka agar siswa bisa
--    submit. Akibatnya siswa bisa submit berkali-kali & menimpa
--    jawaban. Sekarang DICABUT:
--      * Submit pertama = INSERT  => tetap boleh (submissions_insert_own)
--      * Submit ulang   = UPDATE  => DITOLAK Supabase
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "submissions_update_own" ON public.submissions;

-- ────────────────────────────────────────────────────────────
-- 2) Pastikan ADMIN/GURU tetap bisa mengubah submission untuk
--    penilaian esai (sudah dibuat di fase 9). Kalau belum ada,
--    jalankan CREATE-nya ulang (aman, tidak dobel):
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'submissions'
      AND policyname = 'submissions_update_admin'
  ) THEN
    EXECUTE 'CREATE POLICY "submissions_update_admin" ON public.submissions
             FOR UPDATE TO authenticated USING (public.is_admin())';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3) Verifikasi: harus TIDAK ada lagi baris "update_own".
--    Jalankan query di bawah di SQL Editor setelah RUN:
--
--    SELECT policyname, cmd, roles
--    FROM pg_policies
--    WHERE schemaname='public' AND tablename='submissions'
--    ORDER BY policyname;
--
--    Hasil yang benar:
--      submissions_insert_own        INSERT  {authenticated}
--      submissions_read_own          SELECT  {authenticated}
--      submissions_read_all_admin    SELECT  {authenticated}
--      submissions_update_admin      UPDATE  {authenticated}
-- ────────────────────────────────────────────────────────────
