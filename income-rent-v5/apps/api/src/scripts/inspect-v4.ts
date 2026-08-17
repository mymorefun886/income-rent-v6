// Quick script to inspect V4 database
import { createClient } from '@libsql/client';

const dbPath = process.argv[2] || 'D:/Cowork/Claude Code/income-rent-v5/v4-rental.db';

async function main() {
  const db = createClient({ url: `file:${dbPath}` });

  // Get all tables
  const tables = await db.execute(`
    SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
  `);

  console.log('Tables in V4 database:');
  for (const row of tables.rows) {
    const tableName = row.name as string;
    const count = await db.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
    console.log(`  ${tableName}: ${count.rows[0].count} rows`);
  }

  await db.close();
}

main().catch(console.error);
