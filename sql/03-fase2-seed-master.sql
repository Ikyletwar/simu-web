-- ============================================================
-- FASE 2 - SEED DATA MASTER
-- Jurusan, kelas, dan mata pelajaran
-- ============================================================

-- Seed jurusan (SMK Negeri 1 Maluku Tengah)
INSERT INTO public.majors (nama, kode) VALUES
  ('Teknik Jaringan Komputer dan Telekomunikasi', 'TJKT'),
  ('Teknik Kimia', 'TK'),
  ('Manajemen Perkantoran dan Layanan Bisnis', 'MPLB'),
  ('Akuntansi dan Keuangan Lembaga', 'AKL'),
  ('Pemasaran', 'PMS'),
  ('Usaha Layanan Pariwisata', 'ULP');

-- Seed kelas (contoh, sesuaikan nama kelas)
INSERT INTO public.classes (nama, tingkat, major_id) VALUES
  ('X TJKT', '10', (SELECT id FROM public.majors WHERE kode = 'TJKT')),
  ('XI TJKT', '11', (SELECT id FROM public.majors WHERE kode = 'TJKT')),
  ('XII TJKT', '12', (SELECT id FROM public.majors WHERE kode = 'TJKT')),
  ('X AKL', '10', (SELECT id FROM public.majors WHERE kode = 'AKL')),
  ('XI AKL', '11', (SELECT id FROM public.majors WHERE kode = 'AKL')),
  ('XII AKL', '12', (SELECT id FROM public.majors WHERE kode = 'AKL'));

-- Seed mata pelajaran
INSERT INTO public.subjects (nama, kode) VALUES
  ('Matematika', 'MTK'),
  ('Bahasa Indonesia', 'BIN'),
  ('Bahasa Inggris', 'BIG'),
  ('Informatika', 'INF'),
  ('Produk Kreatif dan Kewirausahaan', 'PKK'),
  ('Kejuruan', 'KJR');