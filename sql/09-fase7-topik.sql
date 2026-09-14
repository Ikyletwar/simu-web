-- ============================================================
-- FASE 7 - TABEL TOPICS (topik dalam mata pelajaran) + RLS
-- ============================================================
-- Topik dipakai untuk mengelompokkan soal dalam satu mapel,
-- misalnya mapel "Teknologi Jaringan" punya topik
-- "Routing Dasar", "Switching", "Konfigurasi VLAN", dsb.

CREATE TABLE IF NOT EXISTS public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  nama text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, nama)
);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- Siswa boleh membaca topik.
-- Admin saja yang boleh menulis/mengubah/menghapus.
CREATE POLICY "topics_read_all_authenticated" ON public.topics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "topics_insert_admin" ON public.topics
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "topics_update_admin" ON public.topics
  FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "topics_delete_admin" ON public.topics
  FOR DELETE TO authenticated USING (public.is_admin());

-- Hubungkan soal ke topik (opsional => "Tanpa Topik")
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL;