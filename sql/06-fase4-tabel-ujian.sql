-- ============================================================
-- FASE 4 - TABEL UJIAN & SUBMISSION + RLS
-- ============================================================

-- TABEL exams
CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judul text NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  major_id uuid REFERENCES public.majors(id) ON DELETE CASCADE,
  durasi_menit integer NOT NULL DEFAULT 60,
  tanggal_mulai timestamptz NOT NULL DEFAULT now(),
  tanggal_selesai timestamptz NOT NULL DEFAULT now(),
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TABEL exam_questions (relasi ujian -> soal, dengan urutan)
CREATE TABLE IF NOT EXISTS public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  urutan integer NOT NULL DEFAULT 0,
  UNIQUE (exam_id, question_id)
);

-- TABEL submissions (lembar jawaban siswa)
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  jawaban jsonb NOT NULL DEFAULT '{}',
  nilai numeric(5,2) NOT NULL DEFAULT 0,
  jumlah_benar integer NOT NULL DEFAULT 0,
  jumlah_salah integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, user_id)
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Siswa bisa lihat ujian yang published
CREATE POLICY "exams_read_published" ON public.exams
  FOR SELECT TO authenticated
  USING (is_published = true OR public.is_admin());

-- Admin bisa kelola ujian
CREATE POLICY "exams_insert_admin" ON public.exams
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "exams_update_admin" ON public.exams
  FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "exams_delete_admin" ON public.exams
  FOR DELETE TO authenticated USING (public.is_admin());

-- exam_questions: siswa yang sedang mengerjakan boleh lihat soal ujian
CREATE POLICY "exam_questions_read_authenticated" ON public.exam_questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "exam_questions_insert_admin" ON public.exam_questions
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "exam_questions_delete_admin" ON public.exam_questions
  FOR DELETE TO authenticated USING (public.is_admin());

-- submissions: siswa bisa insert & baca miliknya sendiri
CREATE POLICY "submissions_insert_own" ON public.submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "submissions_read_own" ON public.submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "submissions_read_all_admin" ON public.submissions
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "submissions_update_own" ON public.submissions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);