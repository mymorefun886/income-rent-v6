// Database validation script - Check data integrity
// Usage: pnpm exec tsx src/scripts/validate.ts
import { config } from 'dotenv';
config();

import { db } from '../db';
import { properties, tenants, records, contracts, payments, expenses, workOrders, meterTasks, meterReadings } from '../db/schema';
import { eq, isNull, isNotNull, sql } from 'drizzle-orm';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: Record<string, number>;
}

export async function validateDatabase(): Promise<ValidationResult> {
  console.log('[Validate] Running database validation...\n');

  const errors: string[] = [];
  const warnings: string[] = [];
  const stats: Record<string, number> = {};

  // ── Count records ──
  const propertyCount = await db.query.properties.count();
  const tenantCount = await db.query.tenants.count();
  const recordCount = await db.query.records.count();
  const contractCount = await db.query.contracts.count();
  const paymentCount = await db.query.payments.count();
  const expenseCount = await db.query.expenses.count();
  const workOrderCount = await db.query.workOrders.count();

  stats.properties = propertyCount;
  stats.tenants = tenantCount;
  stats.records = recordCount;
  stats.contracts = contractCount;
  stats.payments = paymentCount;
  stats.expenses = expenseCount;
  stats.workOrders = workOrderCount;

  // ── Validate properties ──
  const propertiesWithoutName = await db.query.properties.findMany();
  for (const p of propertiesWithoutName) {
    if (!p.name || p.name.trim() === '') {
      errors.push(`Property ${p.id} has empty name`);
    }
  }

  // ── Validate tenants ──
  const allTenants = await db.query.tenants.findMany();
  for (const t of allTenants) {
    if (!t.name || t.name.trim() === '') {
      errors.push(`Tenant ${t.id} has empty name`);
    }
    // Check if property exists
    if (t.propertyId) {
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, t.propertyId),
      });
      if (!property) {
        errors.push(`Tenant ${t.id} references non-existent property ${t.propertyId}`);
      }
    }
  }

  // ── Validate records ──
  const allRecords = await db.query.records.findMany();
  for (const r of allRecords) {
    if (r.receivable < 0) {
      errors.push(`Record ${r.id} has negative receivable`);
    }
    if (r.received < 0) {
      errors.push(`Record ${r.id} has negative received`);
    }
    if (r.received > r.receivable) {
      warnings.push(`Record ${r.id} has received > receivable`);
    }
    // Check if tenant exists
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, r.tenantId),
    });
    if (!tenant) {
      errors.push(`Record ${r.id} references non-existent tenant ${r.tenantId}`);
    }
  }

  // ── Validate contracts ──
  const allContracts = await db.query.contracts.findMany();
  for (const c of allContracts) {
    if (c.rent < 0) {
      errors.push(`Contract ${c.id} has negative rent`);
    }
    if (c.startDate && c.endDate && c.startDate > c.endDate) {
      errors.push(`Contract ${c.id} has start date after end date`);
    }
  }

  // ── Validate payments ──
  const allPayments = await db.query.payments.findMany();
  for (const p of allPayments) {
    if (p.amount <= 0) {
      warnings.push(`Payment ${p.id} has zero or negative amount`);
    }
  }

  // ── Validate expenses ──
  const allExpenses = await db.query.expenses.findMany();
  for (const e of allExpenses) {
    if (e.amount <= 0) {
      warnings.push(`Expense ${e.id} has zero or negative amount`);
    }
  }

  // ── Print results ──
  console.log('Statistics:');
  for (const [table, count] of Object.entries(stats)) {
    console.log(`  ${table}: ${count}`);
  }

  console.log(`\nErrors: ${errors.length}`);
  for (const error of errors.slice(0, 10)) {
    console.log(`  ✗ ${error}`);
  }
  if (errors.length > 10) {
    console.log(`  ... and ${errors.length - 10} more`);
  }

  console.log(`\nWarnings: ${warnings.length}`);
  for (const warning of warnings.slice(0, 10)) {
    console.log(`  ⚠ ${warning}`);
  }
  if (warnings.length > 10) {
    console.log(`  ... and ${warnings.length - 10} more`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

// CLI
async function main() {
  try {
    const result = await validateDatabase();
    process.exit(result.valid ? 0 : 1);
  } catch (err) {
    console.error('[Validate] Error:', err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default validateDatabase;
