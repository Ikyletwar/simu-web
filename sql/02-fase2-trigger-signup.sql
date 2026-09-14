-- ============================================================
-- FASE 2 - TRIGGER SIGNUP + FUNGSI BANTU
-- Saat user signup via auth.users, otomatis dibuat di public.users
-- dengan role='siswa' default. Admin dibuat manual lewat SQL.
-- ============================================================

-- Fungsi pembantu: apakah user saat ini admin?
-- (SECURITY DEFINER supaya tidak terjadi recursive RLS saat
--  dipakai di dalam policy tabel users)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Trigger: buat baris di public.users saat ada user baru di auth.users
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
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Policy tambahan untuk users
-- Admin (role='admin') boleh baca semua user
-- ============================================================

-- Drop policy lama dulu (kalau ada)
DROP POLICY IF EXISTS "users_select_all_admin" ON public.users;

CREATE POLICY "users_select_all_admin" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Admin boleh update user (misal set class_id / major_id)
DROP POLICY IF EXISTS "users_update_all_admin" ON public.users;
CREATE POLICY "users_update_all_admin" ON public.users
  FOR UPDATE TO authenticated
  USING (public.is_admin());