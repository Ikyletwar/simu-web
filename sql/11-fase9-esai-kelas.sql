-- ============================================================
-- FASE 9 - SOAL ESAI, KELAS SEMUA JURUSAN & PENILAIAN MANUAL
--
-- CARA PAKAI:
--   1. Buka Supabase (dashboard) -> SQL Editor
--   2. Tempel SEMUA baris di bawah ini, lalu klik RUN
--   3. Tunggu tulisan "Success. No rows returned"
-- ============================================================

-- 1) Kolom tipe soal: 'pg' (pilihan ganda) atau 'esai'
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS tipe text NOT NULL DEFAULT 'pg';

-- 2) Pilihan dan kunci jawaban TIDAK wajib lagi
--    (soal esai tidak punya pilihan A-D dan tidak dikoreksi otomatis).
ALTER TABLE public.questions ALTER COLUMN pilihan_a DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN pilihan_b DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN pilihan_c DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN pilihan_d DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN jawaban_benar DROP NOT NULL;

-- Hapus aturan lama yang memaksa kunci harus a/b/c/d.
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_jawaban_benar_check;

-- 3) Kolom nilai esai pada submissions + admin/guru boleh menilai manual.
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS nilai_esai numeric(5,2);

CREATE POLICY "submissions_update_admin" ON public.submissions
  FOR UPDATE TO authenticated USING (public.is_admin());

-- 4) Seed kelas untuk semua jurusan (X, XI, XII x 6 jurusan)
--    Dipakai dropdown Kelas (X/XI/XII) & Jurusan (kode) di Kelola Ujian.
INSERT INTO public.classes (nama, tingkat, major_id)
SELECT k.huruf || ' ' || m.kode, k.angka, m.id
FROM (VALUES ('10', 'X'), ('11', 'XI'), ('12', 'XII')) AS k(angka, huruf)
CROSS JOIN public.majors m
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes c
  WHERE c.tingkat = k.angka AND c.major_id = m.id
);