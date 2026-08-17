// Check V4 for meter reading templates or patterns
import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:D:/Cowork/Claude Code/income-rent-v5/v4-rental.db' });

async function main() {
  // Check if there's any template-related table
  const tables = await db.execute(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND (name LIKE '%template%' OR name LIKE '%config%' OR name LIKE '%setting%')
  `);
  console.log('=== Template/Config Tables ===');
  console.log(tables.rows.map((r: any) => r.name));

  // Check settings_kv for meter-related settings
  const settings = await db.execute(`SELECT * FROM settings_kv`);
  console.log('\n=== settings_kv ===');
  console.log(JSON.stringify(settings.rows, null, 2));

  // Check if meterReadings has any template-like data
  // Look for records with same building+room across cycles (template pattern)
  const readings = await db.execute(`SELECT * FROM meterReadings`);
  const parsed = readings.rows.map((r: any) => {
    try {
      return JSON.parse(r.data);
    } catch {
      return {};
    }
  });

  // Group by building+room to see patterns
  const grouped: Record<string, any[]> = {};
  for (const r of parsed) {
    const key = `${r.building}::${r.room}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  // Show a sample group
  const sampleKey = Object.keys(grouped)[0];
  console.log(`\n=== Sample group: ${sampleKey} ===`);
  console.log(JSON.stringify(grouped[sampleKey], null, 2));

  // Check for source field patterns
  const sources = [...new Set(parsed.map((r: any) => r.source).filter(Boolean))];
  console.log('\n=== Sources ===');
  console.log(sources);

  await db.close();
}

main().catch(console.error);
