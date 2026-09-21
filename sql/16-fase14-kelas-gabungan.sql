-- ============================================================
-- FASE 14 - KELAS SASARAN AGREGAT ROMBEL (TJKT & TK)
-- Jalankan SEKALI di Supabase SQL Editor lalu klik RUN.
-- (Aman dijalankan ulang: memakai NOT EXISTS per baris.)
--
-- Tujuan:
--   Kelas rombel terlihat sebagai "XI TJKT 1", "XI TJKT 2", dst.
--   File ini menambahkan kelas "agregat" "X TJKT", "XI TJKT", "XII TJKT"
--   (dan TK) supaya di Kelola Ujian guru cukup memilih:
--     XI TJKT  => menargetkan siswa XI TJKT 1 DAN XI TJKT 2.
--   Sedangkan memilih "XI TJKT 1" tetap hanya untuk rombel itu saja.
--
-- Logika pencocokan ada di sisi aplikasi (js/common.js: kelasCocok()):
--   * id kelas sama => cocok.
--   * nama kelas target BERAKHIR angka ("XI TJKT 1") => spesifik rombel,
--     hanya id sama yang cocok.
--   * nama kelas target TANPA angka ("XI TJKT") => agregat, cocok dengan
--     semua kelas yang punya basis nama sama (XI TJKT 1 & XI TJKT 2).
-- ============================================================

-- Kelas agregat per tingkat untuk jurusan ber-rombel (TJKT & TK).
INSERT INTO public.classes (nama, tingkat, major_id)
SELECT k.huruf || ' ' || m.kode, k.angka, m.id
FROM (VALUES ('10','X'), ('11','XI'), ('12','XII')) AS k(angka, huruf)
CROSS JOIN (
  SELECT id, kode FROM public.majors
  WHERE kode IN ('TJKT', 'TK')
) m
WHERE NOT EXISTS (
  SELECT 1 FROM public.classes c
  WHERE c.nama = k.huruf || ' ' || m.kode
);

-- Paksa PostgREST membaca ulang schema
SELECT pg_notify('pgrst', 'reload schema');