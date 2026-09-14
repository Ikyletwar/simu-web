-- ============================================================
-- FASE 5 - RANKING (RPC function)
-- Menghitung rata-rata nilai per siswa dengan filter:
--   'global' -> semua siswa
--   'major'  -> per jurusan (pakai jurusan pemanggil / param)
--   'class'  -> per kelas (pakai kelas pemanggil / param)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_ranking(
  filter_type text DEFAULT 'global',
  filter_value uuid DEFAULT NULL
)
RETURNS TABLE(
  r_number bigint,
  user_id uuid,
  nama text,
  nis text,
  kelas text,
  jurusan text,
  rata_rata numeric
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  me uuid := auth.uid();
  my_major uuid;
  my_class uuid;
BEGIN
  IF filter_value IS NULL THEN
    SELECT major_id, class_id INTO my_major, my_class
    FROM public.users WHERE id = me;
  END IF;

  RETURN QUERY
  WITH scored AS (
    SELECT
      s.user_id,
      AVG(s.nilai)::numeric AS rata_rata
    FROM public.submissions s
    JOIN public.users u ON u.id = s.user_id
    WHERE u.role = 'siswa'
      AND (
        filter_type = 'global'
        OR (
          filter_type = 'major'
          AND u.major_id = COALESCE(filter_value, my_major)
        )
        OR (
          filter_type = 'class'
          AND u.class_id = COALESCE(filter_value, my_class)
        )
      )
    GROUP BY s.user_id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY s.rata_rata DESC, s.user_id)::bigint AS r_number,
    u.id,
    u.nama,
    u.nis,
    (SELECT c.nama FROM public.classes c WHERE c.id = u.class_id) AS kelas,
    (SELECT m.nama FROM public.majors m WHERE m.id = u.major_id) AS jurusan,
    s.rata_rata
  FROM scored s
  JOIN public.users u ON u.id = s.user_id
  ORDER BY s.rata_rata DESC;
END;
$$;

-- Izinkan authenticated memanggil function ini
GRANT EXECUTE ON FUNCTION public.get_ranking(text, uuid) TO authenticated;