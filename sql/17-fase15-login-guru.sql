-- ============================================================
-- FASE 15 - LOGIN GURU/ADMIN MEMAKAI EMAIL ATAU USERNAME
-- Jalankan SEKALI di Supabase SQL Editor lalu klik RUN.
-- (Aman dijalankan ulang: semua pakai CREATE OR REPLACE.)
--
-- Isi:
--   1. create_guru diubah: kolom login boleh diisi email ATAU
--      username. Bila tidak mengandung @, otomatis dibentuk
--      "username@simu.local" (sama polanya dengan siswa NIS).
--   2. RPC baru update_guru_login: admin mengubah email/username
--      dan/atau password akun guru/admin (tidak hanya password).
--   3. Reload schema cache PostgREST.
-- ============================================================

-- 1) create_guru: dukung login memakai username (tanpa @).
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

  -- Bila diisi username (tanpa @), jadikan email <username>@simu.local
  -- supaya tetap bisa masuk lewat Supabase Auth (login memakai email).
  IF position('@' in v_email) = 0 THEN
    v_email := v_email || '@simu.local';
  END IF;

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

-- 2) update_guru_login: ubah email/username dan/atau password akun
--    guru/admin. Argumen kosong/NULL = tidak diubah. Wajib admin,
--    boleh untuk akun sendiri juga.
CREATE OR REPLACE FUNCTION public.update_guru_login(
  p_user_id uuid,
  p_email text DEFAULT NULL,
  p_password text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_old_email text;
  v_new_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengubah data login.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ID user tidak valid.';
  END IF;

  SELECT u.email INTO v_old_email
    FROM public.users u
   WHERE u.id = p_user_id;
  IF v_old_email IS NULL THEN
    RAISE EXCEPTION 'Akun tidak ditemukan.';
  END IF;

  -- Email/username baru (kosong = biarkan tetap)
  v_new_email := lower(trim(COALESCE(p_email, '')));
  IF v_new_email = '' THEN
    v_new_email := v_old_email;
  ELSIF position('@' in v_new_email) = 0 THEN
    v_new_email := v_new_email || '@simu.local';
  END IF;

  -- Tidak ada perubahan
  IF v_new_email = v_old_email AND COALESCE(p_password, '') = '' THEN
    RAISE EXCEPTION 'Tidak ada perubahan data.';
  END IF;

  -- Keunikan email akun autentikasi
  IF v_new_email <> v_old_email
     AND EXISTS (SELECT 1 FROM auth.users
                  WHERE email = v_new_email AND id <> p_user_id) THEN
    RAISE EXCEPTION 'Email % sudah dipakai akun lain.', v_new_email;
  END IF;

  -- Update akun auth (email + opsional password)
  UPDATE auth.users SET
    email = v_new_email,
    email_change = '',
    email_change_token_new = '',
    email_change_token_current = '',
    updated_at = now()
  WHERE id = p_user_id;

  IF COALESCE(p_password, '') <> '' THEN
    IF length(p_password) < 6 THEN
      RAISE EXCEPTION 'Password minimal 6 karakter.';
    END IF;
    UPDATE auth.users SET
      encrypted_password = crypt(p_password, gen_salt('bf')),
      updated_at = now()
    WHERE id = p_user_id;
  END IF;

  -- Update profil public.users
  UPDATE public.users SET
    email = v_new_email
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_guru_login(uuid, text, text) TO authenticated;

-- 3) Paksa PostgREST membaca ulang schema
SELECT pg_notify('pgrst', 'reload schema');