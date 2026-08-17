// Phase 2.5 — Data Quality Audit
// 1. Duplicate schools, 2. Spatial anomalies, 3. Coverage matrix
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

console.log('═══ Phase 2.5: Data Quality Audit ═══\n');

// ═══════════════════════════════════════════════════════════════
// AUDIT 1: Duplicate schools (same name, different SCH_CODE)
// ═══════════════════════════════════════════════════════════════
console.log('─── 1. Duplicate Entities ───');
const dupes = await pool.query(`
  SELECT name_en, name_tc, array_agg(school_code) as codes, count(*) as n
  FROM core.school
  GROUP BY name_en, name_tc
  HAVING count(*) > 1
  ORDER BY n DESC, name_en
`);
console.log('Duplicate names: ' + dupes.rowCount);
dupes.rows.slice(0, 10).forEach(r => console.log('  ' + r.name_tc + ' x' + r.n + ' codes=' + r.codes.join(',')));

// Total rows that are duplicates
const dupTotal = await pool.query(`
  SELECT sum(n) as total FROM (
    SELECT count(*) as n FROM core.school GROUP BY name_en, name_tc HAVING count(*) > 1
  ) t
`);
console.log('Total duplicate rows: ' + (dupTotal.rows[0].total || 0));

// ═══════════════════════════════════════════════════════════════
// AUDIT 2: Spatial anomalies (MTR distance outliers)
// ═══════════════════════════════════════════════════════════════
console.log('\n─── 2. Spatial Anomalies ───');

// Schools >10km from MTR (possibly wrong geometry)
const farMtr = await pool.query(`
  SELECT s.name_tc, s.name_en, s.district, a.mtr_distance_m, a.nearest_mtr_stn
  FROM core.school s
  JOIN core.school_accessibility a ON s.school_code = a.school_code
  WHERE a.mtr_distance_m > 10000
  ORDER BY a.mtr_distance_m DESC LIMIT 10
`);
console.log('Schools >10km from MTR: ' + farMtr.rowCount);
farMtr.rows.forEach(r => console.log('  ' + r.name_tc + ' | district=' + r.district + ' | MTR ' + r.nearest_mtr_stn + ' ' + r.mtr_distance_m + 'm'));

// Schools with suspicious district-MTR mismatch
// e.g. If school district is YAU TSIM MONG but nearest MTR is in Tuen Mun
const mismatch = await pool.query(`
  SELECT s.name_tc, s.district, a.mtr_distance_m, a.nearest_mtr_stn,
         ROUND(ST_Distance(s.geom::geography, t.geom::geography)) as verify_dist
  FROM core.school s
  JOIN core.school_accessibility a ON s.school_code = a.school_code
  JOIN core.transport_stop t ON t.name_en = a.nearest_mtr_stn AND t.mode = 'mtr'
  WHERE a.mtr_distance_m < 100
  ORDER BY RANDOM() LIMIT 5
`);
console.log('\nSpot-check: schools <100m from MTR (random 5):');
for (const r of mismatch.rows) {
  console.log('  ' + r.name_tc + ' | ' + r.district + ' → ' + r.nearest_mtr_stn + ' ' + r.mtr_distance_m + 'm (verify: ' + r.verify_dist + 'm)');
}

// ═══════════════════════════════════════════════════════════════
// AUDIT 3: Coverage matrix per source
// ═══════════════════════════════════════════════════════════════
console.log('\n─── 3. Coverage Matrix ───');

// Alias coverage
const aliasCov = await pool.query(`
  SELECT source_name,
    count(*) as total,
    count(*) FILTER (WHERE verified) as verified,
    count(*) FILTER (WHERE NOT verified) as unverified,
    ROUND(100.0 * count(*) FILTER (WHERE verified) / count(*), 1) as pct_ok
  FROM core.school_alias
  GROUP BY source_name ORDER BY source_name
`);
console.log('school_alias:');
aliasCov.rows.forEach(r => console.log('  ' + r.source_name + ': ' + r.total + ' total, ' + r.verified + ' verified (' + r.pct_ok + '%), ' + r.unverified + ' unverified'));

// Profile coverage by level
const profCov = await pool.query(`
  SELECT s.level,
    count(*) as total_schools,
    count(*) FILTER (WHERE p.school_code IS NOT NULL) as has_profile,
    ROUND(100.0 * count(*) FILTER (WHERE p.school_code IS NOT NULL) / count(*), 1) as pct
  FROM core.school s
  LEFT JOIN core.school_profile p ON s.school_code = p.school_code AND p.school_year = '2025'
  GROUP BY s.level ORDER BY s.level
`);
console.log('\nschool_profile:');
profCov.rows.forEach(r => console.log('  ' + r.level + ': ' + r.has_profile + '/' + r.total_schools + ' (' + r.pct + '%)'));

// Vacancy coverage
const vacCov = await pool.query(`
  SELECT s.level,
    count(*) as total,
    count(*) FILTER (WHERE v.school_code IS NOT NULL) as has_vacancy,
    ROUND(100.0 * count(*) FILTER (WHERE v.school_code IS NOT NULL) / count(*), 1) as pct
  FROM core.school s
  LEFT JOIN (SELECT DISTINCT school_code FROM core.school_vacancy WHERE school_year = '2026/27') v
    ON s.school_code = v.school_code
  GROUP BY s.level ORDER BY s.level
`);
console.log('\nschool_vacancy:');
vacCov.rows.forEach(r => console.log('  ' + r.level + ': ' + r.has_vacancy + '/' + r.total + ' (' + r.pct + '%)'));

// Net coverage
const netCov = await pool.query(`
  SELECT s.level,
    count(*) as total,
    count(*) FILTER (WHERE n.school_code IS NOT NULL) as has_net,
    ROUND(100.0 * count(*) FILTER (WHERE n.school_code IS NOT NULL) / count(*), 1) as pct
  FROM core.school s
  LEFT JOIN (SELECT DISTINCT school_code FROM core.school_net) n ON s.school_code = n.school_code
  GROUP BY s.level ORDER BY s.level
`);
console.log('\nschool_net:');
netCov.rows.forEach(r => console.log('  ' + r.level + ': ' + r.has_net + '/' + r.total + ' (' + r.pct + '%)'));

// Overall coverage summary
console.log('\n─── Overall Quality Score ───');
const overall = await pool.query(`
  SELECT
    count(*) as schools,
    count(*) FILTER (WHERE geom IS NOT NULL) as has_geom,
    count(*) FILTER (WHERE a.school_code IS NOT NULL) as has_access,
    count(*) FILTER (WHERE p.school_code IS NOT NULL) as has_profile,
    count(*) FILTER (WHERE v.school_code IS NOT NULL) as has_vac,
    count(*) FILTER (WHERE n.school_code IS NOT NULL) as has_net
  FROM core.school s
  LEFT JOIN core.school_accessibility a ON s.school_code = a.school_code
  LEFT JOIN core.school_profile p ON s.school_code = p.school_code AND p.school_year = '2025'
  LEFT JOIN (SELECT DISTINCT school_code FROM core.school_vacancy) v ON s.school_code = v.school_code
  LEFT JOIN (SELECT DISTINCT school_code FROM core.school_net) n ON s.school_code = n.school_code
`);
const o = overall.rows[0];
console.log('  Schools: ' + o.schools);
console.log('  Geometry: ' + o.has_geom + ' (' + (100*o.has_geom/o.schools).toFixed(1) + '%)');
console.log('  Accessibility: ' + o.has_access + ' (' + (100*o.has_access/o.schools).toFixed(1) + '%)');
console.log('  Profile (P+S): ' + o.has_profile + ' (' + (100*o.has_profile/o.schools).toFixed(1) + '%)');
console.log('  Vacancy (KG): ' + o.has_vac + ' (' + (100*o.has_vac/o.schools).toFixed(1) + '%)');
console.log('  Net (P+S): ' + o.has_net + ' (' + (100*o.has_net/o.schools).toFixed(1) + '%)');

await pool.end();
