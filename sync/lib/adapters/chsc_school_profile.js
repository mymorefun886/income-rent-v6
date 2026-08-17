// adapters/chsc_school_profile.js
// Sync adapter for CHSC School Profiles (primary + secondary).
// Source: CHSC annual CSVs from chsc.hk
//
// Phase 2a: Extracts religion, sponsoring_body, medium_of_instruction.
// Identity: school_name → school_code via school_alias (pre-built batch).
// Strategy: alias-only lookup, upsert by (school_code, school_year).

import { registerSource, runSync, sha256 } from '../sync_engine.js';
import { query } from '../db.js';

const SOURCE_NAME = 'chsc_school_profile';
const SOURCE_TYPE = 'ckan_csv';

const SOURCES = [
  {
    name: 'chsc_primary_profile',
    aliasSource: 'chsc_primary',
    level: 'primary',
    url: 'https://www.chsc.hk/datagovhk/psp_2025_en.csv',
    schoolYear: '2025',
    // Column mapping for primary CSV
    religionCol: 'religion',
    sponsorCol: 'sponsoring_body',
    mediumCol: 'medium_of_instruction',
    genderCol: 'student_gender',
    classTotalCol: 'current_year_no_of_class_total',
    teacherCol: 'previous_year_tsi_total_no_of_teachers',
  },
  {
    name: 'chsc_secondary_profile',
    aliasSource: 'chsc_secondary',
    level: 'secondary',
    url: 'https://www.chsc.hk/datagovhk/ssp_2025_2026_en.csv',
    schoolYear: '2025/26',
    religionCol: 'religion',
    sponsorCol: 'sponsoring_body',
    mediumCol: 'language_policy',  // secondary uses 'language_policy' not 'medium_of_instruction'
    genderCol: 'student_gender',
    classTotalCol: null,  // secondary has separate S1-S6 columns
    teacherCol: 'tsi_total_no_of_teachers',
  },
];

// CSV parser that respects quoted fields (handles commas inside quotes)
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const header = splitCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line);
    const obj = {};
    header.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Public API ──────────────────────────────────────────────────────────────────

export async function syncSchoolProfile() {
  await registerSource({
    sourceName: SOURCE_NAME,
    sourceType: SOURCE_TYPE,
    endpoint: 'https://www.chsc.hk/datagovhk/ (psp + ssp CSVs)',
    updateFreq: 'annual',
  });

  return runSync({
    sourceName: SOURCE_NAME,
    syncFn: async () => {
      let totalInserted = 0;

      for (const cfg of SOURCES) {
        console.log(`[sync] ${cfg.name}...`);
        const resp = await fetch(cfg.url);
        if (!resp.ok) throw new Error(`${cfg.name} fetch failed: ${resp.status}`);
        const text = await resp.text();
        const rows = parseCSV(text);
        console.log(`[sync]   ${rows.length} rows`);

        // Store raw
        const hash = sha256(text);
        await query(`DELETE FROM raw.school_profile WHERE source_name = $1`, [cfg.name]);
        await query(
          `INSERT INTO raw.school_profile (source_name, source_hash, payload) VALUES ($1, $2, $3)`,
          [cfg.name, hash, JSON.stringify(rows)]
        );

        // Batch alias lookup (chunked to stay under PG 508-param limit)
        const schoolNames = [...new Set(rows.map(r => r['school_name']).filter(Boolean))];
        const aliasMap = new Map();
        const BATCH_SIZE = 400;
        for (let i = 0; i < schoolNames.length; i += BATCH_SIZE) {
          const chunk = schoolNames.slice(i, i + BATCH_SIZE);
          const placeholders = chunk.map((_, j) => '$' + (j + 2));
          const aliasResult = await query(
            `SELECT external_id, school_code FROM core.school_alias
             WHERE source_name = $1 AND external_id IN (${placeholders.join(',')})`,
            [cfg.aliasSource, ...chunk]
          );
          for (const r of aliasResult.rows) {
            aliasMap.set(r.external_id, r.school_code);
          }
        }
        console.log(`[sync]   ${aliasMap.size} aliases for ${schoolNames.length} names`);

        // ETL
        let inserted = 0, skipped = 0;
        for (const row of rows) {
          const name = row['school_name'];
          const schoolCode = aliasMap.get(name);
          if (!schoolCode) { skipped++; continue; }

          const religion = row[cfg.religionCol] || null;
          const sponsor = row[cfg.sponsorCol] || null;
          const medium = row[cfg.mediumCol] || null;
          const teacher = parseInt(row[cfg.teacherCol]) || null;
          const classTotal = cfg.classTotalCol ? (parseInt(row[cfg.classTotalCol]) || null) : null;

          await query(`
            INSERT INTO core.school_profile (
              school_code, school_year, religion, sponsoring_body,
              medium_of_instruction, teacher_count, class_count, profile_json
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (school_code, school_year) DO UPDATE SET
              religion       = EXCLUDED.religion,
              sponsoring_body = EXCLUDED.sponsoring_body,
              medium_of_instruction = EXCLUDED.medium_of_instruction,
              teacher_count  = EXCLUDED.teacher_count,
              class_count    = EXCLUDED.class_count,
              profile_json   = EXCLUDED.profile_json,
              updated_at     = NOW()
          `, [schoolCode, cfg.schoolYear, religion, sponsor, medium, teacher, classTotal, JSON.stringify(row)]);
          inserted++;
        }

        console.log(`[sync]   ${inserted} upserted, ${skipped} skipped`);
        totalInserted += inserted;
      }

      return { hash: sha256(`chsc_profile:${totalInserted}`), rows: totalInserted };
    },
  });
}

// ── CLI entry ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('[sync] Starting CHSC profile sync...');
  const result = await syncSchoolProfile();
  console.log(`[sync] Done: ${result.status}, ${result.rows} profiles synced`);
}

if (process.argv[1]?.includes('chsc_school_profile')) {
  main().catch(err => { console.error('[sync] Fatal:', err); process.exit(1); });
}
