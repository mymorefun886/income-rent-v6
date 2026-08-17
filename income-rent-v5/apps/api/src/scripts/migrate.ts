// Data migration script - Migrate from V4 to V5
// Usage: pnpm exec tsx src/scripts/migrate.ts <v4-db-path>
import { config } from 'dotenv';
config();

import { createClient } from '@libsql/client';
import { db } from '../db/index.js';
import { users, properties, tenants, records, contracts, payments, expenses, workOrders, meterTasks, meterReadings } from '../db/schema.js';

interface MigrationOptions {
  v4DbPath: string;
  dryRun?: boolean;
}

interface MigrationResult {
  users: number;
  properties: number;
  tenants: number;
  records: number;
  expenses: number;
  workOrders: number;
  meterTasks: number;
  meterReadings: number;
  errors: string[];
}

// V4 uses JSON data columns - extract from data field when available
interface V4Entity {
  id: string;
  data?: string;
  [key: string]: unknown;
}

function parseV4Entity(row: V4Entity): Record<string, unknown> {
  if (row.data) {
    try {
      return JSON.parse(row.data);
    } catch {
      // If JSON parse fails, use row directly
    }
  }
  return row;
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function safeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

export async function migrateV4ToV5(options: MigrationOptions): Promise<MigrationResult> {
  const { v4DbPath, dryRun = false } = options;
  const errors: string[] = [];

  console.log(`[Migration] Starting V4 → V5 migration`);
  console.log(`[Migration] Source: ${v4DbPath}`);
  console.log(`[Migration] Dry run: ${dryRun}`);

  // Connect to V4 database
  const v4 = createClient({ url: `file:${v4DbPath}` });

  const result: MigrationResult = {
    users: 0,
    properties: 0,
    tenants: 0,
    records: 0,
    expenses: 0,
    workOrders: 0,
    meterTasks: 0,
    meterReadings: 0,
    errors: [],
  };

  try {
    // ── 1. Migrate Users ──
    console.log('\n[Migration] Step 1: Users');
    const v4Users = await v4.execute('SELECT * FROM user');

    for (const row of v4Users.rows as unknown as V4Entity[]) {
      try {
        const data = parseV4Entity(row);
        if (!dryRun) {
          await db.insert(users).values({
            id: safeString(data.id) || safeString(row.id),
            username: safeString(data.username) || 'unknown',
            passwordHash: safeString(data.password) || '',
            role: safeString(data.role) || 'viewer',
            createdAt: new Date(),
            lastLogin: null,
          });
        }
        result.users++;
        console.log(`  ✓ User: ${safeString(data.username)} (${safeString(data.role)})`);
      } catch (err) {
        const error = `User ${safeString(row.id)}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        errors.push(error);
        console.log(`  ✗ ${error}`);
      }
    }

    // ── 2. Migrate Properties ──
    console.log('\n[Migration] Step 2: Properties');
    const v4Properties = await v4.execute('SELECT * FROM properties');

    for (const row of v4Properties.rows as unknown as V4Entity[]) {
      try {
        const data = parseV4Entity(row);
        if (!dryRun) {
          const title = safeString(data.title) || safeString(data.building) + ' ' + safeString(data.room);
          await db.insert(properties).values({
            id: safeString(data.id) || safeString(row.id),
            name: title || 'Unknown Property',
            address: safeString(data.address) || safeString(row.address) || null,
            areaSqm: safeNumber(data.area) || null,
            notes: safeString(data.notes) || null,
            createdAt: safeDate(data.createdAt) || new Date(),
            updatedAt: safeDate(data.createdAt) || new Date(),
            createdBy: null,
          });
        }
        result.properties++;
        console.log(`  ✓ Property: ${safeString(data.title) || safeString(data.building)}`);
      } catch (err) {
        const error = `Property ${safeString(row.id)}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        errors.push(error);
        console.log(`  ✗ ${error}`);
      }
    }

    // ── 3. Migrate Tenants ──
    console.log('\n[Migration] Step 3: Tenants');
    const v4Tenants = await v4.execute('SELECT * FROM tenants');

    for (const row of v4Tenants.rows as unknown as V4Entity[]) {
      try {
        const data = parseV4Entity(row);
        if (!dryRun) {
          await db.insert(tenants).values({
            id: safeString(data.id) || safeString(row.id),
            name: safeString(data.name) || safeString(row.name) || 'Unknown',
            phone: safeString(data.phone) || safeString(row.phone) || null,
            idCard: safeString(data.idNo) || safeString(data.id_card) || null,
            propertyId: null, // V4 doesn't have direct property_id
            roomLabel: safeString(data.room) || safeString(row.room) || null,
            depositAmount: safeNumber(data.deposit),
            leaseStart: safeDate(data.leaseStart),
            leaseEnd: safeDate(data.leaseEnd),
            archived: data.archived === 1 || data.archived === true || row.archived === 1,
            createdAt: safeDate(data.createdAt) || new Date(),
            updatedAt: safeDate(data.createdAt) || new Date(),
          });
        }
        result.tenants++;
        console.log(`  ✓ Tenant: ${safeString(data.name)}`);
      } catch (err) {
        const error = `Tenant ${safeString(row.id)}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        errors.push(error);
        console.log(`  ✗ ${error}`);
      }
    }

    // ── 4. Migrate Records (Bills) ──
    console.log('\n[Migration] Step 4: Records');
    const v4Records = await v4.execute('SELECT * FROM records');

    for (const row of v4Records.rows as unknown as V4Entity[]) {
      try {
        const data = parseV4Entity(row);
        if (!dryRun) {
          await db.insert(records).values({
            id: safeString(data.id) || safeString(row.id),
            tenantId: safeString(data.tenantId) || null,
            cycle: safeString(data.cycle) || 'unknown',
            receivable: safeNumber(data.receivable),
            received: safeNumber(data.received),
            status: safeString(data.status) || 'unpaid',
            sentStatus: safeString(data.sentStatus) || safeString(data.sent) || 'unsent',
            dueDate: safeDate(data.dueDate),
            paidAt: safeDate(data.paidAt),
            method: safeString(data.method) || null,
            createdAt: safeDate(data.createdAt) || new Date(),
            updatedAt: safeDate(data.createdAt) || new Date(),
          });
        }
        result.records++;
      } catch (err) {
        const error = `Record ${safeString(row.id)}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        errors.push(error);
      }
    }
    console.log(`  ✓ Migrated ${result.records} records`);

    // ── 5. Migrate Expenses ──
    console.log('\n[Migration] Step 5: Expenses');
    const v4Expenses = await v4.execute('SELECT * FROM expenses');

    for (const row of v4Expenses.rows as unknown as V4Entity[]) {
      try {
        const data = parseV4Entity(row);
        if (!dryRun) {
          // V4 uses building names as propertyId, V5 uses UUIDs - set to null if not a valid UUID
          const v4PropertyId = safeString(data.propertyId) || safeString(data.property_id);
          const propertyId = v4PropertyId && v4PropertyId.startsWith('prop-') ? v4PropertyId : null;

          await db.insert(expenses).values({
            id: safeString(data.id) || safeString(row.id),
            date: safeDate(data.date) || new Date(),
            period: safeString(data.period) || null,
            propertyId: propertyId,
            roomLabel: safeString(data.room) || null,
            category: safeString(data.category) || 'Other',
            amount: safeNumber(data.amount),
            payee: safeString(data.payee) || null,
            paymentMethod: safeString(data.paymentMethod) || safeString(data.payment_method) || null,
            note: safeString(data.note) || safeString(data.notes) || null,
            workOrderId: safeString(data.workOrderId) || safeString(data.work_order_id) || null,
            invoiceNo: safeString(data.invoiceNo) || safeString(data.invoice_no) || null,
            createdAt: safeDate(data.createdAt) || new Date(),
            updatedAt: safeDate(data.updatedAt) || safeDate(data.createdAt) || new Date(),
          });
        }
        result.expenses++;
      } catch (err) {
        const error = `Expense ${safeString(row.id)}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        errors.push(error);
      }
    }
    console.log(`  ✓ Migrated ${result.expenses} expenses`);

    // ── 6. Migrate Work Orders ──
    console.log('\n[Migration] Step 6: Work Orders');
    const v4WorkOrders = await v4.execute('SELECT * FROM workOrders');

    for (const row of v4WorkOrders.rows as unknown as V4Entity[]) {
      try {
        const data = parseV4Entity(row);
        if (!dryRun) {
          await db.insert(workOrders).values({
            id: safeString(data.id) || safeString(row.id),
            title: safeString(data.title) || 'Work Order',
            description: safeString(data.description) || null,
            status: safeString(data.status) || 'open',
            priority: safeString(data.priority) || 'normal',
            propertyId: safeString(data.propertyId) || safeString(data.property_id) || null,
            roomLabel: safeString(data.room) || null,
            assignedTo: safeString(data.assignedTo) || safeString(data.assigned_to) || null,
            costEstimate: safeNumber(data.costEstimate) || safeNumber(data.cost_estimate),
            amount: safeNumber(data.amount),
            expenseId: safeString(data.expenseId) || safeString(data.expense_id) || null,
            createdAt: safeDate(data.createdAt) || new Date(),
            updatedAt: safeDate(data.createdAt) || new Date(),
          });
        }
        result.workOrders++;
      } catch (err) {
        const error = `WorkOrder ${safeString(row.id)}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        errors.push(error);
      }
    }
    console.log(`  ✓ Migrated ${result.workOrders} work orders`);

    // ── 7. Migrate Meter Tasks (from meterDrafts) ──
    console.log('\n[Migration] Step 7: Meter Tasks');
    const v4MeterDrafts = await v4.execute('SELECT * FROM meterDrafts');

    for (const row of v4MeterDrafts.rows as unknown as V4Entity[]) {
      try {
        const data = parseV4Entity(row);
        if (!dryRun) {
          await db.insert(meterTasks).values({
            id: safeString(data.id) || safeString(row.id),
            title: safeString(data.title) || null,
            period: safeString(data.period) || 'unknown',
            status: safeString(data.status) || 'pending',
            createdAt: safeDate(data.createdAt) || new Date(),
            updatedAt: safeDate(data.createdAt) || new Date(),
          });
        }
        result.meterTasks++;
      } catch (err) {
        const error = `MeterTask ${safeString(row.id)}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        errors.push(error);
      }
    }
    console.log(`  ✓ Migrated ${result.meterTasks} meter tasks`);

    // ── 8. Migrate Meter Readings ──
    console.log('\n[Migration] Step 8: Meter Readings');
    const v4MeterReadings = await v4.execute('SELECT * FROM meterReadings');

    for (const row of v4MeterReadings.rows as unknown as V4Entity[]) {
      try {
        const data = parseV4Entity(row);
        if (!dryRun) {
          await db.insert(meterReadings).values({
            id: safeString(data.id) || safeString(row.id),
            taskId: safeString(data.taskId) || safeString(data.task_id) || null,
            propertyId: safeString(data.propertyId) || safeString(data.property_id) || null,
            roomLabel: safeString(data.room) || null,
            reading: safeNumber(data.reading),
            usage: safeNumber(data.usage) || null,
            rate: safeNumber(data.rate) || null,
            photoUrl: safeString(data.photoUrl) || safeString(data.photo_url) || null,
            note: safeString(data.note) || null,
            createdAt: safeDate(data.createdAt) || new Date(),
          });
        }
        result.meterReadings++;
      } catch (err) {
        const error = `MeterReading ${safeString(row.id)}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        errors.push(error);
      }
    }
    console.log(`  ✓ Migrated ${result.meterReadings} meter readings`);

    result.errors = errors;

    // ── Summary ──
    console.log('\n═══════════════════════════════════════');
    console.log('Migration Summary:');
    console.log(`  Users:         ${result.users}`);
    console.log(`  Properties:    ${result.properties}`);
    console.log(`  Tenants:       ${result.tenants}`);
    console.log(`  Records:       ${result.records}`);
    console.log(`  Expenses:      ${result.expenses}`);
    console.log(`  Work Orders:   ${result.workOrders}`);
    console.log(`  Meter Tasks:   ${result.meterTasks}`);
    console.log(`  Meter Readings:${result.meterReadings}`);
    console.log(`  Errors:        ${errors.length}`);
    console.log('═══════════════════════════════════════');

    if (dryRun) {
      console.log('\n[Migration] DRY RUN - No changes were made');
    } else {
      console.log('\n[Migration] Migration completed!');
    }

  } finally {
    await v4.close();
  }

  return result;
}

// ── CLI Entry Point ──
async function main() {
  const args = process.argv.slice(2);
  const dbPath = args.find(a => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!dbPath) {
    console.error('Usage: pnpm --filter api db:import <v4-db-path> [--dry-run]');
    console.error('');
    console.error('Example:');
    console.error('  pnpm --filter api db:import ./v4-data.db --dry-run');
    console.error('  pnpm --filter api db:import ./v4-data.db');
    process.exit(1);
  }

  try {
    await migrateV4ToV5({ v4DbPath: dbPath, dryRun });
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Fatal error:', err);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default migrateV4ToV5;
