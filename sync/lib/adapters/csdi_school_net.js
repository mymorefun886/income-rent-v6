// adapters/csdi_school_net.js
// Sync adapter for school net assignments — POA (primary) and SSPA (secondary).
//
// POA: 36 polygon boundaries from CSDI. School→net via spatial join (ST_Within).
// SSPA: 394 school records from CSDI, each with SCH_CODE + net code.
// Also uses the POA CSV for net area reference.

import { registerSource, runSync, sha256 } from '../sync_engine.js';
import { query } from '../db.js';

const SOURCE_NAME = 'csdi_school_net';
const MAX_FEATURES = 10000;

// ── CSDI query ─────────────────────────────────────────────────────────────────

async function fetchCsdiLayer(csdiId) {
  let allFeatures = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      f: 'geojson', where: '1=1', outFields: '*',
      returnGeometry: 'true', outSR: '4326',
      resultOffset: String(offset), resultRecordCount: String(MAX_FEATURES),
    });
    const url = `https://portal.csdi.gov.hk/server/rest/services/common/${csdiId}/FeatureServer/0/query?${params}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`CSDI ${csdiId} failed: ${resp.status}`);
    const data = await resp.json();
    const features = data.features || [];
    allFeatures = allFeatures.concat(features);
    if (features.length < MAX_FEATURES) break;
    offset += MAX_FEATURES;
  }
  return allFeatures;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function syncSchoolNet() {
  // Ensure source is registered before sync
  await registerSource({
    sourceName: SOURCE_NAME,
    sourceType: 'csdi_arcgis',
    endpoint: 'edb_rcd_1633320960920_77011 (POA) + edb_rcd_1633321165670_11194 (SSPA)',
    updateFreq: 'annual',
  });

  return runSync({
    sourceName: SOURCE_NAME,
    syncFn: async () => {
      let totalInserted = 0;

      // ─── 1. SSPA: school-level records with direct net assignment ──────────
      console.log('[sync] Fetching SSPA school net data...');
      const sspaFeatures = await fetchCsdiLayer('edb_rcd_1633321165670_11194');
      console.log(`[sync] SSPA: ${sspaFeatures.length} features`);

      // Store in raw
      const sspaPayload = JSON.stringify(sspaFeatures);
      await query(`DELETE FROM raw.school_net WHERE source_name = 'csdi_sspa_net'`);
      await query(
        `INSERT INTO raw.school_net (source_name, source_hash, payload) VALUES ('csdi_sspa_net', $1, $2)`,
        [sha256(sspaPayload), sspaPayload]
      );

      // ETL: SSPA uses 6-digit Sch Code → lookup via core.school_alias for EDB school_code.
      // CSDI field mapping: NAME_EN = SSPA Sch Code, ADDRESS_EN = school name, SEARCH02_EN = net code.
      console.log('[sync] SSPA: building net assignments via alias lookup...');

      // Remove old SSPA assignments for this sync cycle (idempotent re-sync)
      await query(`DELETE FROM core.school_net WHERE net_type = 'SSPA'`);

      let sspaInserted = 0;
      let sspaSkipped = 0;
      const sspaSkippedSamples = [];

      // Batch lookup: collect all SSPA codes, fetch aliases in one query
      const sspaCodes = sspaFeatures
        .map(f => f.properties?.NAME_EN)
        .filter(Boolean);

      const aliasMap = new Map();
      if (sspaCodes.length > 0) {
        // Build IN clause with numbered params
        const placeholders = sspaCodes.map((_, i) => '$' + (i + 1));
        const aliasResult = await query(
          `SELECT external_id, school_code FROM core.school_alias WHERE source_name = 'sspa' AND external_id IN (${placeholders.join(',')})`,
          sspaCodes
        );
        for (const row of aliasResult.rows) {
          aliasMap.set(row.external_id, row.school_code);
        }
      }
      console.log(`[sync] SSPA: ${aliasMap.size} aliases found for ${sspaCodes.length} codes`);

      for (const f of sspaFeatures) {
        const sspaCode = f.properties?.NAME_EN;
        const netCode = f.properties?.SEARCH02_EN;
        if (!sspaCode || !netCode || netCode === '-') continue;

        const schoolCode = aliasMap.get(sspaCode);
        if (!schoolCode) {
          sspaSkipped++;
          if (sspaSkippedSamples.length < 5) {
            sspaSkippedSamples.push(`${sspaCode} (${f.properties?.ADDRESS_EN})`);
          }
          continue;
        }

        await query(`
          INSERT INTO core.school_net (school_code, net_type, net_code)
          VALUES ($1, 'SSPA', $2)
          ON CONFLICT (school_code, net_type, net_code) DO NOTHING
        `, [schoolCode, netCode]);
        sspaInserted++;
      }

      console.log(`[sync] SSPA: ${sspaInserted} inserted, ${sspaSkipped} skipped (no alias)`);
      if (sspaSkippedSamples.length > 0) {
        console.log(`[sync] SSPA skipped examples: ${sspaSkippedSamples.join(', ')}`);
      }
      totalInserted += sspaInserted;

      // ─── 2. POA: spatial join with boundary polygons ─────────────────────
      console.log('[sync] Fetching POA net boundaries...');
      const poaFeatures = await fetchCsdiLayer('edb_rcd_1633320960920_77011');
      console.log(`[sync] POA: ${poaFeatures.length} net boundaries`);

      // Store in raw
      const poaPayload = JSON.stringify(poaFeatures);
      await query(`DELETE FROM raw.school_net WHERE source_name = 'csdi_poa_net'`);
      await query(
        `INSERT INTO raw.school_net (source_name, source_hash, payload) VALUES ('csdi_poa_net', $1, $2)`,
        [sha256(poaPayload), poaPayload]
      );

      // ETL: spatial join — for each POA boundary, find primary schools inside.
      // Remove old POA assignments first for idempotent re-sync.
      await query(`DELETE FROM core.school_net WHERE net_type = 'POA'`);
      console.log('[sync] POA: running spatial join...');
      let poaInserted = 0;
      for (const f of poaFeatures) {
        const netCode = f.properties?.NAME;
        if (!netCode || !f.geometry) continue;

        // Use ST_Within: find all primary schools inside this net polygon
        const result = await query(`
          INSERT INTO core.school_net (school_code, net_type, net_code)
          SELECT s.school_code, 'POA', $2
          FROM core.school s
          WHERE s.level = 'primary'
            AND s.geom IS NOT NULL
            AND ST_Within(
              s.geom,
              ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)
            )
          ON CONFLICT (school_code, net_type, net_code) DO NOTHING
          RETURNING school_code
        `, [JSON.stringify(f.geometry), netCode]);

        poaInserted += (result.rowCount ?? 0);
      }
      console.log(`[sync] POA: ${poaInserted} net assignments`);

      totalInserted += poaInserted;

      return {
        hash: sha256(`school_net:sspa=${sspaFeatures.length},poa=${poaFeatures.length},inserted=${totalInserted}`),
        rows: totalInserted,
      };
    },
  });
}

// ── CLI entry ──────────────────────────────────────────────────────────────────

async function main() {
  await registerSource({
    sourceName: SOURCE_NAME,
    sourceType: 'csdi_arcgis',
    endpoint: 'edb_rcd_1633320960920_77011 (POA) + edb_rcd_1633321165670_11194 (SSPA)',
    updateFreq: 'annual',
  });
  console.log('[sync] Starting school net sync...');
  const result = await syncSchoolNet();
  console.log(`[sync] Done: ${result.status}, ${result.rows} net assignments synced`);
}

if (process.argv[1]?.includes('csdi_school_net')) {
  main().catch(err => { console.error('[sync] Fatal:', err); process.exit(1); });
}
