// Phase 2.5A: Fix 24 missing SSPA aliases
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

console.log('=== Phase 2.5A: SSPA Alias Gap Fix ===\n');

// Get the 24 missing SSPA codes with their school names from raw
const missing = await pool.query(`
  WITH sspa_codes AS (
    SELECT DISTINCT
      f->'properties'->>'NAME_EN' as code,
      f->'properties'->>'ADDRESS_EN' as name
    FROM raw.school_net, jsonb_array_elements(payload) AS f
    WHERE source_name = 'csdi_sspa_net'
  )
  SELECT code, name FROM sspa_codes
  WHERE code NOT IN (SELECT external_id FROM core.school_alias WHERE source_name = 'sspa')
  ORDER BY name
`);
console.log('Missing SSPA codes:', missing.rowCount);

// For each, find best match in core.school (secondary) with trigram
let fixed = 0, manual = 0;
const manualList = [];

for (const row of missing.rows) {
  const result = await pool.query(`
    SELECT school_code, name_en,
           similarity(lower($1), lower(name_en)) as sim
    FROM core.school
    WHERE level = 'secondary'
      AND similarity(lower($1), lower(name_en)) > 0.3
    ORDER BY sim DESC LIMIT 3
  `, [row.name]);

  if (result.rows.length === 0) {
    console.log('NO MATCH: [' + row.code + '] ' + row.name);
    manualList.push(row);
    continue;
  }

  const best = result.rows[0];

  if (best.sim > 0.55) {
    // Auto-accept
    await pool.query(`
      INSERT INTO core.school_alias (source_name, external_id, school_code, name_raw, confidence, verified)
      VALUES ('sspa', $1, $2, $3, $4, true)
      ON CONFLICT (source_name, external_id) DO UPDATE SET
        school_code = EXCLUDED.school_code, name_raw = EXCLUDED.name_raw, confidence = EXCLUDED.confidence, verified = true
    `, [row.code, best.school_code, row.name, best.sim]);
    console.log('AUTO: [' + row.code + '] ' + row.name + ' → ' + best.school_code + ' ' + best.name_en + ' (sim=' + best.sim.toFixed(3) + ')');
    fixed++;
  } else {
    // Flag for manual review
    console.log('MANUAL: [' + row.code + '] ' + row.name);
    console.log('  Best: ' + best.school_code + ' ' + best.name_en + ' (sim=' + best.sim.toFixed(3) + ')');
    if (result.rows.length > 1) {
      console.log('  2nd:  ' + result.rows[1].school_code + ' ' + result.rows[1].name_en + ' (sim=' + result.rows[1].sim.toFixed(3) + ')');
    }
    manual++;
  }
}

console.log('\nAuto-fixed: ' + fixed + ', Manual review: ' + manual);

// Verify SSPA coverage
const cov = await pool.query(`
  WITH sspa_codes AS (
    SELECT DISTINCT f->'properties'->>'NAME_EN' as code
    FROM raw.school_net, jsonb_array_elements(payload) AS f
    WHERE source_name = 'csdi_sspa_net'
  ),
  mapped AS (
    SELECT external_id FROM core.school_alias WHERE source_name = 'sspa'
  )
  SELECT count(*) as total,
    count(*) FILTER (WHERE m.external_id IS NOT NULL) as mapped,
    count(*) FILTER (WHERE m.external_id IS NULL) as missing
  FROM sspa_codes c LEFT JOIN mapped m ON c.code = m.external_id
`);
const c = cov.rows[0];
console.log('\nSSPA coverage: ' + c.mapped + '/' + c.total + ' (' + (100*c.mapped/c.total).toFixed(1) + '%)');
console.log('Remaining: ' + c.missing);

await pool.end();
