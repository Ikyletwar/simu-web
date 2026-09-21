-- ============================================================
-- FASE 8 - KELOLA GURU (akun admin) + RPC
-- ============================================================
-- Admin/guru adalah akun berperan 'admin'. Karena buat akun auth
-- hanya bisa via service role, disediakan fungsi SECURITY DEFINER
-- supaya admin (yang sudah login) bisa:
--   1. Menambah guru   -> create_guru(jsonb)
--   2. Reset password  -> reset_guru_password(uuid, text)
--   3. Menghapus guru  -> delete_guru(uuid)
--
-- Dipanggil dari: kelola-guru.html (menu "Data Guru")
-- Contoh payload create_guru:
--   {"email":"guru1@simu.local","password":"rahasia123","nama":"Pak Budi","subject_id":"<uuid mapel>"}
-- ============================================================

-- Kolom mapel yang diampu (opsional) untuk admin/guru
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

-- Buat akun guru (role admin)
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

-- Reset password guru
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

-- Hapus guru
CREATE OR REPLACE FUNCTION public.delete_guru(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menghapus guru.';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'ID user tidak valid.'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Tidak dapat menghapus akun sendiri.'; END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- Izinkan authenticated memanggil
GRANT EXECUTE ON FUNCTION public.create_guru(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_guru_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_guru(uuid) TO authenticated;