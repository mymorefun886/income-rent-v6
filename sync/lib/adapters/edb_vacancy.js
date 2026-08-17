// adapters/edb_vacancy.js
// Sync adapter for EDB Kindergarten Vacancy data.
// Source: CKAN hk-edb-freekg-k1-k3-vacancy-information (CSV)
//
// Data: 710 rows, K1-K3 vacancy status (Y/N) per kindergarten.
// Identity: SCRN (school registration number) → school_code via school_alias.
// Strategy: alias-only lookup, upsert by (school_code, school_year, grade), idempotent.

import { registerSource, runSync, sha256 } from '../sync_engine.js';
import { query } from '../db.js';

const SOURCE_NAME = 'edb_kg_vacancy';
const SOURCE_TYPE = 'http_csv';
const SOURCE_URL = 'http://www.edb.gov.hk/attachment/en/edu-system/preprimary-kindergarten/kindergarten-k1-admission-arrangements/K1-K3_vacancy_information_en_202627.csv';

// ── Public API ───────────────────────────────────────────────────────────────────

export async function syncVacancy() {
  await registerSource({
    sourceName: SOURCE_NAME,
    sourceType: SOURCE_TYPE,
    endpoint: SOURCE_URL,
    updateFreq: 'as_needed',
  });

  return runSync({
    sourceName: SOURCE_NAME,
    syncFn: async () => {
      // 1. Download CSV
      console.log('[sync] Fetching vacancy CSV...');
      const resp = await fetch(SOURCE_URL);
      if (!resp.ok) throw new Error(`Vacancy CSV fetch failed: ${resp.status}`);
      const text = await resp.text();
      const lines = text.trim().split('\n');
      const header = lines[0].split(',');
      console.log(`[sync] Downloaded ${lines.length - 1} rows, ${header.length} columns`);

      // 2. Store raw
      const hash = sha256(text);
      await query(`DELETE FROM raw.school_vacancy WHERE source_name = $1`, [SOURCE_NAME]);
      // Parse CSV to JSON array for raw storage
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',');
        const obj = {};
        header.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
        return obj;
      });
      await query(
        `INSERT INTO raw.school_vacancy (source_name, source_hash, payload) VALUES ($1, $2, $3)`,
        [SOURCE_NAME, hash, JSON.stringify(rows)]
      );

      // 3. Collect all SCRNs, batch-fetch aliases
      console.log('[sync] Building alias map...');
      const scrns = [...new Set(rows.map(r => r['SCRN']).filter(Boolean))];
      const aliasMap = new Map();

      if (scrns.length > 0) {
        const placeholders = scrns.map((_, i) => '$' + (i + 1));
        const aliasResult = await query(
          `SELECT external_id, school_code FROM core.school_alias WHERE source_name = 'vacancy' AND external_id IN (${placeholders.join(',')})`,
          scrns
        );
        for (const row of aliasResult.rows) {
          aliasMap.set(row.external_id, row.school_code);
        }
      }
      console.log(`[sync] ${aliasMap.size} aliases found for ${scrns.length} SCRNs`);

      // 4. ETL to core.school_vacancy
      let inserted = 0, skipped = 0;
      const skipSamples = [];
      const grades = ['K1', 'K2', 'K3'];

      for (const row of rows) {
        const scrn = row['SCRN'];
        const schoolCode = aliasMap.get(scrn);
        if (!schoolCode) {
          skipped++;
          if (skipSamples.length < 5) {
            skipSamples.push(`${scrn} (${row['School English Name']})`);
          }
          continue;
        }

        const schoolYear = '2026/27'; // from URL
        for (const grade of grades) {
          const status = row[grade + ' Vacancy Status'];
          if (!status || status === '-') continue;

          await query(`
            INSERT INTO core.school_vacancy (school_code, school_year, grade, vacancy_count)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (school_code, school_year, grade) DO UPDATE SET
              vacancy_count = EXCLUDED.vacancy_count,
              updated_at = NOW()
          `, [schoolCode, schoolYear, grade, status === 'Y' ? 1 : 0]);
          inserted++;
        }
      }

      console.log(`[sync] ${inserted} vacancy records inserted, ${skipped} rows skipped (no alias)`);
      if (skipSamples.length > 0) {
        console.log(`[sync] Skipped examples: ${skipSamples.join(', ')}`);
      }

      return { hash, rows: inserted };
    },
  });
}

// ── CLI entry ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[sync] Starting vacancy sync...');
  const result = await syncVacancy();
  console.log(`[sync] Done: ${result.status}, ${result.rows} vacancy records synced`);
}

if (process.argv[1]?.includes('edb_vacancy')) {
  main().catch(err => { console.error('[sync] Fatal:', err); process.exit(1); });
}
