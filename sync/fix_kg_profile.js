// Phase 2.5B: KG Profile Adapter
// Source: education.kg_overview_geo (979 rows, already in DB)
// Identity: school_no + school name → school_code via name matching
// Target: core.school_profile (adds KG profile fields)
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

console.log('=== Phase 2.5B: KG Profile Adapter ===\n');

// 1. Add KG-specific columns to core.school_profile
await pool.query(`ALTER TABLE core.school_profile ADD COLUMN IF NOT EXISTS joining_scheme TEXT`);
await pool.query(`ALTER TABLE core.school_profile ADD COLUMN IF NOT EXISTS school_category TEXT`);
await pool.query(`ALTER TABLE core.school_profile ADD COLUMN IF NOT EXISTS student_category TEXT`);
await pool.query(`ALTER TABLE core.school_profile ADD COLUMN IF NOT EXISTS curriculum_type TEXT`);
await pool.query(`ALTER TABLE core.school_profile ADD COLUMN IF NOT EXISTS no_of_classrooms INTEGER`);
await pool.query(`ALTER TABLE core.school_profile ADD COLUMN IF NOT EXISTS outdoor_playground BOOLEAN`);
await pool.query(`ALTER TABLE core.school_profile ADD COLUMN IF NOT EXISTS indoor_playground BOOLEAN`);
await pool.query(`ALTER TABLE core.school_profile ADD COLUMN IF NOT EXISTS founding_year TEXT`);
console.log('Schema columns added');

// 2. Build aliases: KG school_no → EDB school_code via name matching
console.log('\nBuilding KG aliases...');
await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

const kGs = await pool.query(`SELECT DISTINCT school_no, name_en, name_zh FROM education.kg_overview_geo WHERE name_en IS NOT NULL`);

let aliasNew = 0, aliasExist = 0, skipped = 0;
for (const kg of kGs.rows) {
  if (!kg.name_en) { skipped++; continue; }

  // Check if alias already exists
  const existing = await pool.query(
    `SELECT school_code FROM core.school_alias WHERE source_name = 'kg_profile' AND external_id = $1`,
    [String(kg.school_no)]
  );
  if (existing.rows.length > 0) { aliasExist++; continue; }

  // Match by name
  const match = await pool.query(`
    SELECT school_code, name_en, similarity(lower($1), lower(name_en)) as sim
    FROM core.school WHERE level = 'kindergarten'
      AND similarity(lower($1), lower(name_en)) > 0.4
    ORDER BY sim DESC LIMIT 1
  `, [kg.name_en]);

  if (match.rows.length === 0) { skipped++; continue; }

  await pool.query(`
    INSERT INTO core.school_alias (source_name, external_id, school_code, name_raw, confidence, verified)
    VALUES ('kg_profile', $1, $2, $3, $4, $5)
    ON CONFLICT (source_name, external_id) DO NOTHING
  `, [String(kg.school_no), match.rows[0].school_code, kg.name_en, match.rows[0].sim, match.rows[0].sim > 0.6]);
  aliasNew++;
}

console.log('Aliases: ' + aliasNew + ' new, ' + aliasExist + ' existing, ' + skipped + ' skipped');

// 3. ETL: kg_overview_geo → core.school_profile
console.log('\nETL to core.school_profile...');

const etlResult = await pool.query(`
  INSERT INTO core.school_profile (
    school_code, school_year, joining_scheme, school_category,
    student_category, curriculum_type, no_of_classrooms,
    outdoor_playground, indoor_playground, founding_year,
    profile_json, updated_at
  )
  SELECT DISTINCT ON (a.school_code)
    a.school_code,
    '2025',
    kg.joining_scheme,
    kg.school_category,
    kg.student_category,
    kg.curriculum_type,
    kg.no_of_classrooms,
    CASE WHEN kg.outdoor_playground = 'Yes' THEN true ELSE false END,
    CASE WHEN kg.indoor_playground = 'Yes' THEN true ELSE false END,
    kg.founding_year,
    to_jsonb(kg.*),
    NOW()
  FROM education.kg_overview_geo kg
  JOIN core.school_alias a ON a.source_name = 'kg_profile' AND a.external_id = kg.school_no::text
  ORDER BY a.school_code
  ON CONFLICT (school_code, school_year) DO UPDATE SET
    joining_scheme    = EXCLUDED.joining_scheme,
    school_category   = EXCLUDED.school_category,
    student_category  = EXCLUDED.student_category,
    curriculum_type   = EXCLUDED.curriculum_type,
    no_of_classrooms  = EXCLUDED.no_of_classrooms,
    outdoor_playground = EXCLUDED.outdoor_playground,
    indoor_playground = EXCLUDED.indoor_playground,
    founding_year     = EXCLUDED.founding_year,
    profile_json      = EXCLUDED.profile_json,
    updated_at        = NOW()
  RETURNING school_code
`);
console.log('KG profiles upserted: ' + etlResult.rowCount);

// 4. Show coverage
const cov = await pool.query(`
  SELECT s.level, count(*) as total,
    count(*) FILTER (WHERE p.school_code IS NOT NULL) as has_profile
  FROM core.school s
  LEFT JOIN core.school_profile p ON s.school_code = p.school_code
  GROUP BY s.level ORDER BY s.level
`);
console.log('\nProfile coverage:');
cov.rows.forEach(r => console.log('  ' + r.level + ': ' + r.has_profile + '/' + r.total + ' (' + (100*r.has_profile/r.total).toFixed(1) + '%)'));

// KG profile field summary
const fields = await pool.query(`
  SELECT
    count(*) as total,
    count(*) FILTER (WHERE joining_scheme IS NOT NULL) as has_scheme,
    count(*) FILTER (WHERE school_category IS NOT NULL) as has_category,
    count(*) FILTER (WHERE student_category IS NOT NULL) as has_gender,
    count(*) FILTER (WHERE curriculum_type IS NOT NULL) as has_curriculum,
    count(*) FILTER (WHERE no_of_classrooms IS NOT NULL) as has_classrooms
  FROM core.school_profile p
  JOIN core.school s ON s.school_code = p.school_code AND s.level = 'kindergarten'
`);
console.log('\nKG profile detail:');
const f = fields.rows[0];
console.log('  Joining scheme: ' + f.has_scheme + '/' + f.total);
console.log('  School category: ' + f.has_category + '/' + f.total);
console.log('  Student category: ' + f.has_gender + '/' + f.total);
console.log('  Curriculum type: ' + f.has_curriculum + '/' + f.total);
console.log('  Classrooms: ' + f.has_classrooms + '/' + f.total);

await pool.end();
