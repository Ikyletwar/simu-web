-- ============================================================
-- FASE 17 - ROLE 'GURU' + PEMBATASAN AKSES PER MATA PELAJARAN
-- Jalankan SEKALI di Supabase SQL Editor lalu klik RUN.
-- (Aman dijalankan ulang: CREATE OR REPLACE / DROP POLICY IF EXISTS /
--  DO BLOCK, jadi tidak error kalau sudah pernah dijalankan.)
--
-- Konsep:
--   * role 'admin' = admin penuh (super admin). Akses semua mapel,
--     kelola akun guru, backup, dll.
--   * role 'guru'  = guru mapel. WAJIB punya subject_id. Hanya bisa
--     melihat & mengelola data mapel yang diampu (soal, topik, ujian,
--     jawaban/nilai), plus melihat data siswa (read-only).
--
-- Isi file:
--   1. Fungsi bantu: is_guru(), is_siswa(), guru_subject_id(), is_staff().
--   2. Migrasi: akun role 'admin' yang sudah punya mapel => role 'guru'.
--   3. CHECK: role 'guru' wajib punya subject_id.
--   4. handle_new_user: ikut menulis subject_id dari metadata.
--   5. create_guru: membuat akun role 'guru' + mapel wajib.
--   6. update_guru_profil: bisa ganti role & mapel (mapel wajib utk guru).
--   7. RLS per mapel: questions, topics, exams, exam_questions,
--      submissions, users (guru hanya baca siswa).
--   8. Reload schema cache PostgREST.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Fungsi bantu
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_guru()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'guru'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_siswa()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'siswa'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'guru')
  );
$$;

-- Mapel yang diampu user guru yang sedang login (NULL untuk admin/siswa).
CREATE OR REPLACE FUNCTION public.guru_subject_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT subject_id FROM public.users
   WHERE id = auth.uid() AND role = 'guru'
   LIMIT 1;
$$;

-- ------------------------------------------------------------
-- 2) Migrasi akun lama: admin yang sudah punya mapel => guru
-- ------------------------------------------------------------
UPDATE public.users
   SET role = 'guru'
 WHERE role = 'admin' AND subject_id IS NOT NULL;

-- ------------------------------------------------------------
-- 3) Wajibkan mapel untuk role 'guru'
-- ------------------------------------------------------------
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS guru_wajib_mapel;
ALTER TABLE public.users
  ADD CONSTRAINT guru_wajib_mapel CHECK (role <> 'guru' OR subject_id IS NOT NULL);

-- ------------------------------------------------------------
-- 4) handle_new_user: sertakan subject_id dari metadata
--    (supaya insert role 'guru' langsung punya mapel & lolos CHECK)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, nama, nis, email, role, class_id, major_id, subject_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nama', ''),
    COALESCE(new.raw_user_meta_data->>'nis', NULL),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'siswa'),
    NULL,
    NULL,
    NULLIF(new.raw_user_meta_data->>'subject_id', '')::uuid
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 5) create_guru: akun role 'guru' + mapel WAJIB
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_guru(p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_email text := lower(trim(COALESCE(p_data->>'email', '')));
  v_password text := COALESCE(p_data->>'password', '');
  v_nama text := COALESCE(p_data->>'nama', '');
  v_subject_id uuid := NULLIF(p_data->>'subject_id', '')::uuid;
  v_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menambah guru.';
  END IF;

  IF v_email = '' THEN RAISE EXCEPTION 'Email atau username wajib diisi.'; END IF;
  IF position('@' in v_email) = 0 THEN
    v_email := v_email || '@simu.local';
  END IF;

  IF length(v_password) < 6 THEN RAISE EXCEPTION 'Password minimal 6 karakter.'; END IF;
  IF v_nama = '' THEN RAISE EXCEPTION 'Nama wajib diisi.'; END IF;
  IF v_subject_id IS NULL THEN
    RAISE EXCEPTION 'Mata pelajaran yang diampu wajib dipilih.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = v_subject_id) THEN
    RAISE EXCEPTION 'Mata pelajaran tidak ditemukan.';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'Email sudah terdaftar.';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, aud, role,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('nama', v_nama, 'role', 'guru', 'subject_id', v_subject_id::text),
    '', '', '', ''
  )
  RETURNING id INTO v_user_id;

  UPDATE public.users
     SET subject_id = v_subject_id, role = 'guru'
   WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_guru(jsonb) TO authenticated;

-- ------------------------------------------------------------
-- 6) update_guru_profil: ganti nama, mapel, dan/atau role
--    p_role: 'admin' (penuh) atau 'guru' (per mapel). NULL = tetap.
--    Untuk role 'guru', mapel wajib. Admin terakhir tidak bisa jadi guru.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_guru_profil(uuid, text, uuid, boolean);
CREATE OR REPLACE FUNCTION public.update_guru_profil(
  p_user_id uuid,
  p_nama text DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL,
  p_clear_subject boolean DEFAULT false,
  p_role text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_nama text := NULLIF(trim(COALESCE(p_nama, '')), '');
  v_role_lama text;
  v_role text;
  v_subject uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengubah data guru.';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'ID user tidak valid.'; END IF;

  SELECT role, subject_id INTO v_role_lama, v_subject
    FROM public.users WHERE id = p_user_id;
  IF v_role_lama IS NULL THEN RAISE EXCEPTION 'Akun tidak ditemukan.'; END IF;

  v_role := COALESCE(NULLIF(trim(COALESCE(p_role, '')), ''), v_role_lama);
  IF v_role NOT IN ('admin', 'guru') THEN
    RAISE EXCEPTION 'Peran harus admin atau guru.';
  END IF;

  -- Tentukan mapel baru
  IF p_clear_subject THEN
    v_subject := NULL;
  ELSIF p_subject_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = p_subject_id) THEN
      RAISE EXCEPTION 'Mata pelajaran tidak ditemukan.';
    END IF;
    v_subject := p_subject_id;
  END IF;

  IF v_role = 'guru' AND v_subject IS NULL THEN
    RAISE EXCEPTION 'Guru wajib punya mata pelajaran yang diampu.';
  END IF;

  -- Jangan sampai aplikasi kehilangan seluruh admin penuh
  IF v_role_lama = 'admin' AND v_role = 'guru'
     AND NOT EXISTS (SELECT 1 FROM public.users WHERE role = 'admin' AND id <> p_user_id) THEN
    RAISE EXCEPTION 'Ini satu-satunya akun admin penuh. Buat admin lain dulu sebelum diubah.';
  END IF;

  UPDATE public.users SET
    nama = COALESCE(v_nama, nama),
    subject_id = v_subject,
    role = v_role
  WHERE id = p_user_id;

  UPDATE auth.users SET
    raw_user_meta_data = jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', to_jsonb(v_role)),
        '{nama}', to_jsonb(COALESCE(v_nama, COALESCE(raw_user_meta_data->>'nama', '')))
      ),
      '{subject_id}', to_jsonb(COALESCE(v_subject::text, ''))
    ),
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_guru_profil(uuid, text, uuid, boolean, text) TO authenticated;

-- ------------------------------------------------------------
-- 7) RLS per mata pelajaran
-- ------------------------------------------------------------

-- ===== QUESTIONS =====
-- Baca: admin (semua), guru (mapelnya), siswa (soal dari ujian published)
DROP POLICY IF EXISTS "questions_read_all_authenticated" ON public.questions;
DROP POLICY IF EXISTS "questions_read_admin" ON public.questions;
DROP POLICY IF EXISTS "questions_read_guru_subject" ON public.questions;
DROP POLICY IF EXISTS "questions_read_siswa_exam" ON public.questions;

CREATE POLICY "questions_read_admin" ON public.questions
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "questions_read_guru_subject" ON public.questions
  FOR SELECT TO authenticated
  USING (public.is_guru() AND subject_id = public.guru_subject_id());

CREATE POLICY "questions_read_siswa_exam" ON public.questions
  FOR SELECT TO authenticated
  USING (
    public.is_siswa() AND EXISTS (
      SELECT 1 FROM public.exam_questions eq
      JOIN public.exams e ON e.id = eq.exam_id
      WHERE eq.question_id = questions.id AND e.is_published
    )
  );

-- Tulis: guru hanya di mapelnya
DROP POLICY IF EXISTS "questions_insert_guru" ON public.questions;
DROP POLICY IF EXISTS "questions_update_guru" ON public.questions;
DROP POLICY IF EXISTS "questions_delete_guru" ON public.questions;

CREATE POLICY "questions_insert_guru" ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_guru() AND subject_id = public.guru_subject_id());

CREATE POLICY "questions_update_guru" ON public.questions
  FOR UPDATE TO authenticated
  USING (public.is_guru() AND subject_id = public.guru_subject_id())
  WITH CHECK (public.is_guru() AND subject_id = public.guru_subject_id());

CREATE POLICY "questions_delete_guru" ON public.questions
  FOR DELETE TO authenticated
  USING (public.is_guru() AND subject_id = public.guru_subject_id());

-- ===== TOPICS =====
DROP POLICY IF EXISTS "topics_read_all_authenticated" ON public.topics;
DROP POLICY IF EXISTS "topics_read_admin" ON public.topics;
DROP POLICY IF EXISTS "topics_read_guru_subject" ON public.topics;
DROP POLICY IF EXISTS "topics_insert_guru" ON public.topics;
DROP POLICY IF EXISTS "topics_update_guru" ON public.topics;
DROP POLICY IF EXISTS "topics_delete_guru" ON public.topics;

CREATE POLICY "topics_read_admin" ON public.topics
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "topics_read_guru_subject" ON public.topics
  FOR SELECT TO authenticated
  USING (public.is_guru() AND subject_id = public.guru_subject_id());

CREATE POLICY "topics_insert_guru" ON public.topics
  FOR INSERT TO authenticated
  WITH CHECK (public.is_guru() AND subject_id = public.guru_subject_id());

CREATE POLICY "topics_update_guru" ON public.topics
  FOR UPDATE TO authenticated
  USING (public.is_guru() AND subject_id = public.guru_subject_id())
  WITH CHECK (public.is_guru() AND subject_id = public.guru_subject_id());

CREATE POLICY "topics_delete_guru" ON public.topics
  FOR DELETE TO authenticated
  USING (public.is_guru() AND subject_id = public.guru_subject_id());

-- ===== EXAMS =====
-- Baca: admin (semua), guru (mapelnya), siswa (yang published)
DROP POLICY IF EXISTS "exams_read_published" ON public.exams;
DROP POLICY IF EXISTS "exams_read_admin" ON public.exams;
DROP POLICY IF EXISTS "exams_read_guru_subject" ON public.exams;
DROP POLICY IF EXISTS "exams_read_siswa_published" ON public.exams;
DROP POLICY IF EXISTS "exams_insert_guru" ON public.exams;
DROP POLICY IF EXISTS "exams_update_guru" ON public.exams;
DROP POLICY IF EXISTS "exams_delete_guru" ON public.exams;

CREATE POLICY "exams_read_admin" ON public.exams
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "exams_read_guru_subject" ON public.exams
  FOR SELECT TO authenticated
  USING (public.is_guru() AND subject_id = public.guru_subject_id());

CREATE POLICY "exams_read_siswa_published" ON public.exams
  FOR SELECT TO authenticated
  USING (public.is_siswa() AND is_published = true);

CREATE POLICY "exams_insert_guru" ON public.exams
  FOR INSERT TO authenticated
  WITH CHECK (public.is_guru() AND subject_id = public.guru_subject_id());

CREATE POLICY "exams_update_guru" ON public.exams
  FOR UPDATE TO authenticated
  USING (public.is_guru() AND subject_id = public.guru_subject_id())
  WITH CHECK (public.is_guru() AND subject_id = public.guru_subject_id());

CREATE POLICY "exams_delete_guru" ON public.exams
  FOR DELETE TO authenticated
  USING (public.is_guru() AND subject_id = public.guru_subject_id());

-- ===== EXAM_QUESTIONS =====
DROP POLICY IF EXISTS "exam_questions_insert_guru" ON public.exam_questions;
DROP POLICY IF EXISTS "exam_questions_delete_guru" ON public.exam_questions;

CREATE POLICY "exam_questions_insert_guru" ON public.exam_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_guru() AND EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id AND e.subject_id = public.guru_subject_id()
    )
  );

CREATE POLICY "exam_questions_delete_guru" ON public.exam_questions
  FOR DELETE TO authenticated
  USING (
    public.is_guru() AND EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id AND e.subject_id = public.guru_subject_id()
    )
  );

-- ===== SUBMISSIONS =====
DROP POLICY IF EXISTS "submissions_read_guru_subject" ON public.submissions;
DROP POLICY IF EXISTS "submissions_update_guru" ON public.submissions;

CREATE POLICY "submissions_read_guru_subject" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    public.is_guru() AND EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = submissions.exam_id AND e.subject_id = public.guru_subject_id()
    )
  );

CREATE POLICY "submissions_update_guru" ON public.submissions
  FOR UPDATE TO authenticated
  USING (
    public.is_guru() AND EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = submissions.exam_id AND e.subject_id = public.guru_subject_id()
    )
  )
  WITH CHECK (
    public.is_guru() AND EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = submissions.exam_id AND e.subject_id = public.guru_subject_id()
    )
  );

-- ===== USERS =====
-- Guru boleh membaca data siswa (untuk laporan) + dirinya sendiri.
DROP POLICY IF EXISTS "users_select_guru_siswa" ON public.users;

CREATE POLICY "users_select_guru_siswa" ON public.users
  FOR SELECT TO authenticated
  USING (public.is_guru() AND role = 'siswa');

-- ------------------------------------------------------------
-- 8) Reload schema cache PostgREST
-- ------------------------------------------------------------
SELECT pg_notify('pgrst', 'reload schema');
