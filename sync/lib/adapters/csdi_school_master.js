// adapters/csdi_school_master.js
// Sync adapter for EDB School Master — unified JSON source.
// Source: SCH_LOC_EDB.json (from hk-edb-schinfo-school-location-and-information CKAN)
//
// This single JSON file contains ALL 3,484 schools with proper field names
// including SCHOOL NO. (SCH_CODE), coordinates, and metadata.
// Much simpler than the 16 CSDI WFS layers which use generic SEARCHxx field names.

import { registerSource, runSync, sha256 } from '../sync_engine.js';
import { query } from '../db.js';

const SOURCE_URL = 'http://www.edb.gov.hk/attachment/en/student-parents/sch-info/sch-search/sch-location-info/SCH_LOC_EDB.json';
const SOURCE_NAME = 'csdi_school_master';
const SOURCE_TYPE = 'http_json';

// ── Field mapping ────────────────────────────────────────────────────────────────

/**
 * Map EDB English category or finance type to core.school_type values.
 */
function mapSchoolType(row) {
  const cat = (row['ENGLISH CATEGORY'] || '').toUpperCase();
  const fin = (row['FINANCE TYPE'] || '').toUpperCase();

  if (cat.includes('AIDED') || fin === 'AIDED') return 'aided';
  if (cat.includes('GOVERNMENT') || cat.includes('GOVT') || fin === 'GOVERNMENT') return 'govt';
  if (cat.includes('PRIVATE') || fin === 'PRIVATE') return 'private';
  if (cat.includes('DIRECT SUBSIDY') || cat.includes('DSS') || fin === 'DSS') return 'dss';
  if (cat.includes('ESF') || cat.includes('ENGLISH SCHOOLS FOUNDATION')) return 'esf';
  if (cat.includes('INTERNATIONAL')) return 'international';
  if (cat.includes('CAPUT')) return 'caput';
  return null;
}

/**
 * Map EDB school level category.
 */
function mapLevel(row) {
  const cat = (row['ENGLISH CATEGORY'] || '').toUpperCase();
  const lvl = (row['SCHOOL LEVEL'] || '').toUpperCase();

  if (cat.includes('KINDERGARTEN') || lvl.includes('KG') || lvl.includes('KINDERGARTEN')) return 'kindergarten';
  if (cat.includes('SPECIAL') || lvl.includes('SPECIAL')) return 'special';
  if (cat.includes('SECONDARY') || lvl.includes('SECONDARY')) return 'secondary';
  if (cat.includes('PRIMARY') || lvl.includes('PRIMARY')) return 'primary';
  return null;
}

/**
 * Normalize gender value.
 */
function mapGender(val) {
  if (!val) return null;
  const v = val.toUpperCase().trim();
  if (v === 'CO-ED') return 'coed';
  if (v === 'BOYS') return 'boys';
  if (v === 'GIRLS') return 'girls';
  return v.toLowerCase();
}

/**
 * Normalize session value.
 */
function mapSession(val) {
  if (!val) return null;
  const v = val.toUpperCase().trim();
  if (v === 'WHOLE DAY') return 'whole_day';
  if (v === 'AM') return 'am';
  if (v === 'PM') return 'pm';
  return v.toLowerCase();
}

// ── Public API ───────────────────────────────────────────────────────────────────

export async function syncSchoolMaster() {
  await registerSource({
    sourceName: SOURCE_NAME,
    sourceType: SOURCE_TYPE,
    endpoint: SOURCE_URL,
    updateFreq: 'monthly',
  });

  return runSync({
    sourceName: SOURCE_NAME,
    syncFn: async () => {
      // 1. Fetch the unified EDB JSON
      console.log('[sync] Fetching EDB school master...');
      const resp = await fetch(SOURCE_URL);
      if (!resp.ok) throw new Error(`EDB JSON fetch failed: ${resp.status}`);
      const text = await resp.text();
      const rows = JSON.parse(text);
      console.log(`[sync] Downloaded ${rows.length} schools`);

      // 2. Store raw payload
      const payload = JSON.stringify(rows);
      const hash = sha256(payload);

      await query(`DELETE FROM raw.school_master WHERE source_name = $1`, [SOURCE_NAME]);
      await query(
        `INSERT INTO raw.school_master (source_name, source_hash, payload) VALUES ($1, $2, $3)`,
        [SOURCE_NAME, hash, payload]
      );

      // 3. ETL to core.school — upsert each row
      let inserted = 0;
      for (const row of rows) {
        const code = row['SCHOOL NO.'];
        if (!code) { console.warn('[warn] row without SCHOOL NO.'); continue; }

        const lon = parseFloat(row['LONGITUDE']);
        const lat = parseFloat(row['LATITUDE']);
        const geom = (!isNaN(lon) && !isNaN(lat)) ? `SRID=4326;POINT(${lon} ${lat})` : null;

        await query(`
          INSERT INTO core.school (
            school_code, name_tc, name_en, level, school_type,
            district, address_tc, address_en, phone, website,
            gender, religion, geom, source_modified_at
          ) VALUES ($1,$2,$3,$4,$5, $6,$7,$8,$9,$10, $11,$12,
            CASE WHEN $13::text IS NOT NULL THEN ST_GeomFromEWKT($13::text) ELSE NULL END,
            NOW())
          ON CONFLICT (school_code) DO UPDATE SET
            name_tc       = EXCLUDED.name_tc,
            name_en       = EXCLUDED.name_en,
            level         = EXCLUDED.level,
            school_type   = EXCLUDED.school_type,
            district      = EXCLUDED.district,
            address_tc    = EXCLUDED.address_tc,
            address_en    = EXCLUDED.address_en,
            phone         = EXCLUDED.phone,
            website       = EXCLUDED.website,
            gender        = EXCLUDED.gender,
            religion      = EXCLUDED.religion,
            geom          = COALESCE(EXCLUDED.geom, core.school.geom),
            source_modified_at = NOW(),
            updated_at    = NOW()
        `, [
          code,
          row['中文名稱'] || null,
          row['ENGLISH NAME'] || null,
          mapLevel(row),
          mapSchoolType(row),
          row['DISTRICT'] || null,
          row['中文地址'] || null,
          row['ENGLISH ADDRESS'] || null,
          row['TELEPHONE'] || null,
          row['WEBSITE'] || null,
          mapGender(row['STUDENTS GENDER']),
          row['RELIGION'] || null,
          geom,
        ]);
        inserted++;
      }

      console.log(`[sync] Upserted ${inserted} schools into core.school`);
      return { hash, rows: inserted };
    },
  });
}

// ── CLI entry ────────────────────────────────────────────────────────────────────

async function main() {
  await registerSource({
    sourceName: SOURCE_NAME,
    sourceType: SOURCE_TYPE,
    endpoint: SOURCE_URL,
    updateFreq: 'monthly',
  });

  console.log('[sync] Starting school master sync...');
  const result = await syncSchoolMaster();
  console.log(`[sync] Done: ${result.status}, ${result.rows} schools synced`);
}

// ── CLI entry ────────────────────────────────────────────────────────────────────
// Only runs when this file is the entry point (not when imported by index.js)
if (process.argv[1]?.includes('csdi_school_master')) {
  main().catch(err => {
    console.error('[sync] Fatal error:', err);
    process.exit(1);
  });
}
