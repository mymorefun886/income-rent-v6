// query/compare_schools.js
// Deterministic side-by-side school comparison.
// Contract: { school_codes: string[] } — max 5 schools
import pg from 'pg';

export async function compareSchools(pool, { school_codes }) {
  if (!Array.isArray(school_codes) || school_codes.length < 2) {
    throw new Error('At least 2 school_codes required');
  }
  if (school_codes.length > 5) {
    throw new Error('Max 5 schools for comparison');
  }

  const placeholders = school_codes.map((_, i) => '$' + (i + 1));
  const rows = await pool.query(`
    SELECT
      s.school_code, s.name_tc, s.name_en, s.level, s.school_type, s.district,
      p.religion, p.medium_of_instruction, p.sponsoring_body,
      p.student_category, p.curriculum_type, p.joining_scheme,
      p.no_of_classrooms, p.teacher_count, p.class_count,
      p.outdoor_playground, p.indoor_playground, p.founding_year,
      a.mtr_distance_m, a.nearest_mtr_stn, a.bus_distance_m, a.nearest_bus_stop,
      COALESCE(nets.nets, '[]'::jsonb) as nets,
      COALESCE(vac.vacancy_summary, '{}'::jsonb) as vacancy
    FROM core.school s
    JOIN core.school_accessibility a ON s.school_code = a.school_code
    LEFT JOIN core.school_profile p ON s.school_code = p.school_code
      AND p.school_year = CASE WHEN s.level = 'secondary' THEN '2025/26' ELSE '2025' END
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('type',net_type,'code',net_code)) as nets
      FROM core.school_net WHERE school_code = s.school_code
    ) nets ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_object_agg(grade, CASE WHEN vacancy_count>0 THEN 'available' ELSE 'full' END) as vacancy_summary
      FROM core.school_vacancy WHERE school_code = s.school_code AND school_year = '2026/27'
    ) vac ON true
    WHERE s.school_code IN (${placeholders.join(',')})
    ORDER BY array_position(ARRAY[${placeholders.join(',')}], s.school_code)
  `, school_codes);

  // Attach signals
  const codes = rows.rows.map(r => r.school_code);
  const sigPlaceholders = codes.map((_, i) => '$' + (i + 1));
  const signals = await pool.query(
    `SELECT school_code, jsonb_agg(jsonb_build_object('title',title,'summary',summary,'source',source,'type',signal_type) ORDER BY published_at DESC) as signals
     FROM core.school_signal WHERE school_code IN (${sigPlaceholders.join(',')})
     GROUP BY school_code`,
    codes
  );
  const sigMap = new Map(signals.rows.map(r => [r.school_code, r.signals]));
  for (const row of rows.rows) {
    row.signals = sigMap.get(row.school_code) || [];
  }

  return {
    meta: { codes: school_codes, count: rows.rowCount },
    schools: rows.rows,
  };
}
