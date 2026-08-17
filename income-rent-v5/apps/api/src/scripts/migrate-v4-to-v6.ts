// V4 to V6 Migration Script
// Migrates data from V4 database to V6 schema
import { createClient } from '@libsql/client';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

// V4 Database path - use environment variable or default
const V4_DB_PATH = process.env.V4_DB_PATH || '../v4-rental.db';
const V6_DB_PATH = process.env.V6_DB_PATH || './storage/rental.db';

// V4 Client
const v4AbsolutePath = resolve(process.cwd(), V4_DB_PATH);
const v4DbUrl = pathToFileURL(v4AbsolutePath).href;
const v4Client = createClient({ url: v4DbUrl });

// V6 Client
const v6AbsolutePath = resolve(process.cwd(), V6_DB_PATH);
const v6DbUrl = pathToFileURL(v6AbsolutePath).href;
const v6Client = createClient({ url: v6DbUrl });

// Helper to safely parse JSON
function safeJsonParse(str: string | null | undefined, defaultValue: any = null): any {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

// Helper to safely convert to number
function safeNumber(val: any, defaultValue: number = 0): number {
  if (val === null || val === undefined || val === '') return defaultValue;
  const num = Number(val);
  return isNaN(num) ? defaultValue : num;
}

// Helper to safely convert to boolean
function safeBoolean(val: any, defaultValue: boolean = false): boolean {
  if (val === null || val === undefined) return defaultValue;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    return val === 'true' || val === '1' || val === 'yes';
  }
  return defaultValue;
}

// Helper to normalize date
function normalizeDate(val: any): string | null {
  if (!val || val === '-' || val === '0') return null;
  try {
    const date = new Date(val);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

export async function migrateV4ToV6() {
  console.log('[MIGRATE] Starting V4 to V6 migration...');

  // ── Step 1: Migrate Users ──
  console.log('[MIGRATE] Migrating users...');
  const v4Users = await v4Client.execute('SELECT * FROM user');
  for (const row of v4Users.rows) {
    const userData = safeJsonParse(row.data as string, {});
    const passwordHash = userData.passwordHash || bcrypt.hashSync('changeme', 12);

    await v6Client.execute(`
      INSERT OR REPLACE INTO users (id, username, password_hash, name, role, portfolio, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      row.id as string,
      userData.username || 'morefun886',
      passwordHash,
      userData.name || null,
      userData.role || 'admin',
      userData.portfolio || null,
      row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
    ]);
  }
  console.log(`[MIGRATE] Migrated ${v4Users.rows.length} users`);

  // ── Step 2: Migrate Properties ──
  console.log('[MIGRATE] Migrating properties...');
  const v4Properties = await v4Client.execute('SELECT * FROM properties');
  for (const row of v4Properties.rows) {
    const data = safeJsonParse(row.data as string, {});

    await v6Client.execute(`
      INSERT OR REPLACE INTO properties (
        id, building, room, floor, total_floor, layout, title, address, area,
        rent, display_rent, usage_type, property_type, bank_account, status,
        no_water_meter, is_whole_building, tenant_name, tenant_phone,
        contract_end, balance, room_configs, room_inventory, tags, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      row.id as string,
      data.building || row.building || null,
      data.room || row.room || null,
      safeNumber(data.floor),
      safeNumber(data.totalFloor),
      data.layout || null,
      data.title || null,
      data.address || null,
      safeNumber(data.area),
      safeNumber(data.rent),
      safeNumber(data.displayRent),
      data.usageType || null,
      data.propertyType || null,
      data.bankAccount || null,
      data.status || row.status || '空置',
      safeBoolean(data.noWaterMeter) ? 1 : 0,
      safeBoolean(data.isWholeBuilding) ? 1 : 0,
      data.tenantName || null,
      data.tenantPhone || null,
      data.contractEnd && data.contractEnd !== '-' ? data.contractEnd : null,
      safeNumber(data.balance),
      data.roomConfigs ? JSON.stringify(data.roomConfigs) : null,
      data.roomInventory ? JSON.stringify(data.roomInventory) : null,
      data.tags ? JSON.stringify(data.tags) : null,
      data.notes || null,
      row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
      row.updated_at ? new Date(row.updated_at as string).toISOString() : new Date().toISOString(),
    ]);
  }
  console.log(`[MIGRATE] Migrated ${v4Properties.rows.length} properties`);

  // ── Step 3: Migrate Tenants ──
  console.log('[MIGRATE] Migrating tenants...');
  const v4Tenants = await v4Client.execute('SELECT * FROM tenants');
  for (const row of v4Tenants.rows) {
    const data = safeJsonParse(row.data as string, {});

    await v6Client.execute(`
      INSERT OR REPLACE INTO tenants (
        id, name, phone, id_no, building, room, property_id, room_label,
        rent, deposit, lease_start, lease_end, wechat_remark, wechat_group_name,
        id_card_front, id_card_back, fee_items, status, remind, archived, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      row.id as string,
      data.name || row.name || 'Unknown',
      data.phone || null,
      data.idNo || null,
      data.building || row.building || null,
      data.room || row.room || null,
      data.propertyId || null,
      data.roomLabel || null,
      safeNumber(data.rent),
      safeNumber(data.deposit),
      data.leaseStart || null,
      data.leaseEnd && data.leaseEnd !== '-' ? data.leaseEnd : null,
      data.wechatRemark || null,
      data.wechatGroupName || null,
      data.idCardFront || null,
      data.idCardBack || null,
      data.feeItems ? JSON.stringify(data.feeItems) : null,
      data.status || row.status || '正常',
      safeBoolean(data.remind, true) ? 1 : 0,
      safeBoolean(data.archived) ? 1 : 0,
      data.notes || null,
      row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
      row.updated_at ? new Date(row.updated_at as string).toISOString() : new Date().toISOString(),
    ]);
  }
  console.log(`[MIGRATE] Migrated ${v4Tenants.rows.length} tenants`);

  // ── Step 4: Migrate Records ──
  console.log('[MIGRATE] Migrating records...');
  const v4Records = await v4Client.execute('SELECT * FROM records');
  for (const row of v4Records.rows) {
    const data = safeJsonParse(row.data as string, {});
    const roomKey = data.roomKey || [data.building, data.room].filter(Boolean).join('::');

    await v6Client.execute(`
      INSERT OR REPLACE INTO records (
        id, tenant_id, tenant_name, building, room, room_no, room_key, cycle,
        rent_part, receivable, received, status, sent_status, sent_at, due_date,
        paid_at, method, notes, electric_prev, electric_now, electric_usage,
        electric_price, electric_cost, water_prev, water_now, water_usage,
        water_price, water_minimum_charge, water_cost, no_water_meter,
        property_fee, network_fee, garbage_fee, other_fee, deposit_adjustment,
        deposit_amount, deposit_refund, deposit_deduct, checkout, payments,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      row.id as string,
      data.tenantId || row.tenant_id || null,
      data.tenant || row.tenant_name || null,
      data.building || row.building || null,
      data.room || row.room || null,
      data.roomNo || null,
      roomKey,
      data.cycle || row.cycle || 'unknown',
      safeNumber(data.rentPart),
      safeNumber(data.receivable),
      safeNumber(data.received),
      data.status || row.status || '未收',
      data.sentStatus || 'unsent',
      data.sentAt || null,
      data.dueDate || null,
      data.paidAt && data.paidAt !== '-' ? data.paidAt : null,
      data.method || null,
      data.note || data.notes || null,
      data.electricPrev?.toString() || null,
      data.electricNow?.toString() || null,
      data.electricUsage?.toString() || null,
      data.electricPrice?.toString() || null,
      safeNumber(data.electricCost),
      data.waterPrev?.toString() || null,
      data.waterNow?.toString() || null,
      data.waterUsage?.toString() || null,
      data.waterPrice?.toString() || null,
      data.waterMinimumCharge?.toString() || null,
      safeNumber(data.waterCost),
      safeBoolean(data.noWaterMeter || row.no_water_meter) ? 1 : 0,
      data.propertyFee?.toString() || '0',
      data.networkFee?.toString() || '0',
      data.garbageFee?.toString() || '0',
      data.otherFee?.toString() || '0',
      data.depositAdjustment?.toString() || '0',
      safeNumber(data.depositAmount),
      safeNumber(data.depositRefund),
      safeNumber(data.depositDeduct),
      safeBoolean(data.checkout) ? 1 : 0,
      data.payments ? JSON.stringify(data.payments) : null,
      row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
      row.updated_at ? new Date(row.updated_at as string).toISOString() : new Date().toISOString(),
    ]);
  }
  console.log(`[MIGRATE] Migrated ${v4Records.rows.length} records`);

  // ── Step 5: Migrate Expenses ──
  console.log('[MIGRATE] Migrating expenses...');
  const v4Expenses = await v4Client.execute('SELECT * FROM expenses');
  for (const row of v4Expenses.rows) {
    const data = safeJsonParse(row.data as string, {});

    await v6Client.execute(`
      INSERT OR REPLACE INTO expenses (
        id, date, period, property_id, property_label, room, category,
        amount, payee, payment_method, allocation_mode, shared_by_rooms,
        source_bill_id, work_order_id, invoice_no, note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      row.id as string,
      data.date || row.date || null,
      data.period || row.period || null,
      data.propertyId || row.property_id || null,
      data.propertyLabel || null,
      data.room || null,
      data.category || row.category || '其他',
      safeNumber(data.amount),
      data.payee || null,
      data.paymentMethod || null,
      data.allocationMode || null,
      data.sharedByRooms ? JSON.stringify(data.sharedByRooms) : null,
      data.sourceBillId || null,
      data.workOrderId || null,
      data.invoiceNo || null,
      data.note || null,
      row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
      row.updated_at ? new Date(row.updated_at as string).toISOString() : new Date().toISOString(),
    ]);
  }
  console.log(`[MIGRATE] Migrated ${v4Expenses.rows.length} expenses`);

  // ── Step 6: Migrate Work Orders ──
  console.log('[MIGRATE] Migrating work orders...');
  const v4WorkOrders = await v4Client.execute('SELECT * FROM workOrders');
  for (const row of v4WorkOrders.rows) {
    const data = safeJsonParse(row.data as string, {});

    await v6Client.execute(`
      INSERT OR REPLACE INTO work_orders (
        id, title, description, status, priority, type, property_id,
        property_label, room, scope, buildings, photos, assigned_to,
        cost_estimate, amount, expense_id, date, period, payee, payment_method,
        invoice_no, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      row.id as string,
      data.title || null,
      data.description || null,
      data.status || row.status || 'open',
      data.priority || 'normal',
      data.type || null,
      data.propertyId || row.property_id || null,
      data.propertyLabel || null,
      data.room || null,
      data.scope || 'single',
      data.buildings ? JSON.stringify(data.buildings) : null,
      data.photos ? JSON.stringify(data.photos) : null,
      data.assignedTo || null,
      safeNumber(data.costEstimate),
      safeNumber(data.amount),
      data.expenseId || null,
      data.date || null,
      data.period || null,
      data.payee || null,
      data.paymentMethod || null,
      data.invoiceNo || null,
      row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
      row.updated_at ? new Date(row.updated_at as string).toISOString() : new Date().toISOString(),
    ]);
  }
  console.log(`[MIGRATE] Migrated ${v4WorkOrders.rows.length} work orders`);

  // ── Step 7: Migrate Meter Drafts ──
  console.log('[MIGRATE] Migrating meter drafts...');
  const v4MeterDrafts = await v4Client.execute('SELECT * FROM meterDrafts');
  for (const row of v4MeterDrafts.rows) {
    const data = safeJsonParse(row.data as string, {});

    await v6Client.execute(`
      INSERT OR REPLACE INTO meter_drafts (
        id, building, room, cycle, electric_now, water_now, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      row.id as string,
      data.building || null,
      data.room || null,
      data.cycle || null,
      data.electricNow?.toString() || null,
      data.waterNow?.toString() || null,
      row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
      row.updated_at ? new Date(row.updated_at as string).toISOString() : new Date().toISOString(),
    ]);
  }
  console.log(`[MIGRATE] Migrated ${v4MeterDrafts.rows.length} meter drafts`);

  // ── Step 8: Migrate Meter Readings ──
  console.log('[MIGRATE] Migrating meter readings...');
  const v4MeterReadings = await v4Client.execute('SELECT * FROM meterReadings');
  for (const row of v4MeterReadings.rows) {
    const data = safeJsonParse(row.data as string, {});

    await v6Client.execute(`
      INSERT OR REPLACE INTO meter_readings (
        id, task_id, property_id, room, period, reading, usage, rate,
        photo_url, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      row.id as string,
      data.taskId || null,
      data.propertyId || null,
      data.room || null,
      data.period || null,
      safeNumber(data.reading),
      safeNumber(data.usage),
      safeNumber(data.rate),
      data.photoUrl || null,
      data.note || null,
      row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
    ]);
  }
  console.log(`[MIGRATE] Migrated ${v4MeterReadings.rows.length} meter readings`);

  // ── Step 9: Migrate Transactions ──
  console.log('[MIGRATE] Migrating transactions...');
  const v4Transactions = await v4Client.execute('SELECT * FROM transactions');
  for (const row of v4Transactions.rows) {
    const data = safeJsonParse(row.data as string, {});

    await v6Client.execute(`
      INSERT OR REPLACE INTO transactions (
        id, amount, type, status, matched_record_id, tenant_id, note,
        operator, auto_created, created_at, description, counterparty, reference
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      row.id as string,
      safeNumber(data.amount),
      data.type || null,
      data.status || 'unmatched',
      data.matchedRecordId || null,
      data.tenantId || null,
      data.note || null,
      data.operator || null,
      safeBoolean(data.autoCreated) ? 1 : 0,
      row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
      data.description || null,
      data.counterparty || null,
      data.reference || null,
    ]);
  }
  console.log(`[MIGRATE] Migrated ${v4Transactions.rows.length} transactions`);

  // ── Step 10: Migrate Message Logs ──
  console.log('[MIGRATE] Migrating message logs...');
  const v4MessageLogs = await v4Client.execute('SELECT * FROM messageLogs');
  for (const row of v4MessageLogs.rows) {
    const data = safeJsonParse(row.data as string, {});

    await v6Client.execute(`
      INSERT OR REPLACE INTO message_logs (
        id, record_id, tenant_id, target_group, operator, status, sent_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      row.id as string,
      data.recordId || null,
      data.tenantId || null,
      data.targetGroup || null,
      data.operator || null,
      data.status || 'sent',
      data.sentAt || null,
      row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
    ]);
  }
  console.log(`[MIGRATE] Migrated ${v4MessageLogs.rows.length} message logs`);

  // ── Step 11: Migrate Reminders ──
  console.log('[MIGRATE] Migrating reminders...');
  const v4Reminders = await v4Client.execute('SELECT * FROM reminders');
  for (const row of v4Reminders.rows) {
    const data = safeJsonParse(row.data as string, {});

    await v6Client.execute(`
      INSERT OR REPLACE INTO reminders (
        id, tenant_id, room, days_before, remind_time, due_date, enabled,
        last_triggered_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      row.id as string,
      data.tenantId || null,
      data.room || null,
      safeNumber(data.daysBefore, 30),
      data.remindTime || '09:00',
      data.dueDate || null,
      safeBoolean(data.enabled, true) ? 1 : 0,
      data.lastTriggeredAt || null,
      row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
      row.updated_at ? new Date(row.updated_at as string).toISOString() : new Date().toISOString(),
    ]);
  }
  console.log(`[MIGRATE] Migrated ${v4Reminders.rows.length} reminders`);

  // ── Step 12: Migrate Settings ──
  console.log('[MIGRATE] Migrating settings...');
  const v4Settings = await v4Client.execute('SELECT * FROM settings_kv');
  for (const row of v4Settings.rows) {
    await v6Client.execute(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
    `, [
      row.key as string,
      row.value as string,
      new Date().toISOString(),
    ]);
  }
  console.log(`[MIGRATE] Migrated ${v4Settings.rows.length} settings`);

  // ── Step 13: Migrate Audit Logs ──
  console.log('[MIGRATE] Migrating audit logs...');
  const v4AuditLogs = await v4Client.execute('SELECT * FROM auditLogs');
  for (const row of v4AuditLogs.rows) {
    const data = safeJsonParse(row.data as string, {});

    await v6Client.execute(`
      INSERT OR REPLACE INTO audit_logs (
        id, action, entity_type, entity_id, user_id, username, operator,
        details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      row.id as string,
      data.action || row.action || 'unknown',
      data.entityType || null,
      data.entityId || null,
      data.userId || null,
      data.username || null,
      data.operator || null,
      data.detail ? JSON.stringify(data.detail) : null,
      row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
    ]);
  }
  console.log(`[MIGRATE] Migrated ${v4AuditLogs.rows.length} audit logs`);

  console.log('[MIGRATE] V4 to V6 migration completed successfully!');
}

// Run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateV4ToV6().catch(console.error);
}
