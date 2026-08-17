// Migration script: Add new columns to work_orders table
import { createClient } from '@libsql/client';
import { resolve } from 'path';

const DB_PATH = resolve(process.cwd(), 'storage/rental.db');
console.log('[Migration] DB path:', DB_PATH);

async function migrate() {
  const client = createClient({ url: `file:${DB_PATH}` });

  console.log('[Migration] Starting work_orders table migration...');

  // Check current columns
  const result = await client.execute('PRAGMA table_info(work_orders)');
  const existingColumns = result.rows.map(r => r.name);

  console.log('[Migration] Existing columns:', existingColumns.join(', '));

  // New columns to add
  const newColumns = [
    { name: 'scope', type: 'text', defaultValue: "'single'" },
    { name: 'building', type: 'text', defaultValue: null },
    { name: 'repair_date', type: 'text', defaultValue: null },
    { name: 'worker_name', type: 'text', defaultValue: null },
    { name: 'worker_phone', type: 'text', defaultValue: null },
    { name: 'labor_cost', type: 'real', defaultValue: '0' },
    { name: 'material_cost', type: 'real', defaultValue: '0' },
    { name: 'total_cost', type: 'real', defaultValue: '0' },
  ];

  for (const col of newColumns) {
    if (!existingColumns.includes(col.name)) {
      const defaultClause = col.defaultValue !== null ? `DEFAULT ${col.defaultValue}` : '';
      const sql = `ALTER TABLE work_orders ADD COLUMN ${col.name} ${col.type} ${defaultClause}`;
      console.log(`[Migration] Adding column: ${col.name}`);
      await client.execute(sql);
    } else {
      console.log(`[Migration] Column already exists: ${col.name}`);
    }
  }

  console.log('[Migration] Migration completed!');

  // Verify
  const verify = await client.execute('PRAGMA table_info(work_orders)');
  console.log('[Migration] Updated columns:');
  verify.rows.forEach(c => console.log(`  ${c.name} (${c.type})`));

  await client.close();
}

migrate().catch(err => {
  console.error('[Migration] Error:', err);
  process.exit(1);
});
