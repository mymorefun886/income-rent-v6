// query/get_school_by_name.js
// Deterministic single-school detail view with all 7 layers.
// Contract: { name: string } — matches by name_tc or name_en (case-insensitive substring)
import pg from 'pg';

export async function getSchoolByName(pool, { name }) {
  const rows = await pool.query(`
    SELECT
      s.school_code, s.name_tc, s.name_en, s.level, s.school_type, s.district,
      s.address_tc, s.address_en, s.phone, s.website, s.gender,
      ST_Y(s.geom) as lat, ST_X(s.geom) as lng,
      p.religion, p.medium_of_instruction, p.sponsoring_body, p.student_category,
      p.joining_scheme, p.school_category, p.curriculum_type,
      p.no_of_classrooms, p.outdoor_playground, p.indoor_playground,
      p.founding_year, p.teacher_count, p.class_count,
      a.nearest_mtr_stn, a.mtr_distance_m, a.nearest_bus_stop, a.bus_distance_m,
      COALESCE(nets.nets, '[]'::jsonb) as nets,
      COALESCE(vac.vacancy, '[]'::jsonb) as vacancy
    FROM core.school s
    JOIN core.school_accessibility a ON s.school_code = a.school_code
    LEFT JOIN core.school_profile p ON s.school_code = p.school_code
      AND p.school_year = CASE WHEN s.level = 'secondary' THEN '2025/26' ELSE '2025' END
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('type',net_type,'code',net_code)) as nets
      FROM core.school_net WHERE school_code = s.school_code
    ) nets ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('grade',grade,'status',CASE WHEN vacancy_count>0 THEN 'available' ELSE 'full' END)) as vacancy
      FROM core.school_vacancy WHERE school_code = s.school_code AND school_year = '2026/27'
    ) vac ON true
    WHERE lower(s.name_tc) LIKE '%' || lower($1) || '%'
       OR lower(s.name_en) LIKE '%' || lower($1) || '%'
    ORDER BY
      CASE WHEN lower(s.name_tc) = lower($1) OR lower(s.name_en) = lower($1) THEN 0 ELSE 1 END,
      s.name_tc
    LIMIT 10
  `, [name]);

  // Attach signals
  const codes = rows.rows.map(r => r.school_code);
  if (codes.length > 0) {
    const placeholders = codes.map((_, i) => '$' + (i + 1));
    const signals = await pool.query(
      `SELECT school_code, jsonb_agg(jsonb_build_object('title',title,'summary',summary,'source',source,'type',signal_type,'date',published_at) ORDER BY published_at DESC) as signals
       FROM core.school_signal WHERE school_code IN (${placeholders.join(',')})
       GROUP BY school_code`,
      codes
    );
    const sigMap = new Map(signals.rows.map(r => [r.school_code, r.signals]));
    for (const row of rows.rows) {
      row.signals = sigMap.get(row.school_code) || [];
    }
  } else {
    rows.rows.forEach(r => r.signals = []);
  }

  return {
    meta: { query: name, count: rows.rowCount },
    schools: rows.rows,
  };
}
