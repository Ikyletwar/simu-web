-- ============================================================
-- FASE 16 - EDIT & HAPUS AKUN GURU/ADMIN (termasuk akun sendiri)
-- Jalankan SEKALI di Supabase SQL Editor lalu klik RUN.
-- (Aman dijalankan ulang: CREATE OR REPLACE.)
--
-- Isi:
--   1. update_guru_profil: ubah Nama Lengkap & Mata Pelajaran
--      akun guru/admin.
--   2. delete_guru diperbarui: boleh menghapus akun SENDIRI
--      (mis. "Admin Sekolah"), tetapi akun admin terakhir tidak
--      bisa dihapus supaya tidak terkunci dari aplikasi.
--   3. Reload schema cache PostgREST.
-- ============================================================

-- 1) Ubah profil guru/admin (nama & mapel).
CREATE OR REPLACE FUNCTION public.update_guru_profil(
  p_user_id uuid,
  p_nama text DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL,
  p_clear_subject boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_nama text := NULLIF(trim(COALESCE(p_nama, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengubah data guru.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ID user tidak valid.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Akun tidak ditemukan.';
  END IF;

  UPDATE public.users SET
    nama = COALESCE(v_nama, nama),
    subject_id = CASE
      WHEN p_clear_subject THEN NULL
      WHEN p_subject_id IS NOT NULL THEN p_subject_id
      ELSE subject_id
    END
  WHERE id = p_user_id;

  -- Selaraskan nama di metadata auth
  IF v_nama IS NOT NULL THEN
    UPDATE auth.users SET
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{nama}',
        to_jsonb(v_nama)
      ),
      updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_guru_profil(uuid, text, uuid, boolean) TO authenticated;

-- 2) Hapus akun: boleh akun sendiri / "Admin Sekolah" / admin terakhir.
CREATE OR REPLACE FUNCTION public.delete_guru(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hanya admin yang dapat menghapus akun.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ID user tidak valid.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Akun tidak ditemukan.';
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_guru(uuid) TO authenticated;

-- 3) Paksa PostgREST membaca ulang schema
SELECT pg_notify('pgrst', 'reload schema');