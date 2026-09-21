-- ============================================================
-- sql/15 - Fase 13: Ubah kredensial login siswa (admin)
-- Fitur: admin mengubah NIS/username login, email, dan/atau
-- password akun siswa dari halaman Data Siswa.
--
-- Model login siswa:
--   * Siswa login memakai NIS sebagai username.
--   * Email akun autentikasi diutamakan custom (bila diisi),
--     jika tidak => otomatis <NIS>@simu.local.
--   * Login di ui/auth.js menerima NIS maupun email (input
--     yang mengandung @ diperlakukan sebagai email).
-- ============================================================

-- 1) FUNGSI update_siswa_login(uuid, text, text, text)
--    Ubah NIS (username), email, dan/atau password akun siswa.
--    Argumen yang kosong/NULL dianggap "tidak diubah".
--    Wajib admin. Menjaga keunikan NIS & email.
CREATE OR REPLACE FUNCTION public.update_siswa_login(
  p_user_id uuid,
  p_nis text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_password text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_old_nis text;
  v_old_email text;
  v_new_nis text;
  v_new_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengubah data login.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ID user tidak valid.';
  END IF;

  -- Target harus akun siswa yang ada
  SELECT u.nis, u.email
    INTO v_old_nis, v_old_email
    FROM public.users u
   WHERE u.id = p_user_id;
  IF v_old_nis IS NULL THEN
    RAISE EXCEPTION 'Siswa tidak ditemukan.';
  END IF;

  -- NIS baru (kosong = biarkan tetap)
  v_new_nis := lower(trim(COALESCE(p_nis, '')));
  IF v_new_nis = '' THEN
    v_new_nis := v_old_nis;
  END IF;

  -- Email baru (kosong = otomatis dari NIS)
  v_new_email := lower(trim(COALESCE(p_email, '')));
  IF v_new_email = '' THEN
    v_new_email := v_new_nis || '@simu.local';
  ELSIF position('@' in v_new_email) = 0 THEN
    RAISE EXCEPTION 'Format email tidak valid.';
  END IF;

  -- Tidak ada perubahan
  IF v_new_nis = v_old_nis
     AND v_new_email = v_old_email
     AND COALESCE(p_password, '') = '' THEN
    RAISE EXCEPTION 'Tidak ada perubahan data.';
  END IF;

  -- Keunikan NIS (username) antar siswa
  IF v_new_nis <> v_old_nis
     AND EXISTS (SELECT 1 FROM public.users
                  WHERE nis = v_new_nis AND id <> p_user_id) THEN
    RAISE EXCEPTION 'NIS % sudah dipakai siswa lain.', v_new_nis;
  END IF;

  -- Keunikan email akun autentikasi
  IF v_new_email <> v_old_email
     AND EXISTS (SELECT 1 FROM auth.users
                  WHERE email = v_new_email AND id <> p_user_id) THEN
    RAISE EXCEPTION 'Email % sudah dipakai akun lain.', v_new_email;
  END IF;

  -- Update akun auth (email + NIS metadata + opsional password)
  UPDATE auth.users SET
    email = v_new_email,
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{nis}',
      to_jsonb(v_new_nis)
    ),
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

  -- Update profil public.users (NIS + email tampil di Data Siswa)
  UPDATE public.users SET
    nis = v_new_nis,
    email = v_new_email
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_siswa_login(uuid, text, text, text) TO authenticated;

-- 2) Paksa PostgREST membaca ulang schema
SELECT pg_notify('pgrst', 'reload schema');