// Database seed script
import { db, initDb } from './index.js';
import { users, properties, tenants, records } from '../db/schema.js';
import { hashPassword } from '../utils/auth.js';
import { randomUUID } from 'crypto';

async function seed() {
  console.log('[Seed] Starting database seed...');

  // Initialize tables
  await initDb();

  // Create admin user
  const adminId = randomUUID();
  const passwordHash = await hashPassword('changeme');
  await db.insert(users).values({
    id: adminId,
    username: 'admin',
    passwordHash,
    role: 'admin',
  }).onConflictDoNothing();
  console.log('[Seed] Admin user created (username: admin, password: changeme)');

  // Create sample property
  const propertyId = randomUUID();
  await db.insert(properties).values({
    id: propertyId,
    name: 'Sample Building',
    address: '123 Example St',
    areaSqm: 500,
  }).onConflictDoNothing();
  console.log('[Seed] Sample property created');

  // Create sample tenant
  const tenantId = randomUUID();
  await db.insert(tenants).values({
    id: tenantId,
    name: 'John Doe',
    phone: '13800138000',
    propertyId,
    roomLabel: 'A101',
    depositAmount: 2000,
    leaseStart: new Date('2026-01-01'),
    leaseEnd: new Date('2026-12-31'),
  }).onConflictDoNothing();
  console.log('[Seed] Sample tenant created');

  // Create sample record
  await db.insert(records).values({
    id: randomUUID(),
    tenantId,
    cycle: '2026-08',
    receivable: 3000,
    received: 0,
    status: 'unpaid',
    dueDate: new Date('2026-08-05'),
  }).onConflictDoNothing();
  console.log('[Seed] Sample record created');

  console.log('[Seed] ✅ Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
