// Check V4 meter reading workflow - how templates are used
import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:D:/Cowork/Claude Code/income-rent-v5/v4-rental.db' });

async function main() {
  // Get all meterReadings with source='meter_sync' (likely from template-based entry)
  const meterSync = await db.execute(`SELECT * FROM meterReadings WHERE data LIKE '%meter_sync%'`);
  const parsed = meterSync.rows.map((r: any) => JSON.parse(r.data));

  console.log(`=== meter_sync records: ${parsed.length} ===`);

  // Group by createdAt to see batch entries (template pattern)
  const byDate: Record<string, any[]> = {};
  for (const r of parsed) {
    const date = r.createdAt?.split('T')[0] || 'unknown';
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(r);
  }

  // Show batch entries
  for (const [date, records] of Object.entries(byDate).slice(0, 3)) {
    console.log(`\n--- ${date} (${records.length} records) ---`);
    console.log(JSON.stringify(records.slice(0, 5), null, 2));
  }

  // Check meterDrafts for template pattern
  const drafts = await db.execute(`SELECT * FROM meterDrafts`);
  const draftParsed = drafts.rows.map((r: any) => JSON.parse(r.data));

  console.log(`\n=== meterDrafts: ${draftParsed.length} ===`);

  // Group drafts by cycle
  const draftsByCycle: Record<string, any[]> = {};
  for (const d of draftParsed) {
    if (!draftsByCycle[d.cycle]) draftsByCycle[d.cycle] = [];
    draftsByCycle[d.cycle].push(d);
  }

  for (const [cycle, records] of Object.entries(draftsByCycle)) {
    console.log(`\n--- Cycle ${cycle} (${records.length} drafts) ---`);
    console.log(JSON.stringify(records.slice(0, 3), null, 2));
  }

  await db.close();
}

main().catch(console.error);
