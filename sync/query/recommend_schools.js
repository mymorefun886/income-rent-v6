// query/recommend_schools.js
// Deterministic recommendation: pure scoring function on core data.
// Contract: { level, net_code?, net_type?, religion?, medium_of_instruction?,
//             mtr_distance_max?, vacancy_required?, limit?: 10 }
//
// Scoring weights (fixed, no ML tuning):
//   +10  matches religion
//   +10  matches medium_of_instruction
//   +15  MTR within 500m
//   +10  MTR within 1000m
//   +5   has vacancy (any grade)
//   +5   has outdoor playground (KG only)
//   +5   non-profit-making (KG only)
//   +3   joining KG education scheme
// Signal NEVER influences score. Only attached as annotation.
import pg from 'pg';

function buildScoreColumns(prefs) {
  const cols = [];
  if (prefs.religion)
    cols.push(`CASE WHEN lower(p.religion) LIKE '%' || lower('${prefs.religion.replace(/'/g, "''")}') || '%' THEN 10 ELSE 0 END as _score_religion`);
  if (prefs.medium_of_instruction)
    cols.push(`CASE WHEN p.medium_of_instruction ILIKE '%' || '${prefs.medium_of_instruction.replace(/'/g, "''")}' || '%' THEN 10 ELSE 0 END as _score_moi`);
  cols.push(`CASE WHEN a.mtr_distance_m <= 500 THEN 15 WHEN a.mtr_distance_m <= 1000 THEN 10 ELSE 0 END as _score_mtr`);
  if (prefs.vacancy_required)
    cols.push(`CASE WHEN EXISTS (SELECT 1 FROM core.school_vacancy v WHERE v.school_code = s.school_code AND v.school_year = '2026/27' AND v.vacancy_count > 0) THEN 5 ELSE 0 END as _score_vacancy`);
  cols.push(`CASE WHEN s.level = 'kindergarten' AND p.outdoor_playground THEN 5 ELSE 0 END as _score_playground`);
  cols.push(`CASE WHEN s.level = 'kindergarten' AND p.school_category = 'Non-profit-making' THEN 5 ELSE 0 END as _score_nonprofit`);
  cols.push(`CASE WHEN s.level = 'kindergarten' AND p.joining_scheme = 'Joining' THEN 3 ELSE 0 END as _score_scheme`);
  return cols.length > 0 ? ', ' + cols.join(', ') : '';
}

export async function recommendSchools(pool, prefs = {}) {
  const params = [];
  let scoreExpr = '0';

  // Religion match
  if (prefs.religion) {
    params.push(prefs.religion);
    scoreExpr += ` + CASE WHEN lower(p.religion) LIKE '%' || lower($${params.length}) || '%' THEN 10 ELSE 0 END`;
  }

  // MOI match
  if (prefs.medium_of_instruction) {
    params.push(prefs.medium_of_instruction);
    scoreExpr += ` + CASE WHEN p.medium_of_instruction ILIKE '%' || $${params.length} || '%' THEN 10 ELSE 0 END`;
  }

  // MTR proximity
  scoreExpr += ` + CASE WHEN a.mtr_distance_m <= 500 THEN 15 WHEN a.mtr_distance_m <= 1000 THEN 10 ELSE 0 END`;

  // Vacancy
  if (prefs.vacancy_required) {
    scoreExpr += ` + CASE WHEN EXISTS (SELECT 1 FROM core.school_vacancy v
      WHERE v.school_code = s.school_code AND v.school_year = '2026/27' AND v.vacancy_count > 0) THEN 5 ELSE 0 END`;
  }

  // KG bonus
  scoreExpr += ` + CASE WHEN s.level = 'kindergarten' AND p.outdoor_playground THEN 5 ELSE 0 END`;
  scoreExpr += ` + CASE WHEN s.level = 'kindergarten' AND p.school_category = 'Non-profit-making' THEN 5 ELSE 0 END`;
  scoreExpr += ` + CASE WHEN s.level = 'kindergarten' AND p.joining_scheme = 'Joining' THEN 3 ELSE 0 END`;

  const conditions = [`s.level = $${params.length + 1}`];
  params.push(prefs.level || 'primary');

  if (prefs.net_type && prefs.net_code) {
    params.push(prefs.net_type, prefs.net_code);
    conditions.push(`EXISTS (SELECT 1 FROM core.school_net n2 WHERE n2.school_code = s.school_code AND n2.net_type = $${params.length - 1} AND n2.net_code = $${params.length})`);
  }

  if (prefs.mtr_distance_max) {
    params.push(prefs.mtr_distance_max);
    conditions.push(`a.mtr_distance_m <= $${params.length}`);
  }

  const limit = prefs.limit || 10;
  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // This is safe: scoreExpr is composed entirely of hardcoded SQL fragments + numbered params
  const rows = await pool.query(`
    SELECT
      s.school_code, s.name_tc, s.name_en, s.level, s.school_type, s.district,
      p.religion, p.medium_of_instruction, p.sponsoring_body, p.student_category,
      p.joining_scheme, p.school_category, p.outdoor_playground,
      a.mtr_distance_m, a.nearest_mtr_stn, a.bus_distance_m, a.nearest_bus_stop,
      (${scoreExpr}) as score
      ${buildScoreColumns(prefs)}
    FROM core.school s
    JOIN core.school_accessibility a ON s.school_code = a.school_code
    LEFT JOIN core.school_profile p ON s.school_code = p.school_code
      AND p.school_year = CASE WHEN s.level = 'secondary' THEN '2025/26' ELSE '2025' END
    ${where}
    ORDER BY score DESC, a.mtr_distance_m
    LIMIT ${limit}
  `, params);

  // Attach signals (annotation only — NOT scored)
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
      // Build reasons (for Agent narration)
      const reasons = [];
      if (row._score_religion > 0) reasons.push('宗教匹配 (+' + row._score_religion + ')');
      if (row._score_moi > 0) reasons.push('教學語言匹配 (+' + row._score_moi + ')');
      if (row._score_mtr >= 15) reasons.push('步行可達MTR (' + row.mtr_distance_m + 'm, +' + row._score_mtr + ')');
      else if (row._score_mtr >= 10) reasons.push('鄰近MTR (' + row.mtr_distance_m + 'm, +' + row._score_mtr + ')');
      if (row._score_vacancy > 0) reasons.push('有學位 (+' + row._score_vacancy + ')');
      if (row._score_playground > 0) reasons.push('有戶外操場 (+' + row._score_playground + ')');
      if (row._score_nonprofit > 0) reasons.push('非牟利 (+' + row._score_nonprofit + ')');
      if (row._score_scheme > 0) reasons.push('參加教育計劃 (+' + row._score_scheme + ')');
      row.reasons = reasons;
    }
  } else {
    rows.rows.forEach(r => { r.signals = []; r.reasons = []; });
  }

  return {
    meta: { preferences: prefs, count: rows.rowCount, scoring: 'deterministic', scorer_version: 'v1.0' },
    schools: rows.rows,
  };
}
