// Database backup script
// Usage: pnpm exec tsx src/scripts/backup.ts [output-path]
import { config } from 'dotenv';
config();

import { db } from '../db';
import { users, properties, tenants, records, contracts, payments, expenses, workOrders, meterTasks, meterReadings, settings, auditLogs, sessions } from '../db/schema';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface BackupData {
  version: string;
  timestamp: string;
  data: Record<string, unknown[]>;
}

export async function backupDatabase(outputPath?: string): Promise<string> {
  console.log('[Backup] Starting database backup...');

  // Fetch all data
  const data = {
    properties: await db.query.properties.findMany(),
    tenants: await db.query.tenants.findMany(),
    records: await db.query.records.findMany(),
    contracts: await db.query.contracts.findMany(),
    payments: await db.query.payments.findMany(),
    expenses: await db.query.expenses.findMany(),
    workOrders: await db.query.workOrders.findMany(),
    meterTasks: await db.query.meterTasks.findMany(),
    meterReadings: await db.query.meterReadings.findMany(),
    settings: await db.query.settings.findMany(),
    auditLogs: await db.query.auditLogs.findMany(),
    // Exclude sessions and users for security
  };

  const backup: BackupData = {
    version: '5.0.0',
    timestamp: new Date().toISOString(),
    data,
  };

  // Generate filename
  const filename = outputPath || `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const fullPath = join(process.cwd(), filename);

  // Write to file
  writeFileSync(fullPath, JSON.stringify(backup, null, 2), 'utf-8');

  console.log(`[Backup] Saved to: ${fullPath}`);
  console.log(`[Backup] Tables backed up: ${Object.keys(data).length}`);

  // Print summary
  for (const [table, rows] of Object.entries(data)) {
    console.log(`  ${table}: ${(rows as unknown[]).length} rows`);
  }

  return fullPath;
}

// CLI
async function main() {
  const outputPath = process.argv[2];

  try {
    await backupDatabase(outputPath);
    process.exit(0);
  } catch (err) {
    console.error('[Backup] Error:', err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default backupDatabase;
