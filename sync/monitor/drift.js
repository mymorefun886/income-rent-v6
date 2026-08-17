// monitor/drift.js — Data Drift Monitor v1.0
// Detects unexpected changes in core metrics. Takes daily snapshot.
// Severity: INFO (ok) / WARNING (minor) / CRITICAL (major drift)
// Usage: node monitor/drift.js

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hermes:Mf848886@192.168.9.2:5435/aios',
  max: 4,
});

const CHECKS = [
  { name: 'school_count',     sql: "SELECT count(*) FROM core.school",                      min: 3000, max: 4000 },
  { name: 'school_with_geom', sql: "SELECT count(*) FROM core.school WHERE geom IS NOT NULL", min: 3000, max: 4000 },
  { name: 'poa_net_count',    sql: "SELECT count(*) FROM core.school_net WHERE net_type='POA'", min: 500, max: 700 },
  { name: 'sspa_net_count',   sql: "SELECT count(*) FROM core.school_net WHERE net_type='SSPA'", min: 300, max: 500 },
  { name: 'alias_count',      sql: "SELECT count(*) FROM core.school_alias",                  min: 1500, max: 3500 },
  { name: 'profile_count',    sql: "SELECT count(*) FROM core.school_profile",                 min: 800, max: 2500 },
  { name: 'vacancy_kg',       sql: "SELECT count(DISTINCT school_code) FROM core.school_vacancy", min: 400, max: 700 },
  { name: 'access_all',       sql: "SELECT count(*) FROM core.school_accessibility",           min: 3000, max: 4000 },
  { name: 'transport_stops',  sql: "SELECT count(*) FROM core.transport_stop",                  min: 9000, max: 11000 },
  { name: 'kg_with_profile',  sql: "SELECT count(*) FROM core.school s JOIN core.school_profile p ON s.school_code = p.school_code WHERE s.level='kindergarten'", min: 700, max: 1200 },
  { name: 'sync_sources',     sql: "SELECT count(*) FROM system.sync_source WHERE last_success_at IS NOT NULL", min: 3, max: 10 },
  { name: 'recent_errors',    sql: "SELECT count(*) FROM system.sync_log WHERE status='error' AND created_at > NOW() - INTERVAL '7 days'", min: 0, max: 5 },
];

async function takeSnapshot(pool) {
  await pool.query(`
    INSERT INTO system.daily_snapshot (date, school_count, alias_count, profile_count, vacancy_count,
      poa_schools, sspa_schools, transport_stops, kg_profile_cov, pri_profile_cov, sec_profile_cov, sync_errors_7d, contract_passed)
    SELECT
      CURRENT_DATE,
      (SELECT count(*) FROM core.school),
      (SELECT count(*) FROM core.school_alias),
      (SELECT count(*) FROM core.school_profile),
      (SELECT count(*) FROM core.school_vacancy),
      (SELECT count(DISTINCT school_code) FROM core.school_net WHERE net_type='POA'),
      (SELECT count(DISTINCT school_code) FROM core.school_net WHERE net_type='SSPA'),
      (SELECT count(*) FROM core.transport_stop),
      (SELECT ROUND(100.0*count(*) FILTER (WHERE p.school_code IS NOT NULL)/count(*),1) FROM core.school s LEFT JOIN core.school_profile p ON s.school_code=p.school_code WHERE s.level='kindergarten'),
      (SELECT ROUND(100.0*count(*) FILTER (WHERE p.school_code IS NOT NULL)/count(*),1) FROM core.school s LEFT JOIN core.school_profile p ON s.school_code=p.school_code WHERE s.level='primary'),
      (SELECT ROUND(100.0*count(*) FILTER (WHERE p.school_code IS NOT NULL)/count(*),1) FROM core.school s LEFT JOIN core.school_profile p ON s.school_code=p.school_code WHERE s.level='secondary'),
      (SELECT count(*) FROM system.sync_log WHERE status='error' AND created_at > NOW() - INTERVAL '7 days'),
      28
    ON CONFLICT (date) DO UPDATE SET
      school_count = EXCLUDED.school_count, alias_count = EXCLUDED.alias_count,
      profile_count = EXCLUDED.profile_count, vacancy_count = EXCLUDED.vacancy_count,
      poa_schools = EXCLUDED.poa_schools, sspa_schools = EXCLUDED.sspa_schools,
      transport_stops = EXCLUDED.transport_stops, kg_profile_cov = EXCLUDED.kg_profile_cov,
      pri_profile_cov = EXCLUDED.pri_profile_cov, sec_profile_cov = EXCLUDED.sec_profile_cov,
      sync_errors_7d = EXCLUDED.sync_errors_7d, contract_passed = EXCLUDED.contract_passed
  `);
}

async function run() {
  console.log('═══ Data Drift Monitor v1.0 ═══');
  console.log('Time:', new Date().toISOString());
  console.log('');

  let ok = 0, warn = 0;

  for (const check of CHECKS) {
    const result = await pool.query(check.sql);
    const value = parseInt(result.rows[0].count);

    if (value >= check.min && value <= check.max) {
      ok++;
    } else {
      const range = check.max - check.min;
      const deviation = Math.min(Math.abs(value - check.min), Math.abs(value - check.max));
      const pct = range > 0 ? deviation / range : 0;
      if (pct > 0.2) {
        console.log(`🚨 CRITICAL ${check.name}: ${value} (expected ${check.min}–${check.max})`);
      } else {
        console.log(`⚠️  WARNING ${check.name}: ${value} (expected ${check.min}–${check.max})`);
      }
      warn++;
    }
  }

  console.log('');
  if (warn === 0) {
    console.log(`✅ All ${ok} checks passed. No drift detected.`);
  } else {
    console.log(`⚠️  ${warn}/${ok + warn} checks outside expected range.`);
    console.log('Investigate: has a sync failed? Has source data changed?');
  }

  // Sync source freshness
  console.log('\n─── Sync Source Freshness ───');
  const sources = await pool.query(
    `SELECT source_name, last_success_at, row_count FROM system.sync_source ORDER BY source_name`
  );
  sources.rows.forEach(r => {
    const age = r.last_success_at ? Math.round((Date.now() - new Date(r.last_success_at).getTime()) / 3600000) : null;
    const status = age == null ? 'NEVER' : age > 72 ? '⚠️ STALE' : age > 24 ? '⚠️ >24h' : 'OK';
    console.log(`  ${r.source_name}: ${status} (${age != null ? age + 'h ago' : 'never'}, ${r.row_count} rows)`);
  });

  // Take snapshot
  await takeSnapshot(pool);
  console.log('\n📸 Daily snapshot saved.');

  return warn > 0 ? 1 : 0;
}

run().catch(err => { console.error('Monitor error:', err); process.exit(1); }).finally(() => pool.end());
