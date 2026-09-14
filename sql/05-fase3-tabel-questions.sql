-- ============================================================
-- FASE 3 - TABEL QUESTIONS (bank soal) + RLS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  pertanyaan text NOT NULL,
  pilihan_a text NOT NULL,
  pilihan_b text NOT NULL,
  pilihan_c text NOT NULL,
  pilihan_d text NOT NULL,
  jawaban_benar text NOT NULL CHECK (jawaban_benar IN ('a', 'b', 'c', 'd')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Siswa boleh membaca soal (untuk mengerjakan ujian nanti).
-- Admin saja yang boleh menulis/mengubah/menghapus.
CREATE POLICY "questions_read_all_authenticated" ON public.questions
  FOR SELECT TO authenticated USING (true);

-- Fungsi bantu: apakah user saat ini admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Admin boleh insert
CREATE POLICY "questions_insert_admin" ON public.questions
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- Admin boleh update
CREATE POLICY "questions_update_admin" ON public.questions
  FOR UPDATE TO authenticated USING (public.is_admin());

-- Admin boleh delete
CREATE POLICY "questions_delete_admin" ON public.questions
  FOR DELETE TO authenticated USING (public.is_admin());