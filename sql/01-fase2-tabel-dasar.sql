-- ============================================================
-- SIMU Database Schema
-- Jalankan file SQL ini di Supabase SQL Editor (urutan paling atas)
-- ============================================================

-- ============================================================
-- FASE 2 - TABEL DASAR (majors, classes, subjects, users)
-- ============================================================

-- TABEL majors (jurusan)
CREATE TABLE IF NOT EXISTS public.majors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  kode text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TABEL classes (kelas)
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  tingkat text NOT NULL,
  major_id uuid REFERENCES public.majors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TABEL subjects (mata pelajaran)
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  kode text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TABEL users (profil user = auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama text NOT NULL,
  nis text UNIQUE,
  email text UNIQUE,
  role text NOT NULL DEFAULT 'siswa' CHECK (role IN ('siswa', 'admin')),
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  major_id uuid REFERENCES public.majors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- AKTIFKAN RLS (Row Level Security)
-- ============================================================
ALTER TABLE public.majors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy dasar: semua user yang login (authenticated) bisa baca majors
CREATE POLICY "authenticated_read_majors" ON public.majors
  FOR SELECT TO authenticated USING (true);

-- Policy dasar: semua user yang login bisa baca classes
CREATE POLICY "authenticated_read_classes" ON public.classes
  FOR SELECT TO authenticated USING (true);

-- Policy dasar: semua user yang login bisa baca subjects
CREATE POLICY "authenticated_read_subjects" ON public.subjects
  FOR SELECT TO authenticated USING (true);

-- Policy users: user bisa baca profilnya sendiri
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- Policy users: admin bisa baca semua user
-- (dicek lewat meta data, dibuka lebih lebar di langkah berikutnya)