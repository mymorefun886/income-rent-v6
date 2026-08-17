// query/school_accessibility.js
// Deterministic proximity query: schools near a transport point or within a radius.
// Contract: { lat, lng, radius_m?: 500, level?, mtr_only?: false }
import pg from 'pg';

export async function schoolAccessibility(pool, { lat, lng, radius_m, level, mtr_only }) {
  const r = radius_m || 500;

  const rows = await pool.query(`
    SELECT
      s.school_code, s.name_tc, s.name_en, s.level, s.school_type,
      s.district,
      ROUND(ST_Distance(s.geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)) as distance_m,
      a.nearest_mtr_stn, a.mtr_distance_m, a.nearest_bus_stop, a.bus_distance_m,
      p.religion, p.medium_of_instruction, p.sponsoring_body
    FROM core.school s
    JOIN core.school_accessibility a ON s.school_code = a.school_code
    LEFT JOIN core.school_profile p ON s.school_code = p.school_code
      AND p.school_year = CASE WHEN s.level = 'secondary' THEN '2025/26' ELSE '2025' END
    WHERE s.geom IS NOT NULL
      AND ST_DWithin(s.geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      AND ($4::text IS NULL OR s.level = $4)
      AND ($5::boolean IS NOT TRUE OR a.mtr_distance_m <= $3)
    ORDER BY s.geom::geography <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
    LIMIT 50
  `, [lng, lat, r, level || null, mtr_only || false]);

  return {
    meta: { center: { lat, lng }, radius_m: r, level, count: rows.rowCount },
    schools: rows.rows,
  };
}
