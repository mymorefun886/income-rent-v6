// query/index.js — aiOS Education Query Layer
// Deterministic query API for Agent consumption. All functions return structured JSON.
// Usage: import { searchSchools, schoolsInNet, ... } from './query/index.js'
// Or CLI: node query/index.js <function> '<json_args>'

import pg from 'pg';
import { searchSchools } from './search_schools.js';
import { schoolsInNet } from './schools_in_net.js';
import { getSchoolByName } from './get_school_by_name.js';
import { compareSchools } from './compare_schools.js';
import { schoolAccessibility } from './school_accessibility.js';
import { recommendSchools } from './recommend_schools.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hermes:Mf848886@192.168.9.2:5435/aios',
  max: 4,
});

export {
  searchSchools,
  schoolsInNet,
  getSchoolByName,
  compareSchools,
  schoolAccessibility,
  recommendSchools,
};

// CLI runner
async function main() {
  const fn = process.argv[2];
  const args = process.argv[3] ? JSON.parse(process.argv[3]) : {};

  const fns = { searchSchools, schoolsInNet, getSchoolByName, compareSchools, schoolAccessibility, recommendSchools };
  if (!fns[fn]) {
    console.error('Usage: node query/index.js <function> <json_args>');
    console.error('Functions: ' + Object.keys(fns).join(', '));
    process.exit(1);
  }

  const result = await fns[fn](pool, args);
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}

if (process.argv[1]?.includes('query/index')) {
  main().catch(err => { console.error(err); process.exit(1); });
}
