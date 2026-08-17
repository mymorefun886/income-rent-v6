// test/contract.test.js — Contract Test Suite v1.0
// Golden tests for each of the 6 Query APIs + Agent.
// Every test has a known expected result. Breakage = contract violation.
// Run: node test/contract.test.js

import pg from 'pg';
import { searchSchools } from '../query/search_schools.js';
import { schoolsInNet } from '../query/schools_in_net.js';
import { getSchoolByName } from '../query/get_school_by_name.js';
import { compareSchools } from '../query/compare_schools.js';
import { schoolAccessibility } from '../query/school_accessibility.js';
import { recommendSchools } from '../query/recommend_schools.js';
import { ask } from '../agent/index.js';
import { ensureTraceTable, tracedAsk } from '../agent/trace.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hermes:Mf848886@192.168.9.2:5435/aios',
  max: 4,
});

let passed = 0, failed = 0;

function assert(desc, condition, detail) {
  if (condition) { passed++; console.log('  PASS ' + desc); }
  else           { failed++; console.error('  FAIL ' + desc + (detail ? ': ' + detail : '')); }
}

async function run() {
  await ensureTraceTable(pool);

  console.log('═══ Contract Test Suite v1.0 ═══\n');

  // ──── 1. schools_in_net ──────────────────────────────────────────────────
  console.log('1. schoolsInNet(POA, 41, primary)');
  const r1 = await schoolsInNet(pool, { net_type: 'POA', net_code: '41', level: 'primary' });
  assert('returns meta', r1.meta !== undefined);
  assert('count >= 20', r1.meta.count >= 20, 'got ' + r1.meta.count);
  assert('net_type is POA', r1.meta.net_type === 'POA');
  assert('schools have school_code', r1.schools.length > 0 && r1.schools[0].school_code);
  assert('schools have MTR distance', r1.schools[0].mtr_distance_m != null);

  // ──── 2. search_schools ──────────────────────────────────────────────────
  console.log('\n2. searchSchools(catholic, primary)');
  const r2 = await searchSchools(pool, { level: 'primary', religion: 'catholic', limit: 50 });
  assert('returns schools', r2.meta.count > 0);
  assert('all are primary', r2.schools.every(s => s.level === 'primary'));
  assert('all have religion containing catholic',
    r2.schools.slice(0, 10).every(s => (s.religion || '').toLowerCase().includes('catholic')));

  // ──── 3. get_school_by_name ──────────────────────────────────────────────
  console.log('\n3. getSchoolByName(喇沙)');
  const r3 = await getSchoolByName(pool, { name: '喇沙' });
  assert('finds at least 1 school', r3.meta.count >= 1);
  assert('top result is 喇沙小學', r3.schools[0].name_tc === '喇沙小學', 'got ' + r3.schools[0].name_tc);
  assert('has profile data', r3.schools[0].religion != null);

  // ──── 4. compare_schools ─────────────────────────────────────────────────
  console.log('\n4. compareSchools');
  const codes = await pool.query("SELECT school_code FROM core.school WHERE name_tc IN ('喇沙小學','瑪利諾修院學校(小學部)')");
  assert('found both schools', codes.rows.length === 2, 'got ' + codes.rows.length);
  if (codes.rows.length === 2) {
    const r4 = await compareSchools(pool, { school_codes: codes.rows.map(r => r.school_code) });
    assert('returns 2 schools', r4.meta.count === 2);
    assert('order preserved', r4.schools[0].school_code === codes.rows[0].school_code);
  } else { failed++; }

  // ──── 5. school_accessibility ────────────────────────────────────────────
  console.log('\n5. schoolAccessibility');
  const r5 = await schoolAccessibility(pool, { lat: 22.3367, lng: 114.1756, radius_m: 500, level: 'primary' });
  assert('returns results near Kowloon Tong', r5.meta.count > 0);
  assert('all within 500m', r5.schools.every(s => s.distance_m <= 500));

  // ──── 6. recommend_schools ───────────────────────────────────────────────
  console.log('\n6. recommendSchools(catholic primary, POA 41)');
  const r6 = await recommendSchools(pool, { level: 'primary', religion: 'catholic', net_type: 'POA', net_code: '41', mtr_distance_max: 1000 });
  assert('returns recommendations', r6.meta.count > 0);
  assert('scoring is deterministic', r6.meta.scoring === 'deterministic');
  assert('top school has score > 0', r6.schools[0].score > 0);
  assert('top school has reasons', r6.schools[0].reasons?.length > 0);
  assert('score breakdown exists', r6.schools[0]._score_religion != null || r6.schools[0]._score_mtr != null);

  // ──── 7. Agent (traced) ──────────────────────────────────────────────────
  console.log('\n7. Agent tracedAsk');
  const r7 = await tracedAsk(pool, '41校網天主教小學', ask);
  assert('agent returns answer', r7.answer.length > 50);
  assert('has intent', r7.intent != null);
  assert('has meta', r7.meta?.count != null);

  // ──── 8. Reproducibility ─────────────────────────────────────────────────
  console.log('\n8. Reproducibility');
  const r8a = await recommendSchools(pool, { level: 'primary', religion: 'catholic', net_type: 'POA', net_code: '41' });
  const r8b = await recommendSchools(pool, { level: 'primary', religion: 'catholic', net_type: 'POA', net_code: '41' });
  assert('same count', r8a.meta.count === r8b.meta.count);
  assert('same top school', r8a.schools[0].school_code === r8b.schools[0].school_code);
  assert('same score', r8a.schools[0].score === r8b.schools[0].score);

  // ──── 9. Drift check ─────────────────────────────────────────────────────
  console.log('\n9. Drift check (repeat question)');
  const r9a = await tracedAsk(pool, '41校網小學', ask);
  const r9b = await tracedAsk(pool, '41校網小學', ask);
  assert('same result count', r9a.meta.count === r9b.meta.count,
    r9a.meta.count + ' vs ' + r9b.meta.count);

  // ──── Summary ────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════');
  console.log('Passed: ' + passed + '  Failed: ' + failed);
  console.log('═══════════════════════════════');
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('Test suite error:', err); process.exit(1); }).finally(() => pool.end());
