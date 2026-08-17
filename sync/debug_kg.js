import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const result = await pool.query(`
  SELECT s.name_tc, s.name_en, s.district, s.school_code,
         ST_Y(s.geom) as lat, ST_X(s.geom) as lng,
         a.mtr_distance_m, a.nearest_mtr_stn,
         a.bus_distance_m, a.nearest_bus_stop
  FROM core.school s
  JOIN core.school_accessibility a ON s.school_code = a.school_code
  WHERE s.level = 'kindergarten'
    AND s.name_tc LIKE '%聖母無玷聖心%'
`);

if (result.rows.length === 0) {
  const fuzzy = await pool.query(
    "SELECT name_tc, name_en, district, school_code FROM core.school WHERE level='kindergarten' AND (name_tc LIKE '%聖母%' OR name_tc LIKE '%聖心%' OR name_en ILIKE '%immaculate%heart%') LIMIT 10"
  );
  console.log('Exact name not found. Fuzzy results:');
  fuzzy.rows.forEach(r => console.log('  ' + r.name_tc + ' | ' + r.name_en + ' | ' + r.district + ' | code=' + r.school_code));
} else {
  for (const r of result.rows) {
    console.log('Found: ' + r.name_tc + ' | ' + r.name_en);
    console.log('District: ' + r.district);
    console.log('MTR: ' + r.nearest_mtr_stn + ' ' + r.mtr_distance_m + 'm');

    const vac = await pool.query(
      'SELECT grade, vacancy_count FROM core.school_vacancy WHERE school_code = $1 AND school_year = $2',
      [r.school_code, '2026/27']
    );
    console.log('Vacancy: ' + (vac.rows.length > 0 ? vac.rows.map(r2 => r2.grade + '=' + r2.vacancy_count).join(', ') : 'NO DATA'));

    if (r.mtr_distance_m > 800) {
      console.log('>> EXCLUDED: MTR distance ' + r.mtr_distance_m + 'm > 800m');
    }
    if (r.district !== 'SHA TIN') {
      console.log('>> EXCLUDED: district=' + r.district + ' (not SHA TIN)');
    }
  }
}

await pool.end();
