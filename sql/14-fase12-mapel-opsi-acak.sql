-- ============================================================
-- FASE 12 - CRUD MATA PELAJARAN + OPSI A-F + ACak SOAL (gabungan 1-paste)
-- Jalankan SEKALI di Supabase SQL Editor lalu klik RUN.
-- (File ini aman untuk dijalankan berulang: semua memakai IF NOT EXISTS /
--   DO BLOCK, jadi kalaupun sudah pernah dijalankan tidak akan error.)
--
-- Isi file ini:
--   1. RLS subjects: admin boleh INSERT/UPDATE/DELETE
--      (sebelumnya semua user hanya boleh baca)
--   2. Kolom opsi lanjutan di questions: pilihan_e, pilihan_f
--      (soal PG maksimal 6 pilihan A-F; A-D tetap wajib, E/F opsional)
--   3. Kolom exams.acak_soal (boolean, default true = urutan soal diacak
--      per siswa; admin bisa matikan per ujian lewat form Kelola Ujian)
--   4. Reload schema cache PostgREST
-- ============================================================

-- 1) RLS: admin dapat menambah / mengubah / menghapus mata pelajaran.
--    (menghapus mapel ikut menghapus topik, soal, ujian & jawabannya karena CASCADE)
--    PostgreSQL tidak mendukung "CREATE POLICY IF NOT EXISTS", jadi dibungkus
--    DO block yang memeriksa pg_policies dulu supaya file aman di-run ulang.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'subjects_insert_admin'
  ) THEN
    CREATE POLICY "subjects_insert_admin" ON public.subjects
      FOR INSERT TO authenticated WITH CHECK (public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'subjects_update_admin'
  ) THEN
    CREATE POLICY "subjects_update_admin" ON public.subjects
      FOR UPDATE TO authenticated USING (public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'subjects_delete_admin'
  ) THEN
    CREATE POLICY "subjects_delete_admin" ON public.subjects
      FOR DELETE TO authenticated USING (public.is_admin());
  END IF;
END $$;

-- 2) Opsi jawaban A-F. Kolom boleh NULL; soal tetap valid selama pilihan A-D
--    terisi dan kunci jawaban tidak menunjuk ke kolom kosong.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS pilihan_e text,
  ADD COLUMN IF NOT EXISTS pilihan_f text;

-- 3) Acak urutan soal per ujian (default true = perilaku lama).
--    Baris ujian yang sudah ada otomatis bernilai true.
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS acak_soal boolean NOT NULL DEFAULT true;

-- 4) Paksa PostgREST membaca ulang schema supaya kolom/policy langsung dikenali
SELECT pg_notify('pgrst', 'reload schema');