// Inspect V4 meter tables
import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:D:/Cowork/Claude Code/income-rent-v5/v4-rental.db' });

async function main() {
  // Get all table schemas
  const tables = ['meterTasks', 'meterDrafts', 'meterReadings'];

  for (const name of tables) {
    const schema = await db.execute(`SELECT sql FROM sqlite_master WHERE name='${name}'`);
    console.log(`\n=== ${name} Schema ===`);
    console.log(schema.rows[0]?.sql);

    // Get sample data
    const data = await db.execute(`SELECT * FROM ${name} LIMIT 3`);
    console.log(`\n--- Sample data (${data.rows.length} rows) ---`);
    console.log(JSON.stringify(data.rows, null, 2));
  }

  // Check settings_kv for meter templates
  const settings = await db.execute(`SELECT * FROM settings_kv WHERE key LIKE '%meter%' OR key LIKE '%template%'`);
  if (settings.rows.length > 0) {
    console.log('\n=== Meter/Template Settings ===');
    console.log(JSON.stringify(settings.rows, null, 2));
  }

  await db.close();
}

main().catch(console.error);
