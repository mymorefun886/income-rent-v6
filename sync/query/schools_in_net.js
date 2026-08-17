// query/schools_in_net.js
// Deterministic query: schools in a given POA or SSPA net.
// Contract: { net_type: 'POA'|'SSPA', net_code: string, level?: string }
// Returns: ordered by school_type, then name_tc
import pg from 'pg';

export async function schoolsInNet(pool, { net_type, net_code, level }) {
  if (!['POA', 'SSPA'].includes(net_type)) throw new Error(`Invalid net_type: ${net_type}`);

  const rows = await pool.query(`
    SELECT
      s.school_code,
      s.name_tc,
      s.name_en,
      s.school_type,
      s.district,
      ST_Y(s.geom) as lat,
      ST_X(s.geom) as lng,
      n.net_code,
      a.mtr_distance_m,
      a.nearest_mtr_stn,
      a.bus_distance_m,
      a.nearest_bus_stop,
      p.religion,
      p.medium_of_instruction,
      p.sponsoring_body,
      v.vacancy_summary
    FROM core.school s
    JOIN core.school_net n ON s.school_code = n.school_code
      AND n.net_type = $1 AND n.net_code = $2
    JOIN core.school_accessibility a ON s.school_code = a.school_code
    LEFT JOIN core.school_profile p ON s.school_code = p.school_code
      AND p.school_year = CASE WHEN s.level = 'secondary' THEN '2025/26' ELSE '2025' END
    LEFT JOIN LATERAL (
      SELECT jsonb_object_agg(grade, CASE WHEN vacancy_count > 0 THEN 'available' ELSE 'full' END) as vacancy_summary
      FROM core.school_vacancy
      WHERE school_code = s.school_code AND school_year = '2026/27'
    ) v ON true
    WHERE ($3::text IS NULL OR s.level = $3)
    ORDER BY s.school_type, s.name_tc
  `, [net_type, net_code, level || null]);

  // Attach signals (annotation only)
  const codes = rows.rows.map(r => r.school_code);
  if (codes.length > 0) {
    const placeholders = codes.map((_, i) => '$' + (i + 1));
    const signals = await pool.query(
      `SELECT school_code, jsonb_agg(jsonb_build_object('title',title,'summary',summary,'source',source,'type',signal_type) ORDER BY published_at DESC) as signals
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
    meta: { net_type, net_code, level, count: rows.rowCount },
    schools: rows.rows,
  };
}
