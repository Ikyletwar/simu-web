-- ============================================================
-- FASE 6 - IMPORT SISWA MASSAL (RPC function)
-- Menerima array siswa dalam JSON, lalu membuat:
--   1. Akun auth (email semu <nis>@simu.local) dengan password
--   2. Profil di public.users otomatis via trigger handle_new_user
--   3. Mengisi kelas & jurusan berdasarkan nama (dari tabel classes/majors)
-- Hanya admin yang boleh memanggil.
--
-- Dipanggil dari: kelola-siswa.html (tombol Import Siswa)
-- Contoh payload:
-- [
--   {"nis":"12345","nama":"Budi Santoso","class_name":"XI TJKT","major_name":"TJKT","password":"12345"},
--   {"nis":"12346","nama":"Ani Rahma","class_name":"XI AKL","major_name":"AKL","password":"12346"}
-- ]
-- ============================================================

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

-- Izinkan authenticated memanggil
GRANT EXECUTE ON FUNCTION public.create_students(jsonb) TO authenticated;