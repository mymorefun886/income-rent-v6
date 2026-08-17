// query/search_schools.js
// Deterministic multi-constraint school search. All filters are exact or range-based.
// Contract: { level?, district?, school_type?, religion?, medium_of_instruction?,
//             mtr_distance_max?, vacancy_grade?, limit?: 50, offset?: 0 }
// No fuzzy, no ranking by signal, no LLM-generated WHERE clauses.
import pg from 'pg';

export async function searchSchools(pool, filters = {}) {
  const conditions = [];
  const params = [];
  let p = 1;

  if (filters.level) {
    conditions.push(`s.level = $${p++}`);
    params.push(filters.level);
  }
  if (filters.district) {
    conditions.push(`s.district = $${p++}`);
    params.push(filters.district);
  }
  if (filters.school_type) {
    conditions.push(`s.school_type = $${p++}`);
    params.push(filters.school_type);
  }
  if (filters.religion) {
    conditions.push(`lower(p.religion) LIKE '%' || lower($${p++}) || '%'`);
    params.push(filters.religion);
  }
  if (filters.medium_of_instruction) {
    conditions.push(`p.medium_of_instruction ILIKE '%' || $${p++} || '%'`);
    params.push(filters.medium_of_instruction);
  }
  if (filters.mtr_distance_max != null) {
    conditions.push(`a.mtr_distance_m <= $${p++}`);
    params.push(filters.mtr_distance_max);
  }
  if (filters.vacancy_grade) {
    conditions.push(`EXISTS (SELECT 1 FROM core.school_vacancy v
      WHERE v.school_code = s.school_code AND v.grade = $${p++}
        AND v.school_year = '2026/27' AND v.vacancy_count > 0)`);
    params.push(filters.vacancy_grade);
  }
  if (filters.net_type && filters.net_code) {
    conditions.push(`EXISTS (SELECT 1 FROM core.school_net n2
      WHERE n2.school_code = s.school_code AND n2.net_type = $${p++} AND n2.net_code = $${p++})`);
    params.push(filters.net_type, filters.net_code);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  params.push(limit, offset);

  const rows = await pool.query(`
    SELECT
      s.school_code, s.name_tc, s.name_en, s.level, s.school_type, s.district,
      ST_Y(s.geom) as lat, ST_X(s.geom) as lng,
      a.mtr_distance_m, a.nearest_mtr_stn, a.bus_distance_m, a.nearest_bus_stop,
      p.religion, p.medium_of_instruction, p.sponsoring_body, p.student_category,
      p.joining_scheme, p.school_category, p.curriculum_type, p.no_of_classrooms,
      p.outdoor_playground, p.indoor_playground
    FROM core.school s
    JOIN core.school_accessibility a ON s.school_code = a.school_code
    LEFT JOIN core.school_profile p ON s.school_code = p.school_code
      AND p.school_year = CASE WHEN s.level = 'secondary' THEN '2025/26' ELSE '2025' END
    ${where}
    ORDER BY s.school_type, s.name_tc
    LIMIT $${p++} OFFSET $${p++}
  `, params);

  return {
    meta: { filters, count: rows.rowCount, limit, offset },
    schools: rows.rows,
  };
}
