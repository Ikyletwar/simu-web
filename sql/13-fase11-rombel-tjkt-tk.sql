-- ============================================================
-- FASE 11 - ROMBEL TJKT/TK + FUNGSI AKUN SISWA (gabungan 1-paste)
-- Jalankan SEKALI di Supabase SQL Editor lalu klik RUN.
--
-- Isi file ini:
--   1. Menambah kelas rombel: TJKT 1, TJKT 2, TK 1, TK 2 (X/XI/XII)
--   2. Fungsi create_students  (untuk Tambah & Import Siswa)
--   3. Trigger handle_new_user yang AMAN (id eksplisit + ON CONFLICT)
--   4. Fungsi create_guru, reset_guru_password, delete_guru
--      (buat/reset/hapus akun guru & siswa di menu Data Guru / Data Siswa)
--   5. Reload schema cache PostgREST
-- ============================================================

-- 1) Kelas rombel khusus jurusan TJKT (Teknik Jaringan Komputer dan
--    Telekomunikasi) dan TK (Teknik Kimia). Kelas lain tetap tanpa rombel,
--    misal "X AKL", "XI MPLB".
INSERT INTO public.classes (nama, tingkat, major_id)
SELECT k.huruf || ' ' || m.kode || ' ' || r.rombel, k.angka, m.id
FROM (VALUES ('10','X'), ('11','XI'), ('12','XII')) AS k(angka, huruf)
CROSS JOIN (VALUES (1), (2)) AS r(rombel)
CROSS JOIN public.majors m
WHERE m.kode IN ('TJKT', 'TK')
  AND NOT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.nama = k.huruf || ' ' || m.kode || ' ' || r.rombel
  );

-- 2) FUNGSI create_students(jsonb)
--    Membuat akun auth + profil siswa sekaligus (via trigger handle_new_user),
--    lalu mengisi kelas & jurusan berdasarkan NAMA (cocok dengan tabel classes
--    dan majors). Hanya admin yang boleh memanggil.
CREATE OR REPLACE FUNCTION public.create_students(data jsonb)
RETURNS TABLE(email text, sukses boolean, pesan text)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
#variable_conflict use_variable
DECLARE
  rec record;
  email_i text;
  new_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menjalankan fungsi ini.';
  END IF;

  FOR rec IN
    SELECT *
    FROM jsonb_to_recordset(COALESCE(data, '[]'::jsonb)) AS x(
      nis text,
      nama text,
      class_name text,
      major_name text,
      password text
    )
  LOOP
    email_i := lower(trim(COALESCE(rec.nis, ''))) || '@simu.local';

    -- Validasi dasar
    IF COALESCE(rec.nis, '') = '' OR COALESCE(rec.nama, '') = '' OR COALESCE(rec.password, '') = '' THEN
      email := email_i;
      sukses := false;
      pesan := 'NIS, nama, dan password wajib diisi';
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF length(rec.password) < 6 THEN
      email := email_i;
      sukses := false;
      pesan := 'Password minimal 6 karakter';
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE auth.users.email = email_i) THEN
      email := email_i;
      sukses := false;
      pesan := 'NIS sudah terdaftar';
      RETURN NEXT;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        aud,
        role,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
      )
      VALUES (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        email_i,
        crypt(rec.password, gen_salt('bf')),
        now(),
        'authenticated',
        'authenticated',
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('nama', rec.nama, 'nis', rec.nis, 'role', 'siswa'),
        '',
        '',
        '',
        ''
      )
      RETURNING id INTO new_id;

      -- Isi kelas & jurusan berdasarkan nama
      UPDATE public.users u
      SET
        class_id = CASE WHEN COALESCE(rec.class_name, '') = '' THEN NULL
                        ELSE (SELECT c.id FROM public.classes c WHERE c.nama = rec.class_name LIMIT 1) END,
        major_id = CASE WHEN COALESCE(rec.major_name, '') = '' THEN NULL
                        ELSE (SELECT m.id FROM public.majors m
                              WHERE m.nama = rec.major_name OR m.kode = upper(trim(rec.major_name)) LIMIT 1) END
      WHERE u.id = new_id;

      email := email_i;
      sukses := true;
      pesan := 'Berhasil';
      RETURN NEXT;
    EXCEPTION WHEN others THEN
      email := email_i;
      sukses := false;
      pesan := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_students(jsonb) TO authenticated;

-- 3) TRIGGER handle_new_user (dipastikan benar + idempotent).
--    Memakai new.id (bukan auth.uid() yang NULL di dalam trigger),
--    dan ON CONFLICT (id) DO NOTHING supaya aman dijalankan ulang.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, nama, nis, email, role, class_id, major_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nama', ''),
    COALESCE(new.raw_user_meta_data->>'nis', NULL),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'siswa'),
    NULL,
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4) FUNGSI create_guru(jsonb) - buat akun guru (role admin)
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

  IF v_email = '' THEN RAISE EXCEPTION 'Email wajib diisi.'; END IF;
  IF position('@' in v_email) = 0 THEN RAISE EXCEPTION 'Format email tidak valid.'; END IF;
  IF length(v_password) < 6 THEN RAISE EXCEPTION 'Password minimal 6 karakter.'; END IF;
  IF v_nama = '' THEN RAISE EXCEPTION 'Nama wajib diisi.'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'Email sudah terdaftar.';
  END IF;

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    aud,
    role,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
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
    jsonb_build_object('nama', v_nama, 'role', 'admin'),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO v_user_id;

  UPDATE public.users
  SET subject_id = v_subject_id
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_guru(jsonb) TO authenticated;

-- 5) FUNGSI reset_guru_password(uuid, text)
--    Reset password akun mana pun (guru/siswa). Hanya admin.
CREATE OR REPLACE FUNCTION public.reset_guru_password(p_user_id uuid, p_password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mereset password.';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'ID user tidak valid.'; END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN RAISE EXCEPTION 'Password minimal 6 karakter.'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Untuk akun sendiri, gunakan menu Ubah Password.'; END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_guru_password(uuid, text) TO authenticated;

-- 6) FUNGSI delete_guru(uuid)
--    Hapus akun mana pun (guru/siswa). Hanya admin. Profil public.users
--    dan submissions ikut terhapus otomatis (FK CASCADE).
CREATE OR REPLACE FUNCTION public.delete_guru(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menghapus akun.';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'ID user tidak valid.'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Tidak dapat menghapus akun sendiri.'; END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_guru(uuid) TO authenticated;

-- 7) Paksa PostgREST membaca ulang schema supaya fungsi langsung ketemu
--    (menghindari error "Could not find the function ... in the schema cache")
SELECT pg_notify('pgrst', 'reload schema');