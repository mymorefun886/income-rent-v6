// V6 Database Initialization
const { createClient } = require('@libsql/client');
const { pathToFileURL } = require('url');
const { resolve } = require('path');

async function initDb() {
  const dbUrl = pathToFileURL(resolve('D:/Cowork/Claude Code/income-rent-v5/apps/api/storage/rental.db')).href;
  const client = createClient({ url: dbUrl });

  console.log('[DB] Initializing V6 database...');

  await client.execute('PRAGMA foreign_keys = ON');

  // Users
  await client.execute(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'viewer',
    portfolio TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    last_login INTEGER
  )`);

  // Properties
  await client.execute(`CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    building TEXT,
    room TEXT,
    floor INTEGER,
    total_floor INTEGER,
    layout TEXT,
    title TEXT,
    address TEXT,
    area REAL DEFAULT 0,
    rent REAL DEFAULT 0,
    display_rent REAL DEFAULT 0,
    usage_type TEXT,
    property_type TEXT,
    bank_account TEXT,
    status TEXT DEFAULT '空置',
    no_water_meter INTEGER DEFAULT 0,
    is_whole_building INTEGER DEFAULT 0,
    tenant_name TEXT,
    tenant_phone TEXT,
    contract_end TEXT,
    balance REAL DEFAULT 0,
    room_configs TEXT,
    room_inventory TEXT,
    tags TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT REFERENCES users(id)
  )`);
  console.log('[DB] Created properties table');

  // Tenants
  await client.execute(`CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    id_no TEXT,
    building TEXT,
    room TEXT,
    property_id TEXT REFERENCES properties(id),
    room_label TEXT,
    rent REAL DEFAULT 0,
    deposit REAL DEFAULT 0,
    lease_start TEXT,
    lease_end TEXT,
    wechat_remark TEXT,
    wechat_group_name TEXT,
    id_card_front TEXT,
    id_card_back TEXT,
    fee_items TEXT,
    status TEXT DEFAULT '正常',
    remind INTEGER DEFAULT 1,
    archived INTEGER DEFAULT 0,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`);

  // Records
  await client.execute(`CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id),
    tenant_name TEXT,
    building TEXT,
    room TEXT,
    room_no TEXT,
    room_key TEXT,
    cycle TEXT NOT NULL,
    rent_part REAL DEFAULT 0,
    receivable REAL NOT NULL,
    received REAL DEFAULT 0,
    status TEXT DEFAULT '未收',
    sent_status TEXT DEFAULT 'unsent',
    sent_at TEXT,
    due_date TEXT,
    paid_at TEXT,
    method TEXT,
    notes TEXT,
    electric_prev TEXT,
    electric_now TEXT,
    electric_usage TEXT,
    electric_price TEXT,
    electric_cost REAL,
    water_prev TEXT,
    water_now TEXT,
    water_usage TEXT,
    water_price TEXT,
    water_minimum_charge TEXT,
    water_cost REAL,
    no_water_meter INTEGER DEFAULT 0,
    property_fee TEXT DEFAULT '0',
    network_fee TEXT DEFAULT '0',
    garbage_fee TEXT DEFAULT '0',
    other_fee TEXT DEFAULT '0',
    deposit_adjustment TEXT DEFAULT '0',
    deposit_amount REAL DEFAULT 0,
    deposit_refund REAL DEFAULT 0,
    deposit_deduct REAL DEFAULT 0,
    checkout INTEGER DEFAULT 0,
    payments TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`);

  // Expenses
  await client.execute(`CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    date TEXT,
    period TEXT,
    property_id TEXT REFERENCES properties(id),
    property_label TEXT,
    room TEXT,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    payee TEXT,
    payment_method TEXT,
    allocation_mode TEXT,
    shared_by_rooms TEXT,
    source_bill_id TEXT,
    work_order_id TEXT,
    invoice_no TEXT,
    note TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`);

  // Work Orders
  await client.execute(`CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'normal',
    type TEXT,
    property_id TEXT REFERENCES properties(id),
    property_label TEXT,
    room TEXT,
    scope TEXT,
    buildings TEXT,
    photos TEXT,
    assigned_to TEXT,
    cost_estimate REAL DEFAULT 0,
    amount REAL DEFAULT 0,
    expense_id TEXT,
    date TEXT,
    period TEXT,
    payee TEXT,
    payment_method TEXT,
    invoice_no TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`);

  // Meter Drafts
  await client.execute(`CREATE TABLE IF NOT EXISTS meter_drafts (
    id TEXT PRIMARY KEY,
    building TEXT,
    room TEXT,
    cycle TEXT,
    electric_now TEXT,
    water_now TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`);

  // Meter Readings
  await client.execute(`CREATE TABLE IF NOT EXISTS meter_readings (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    property_id TEXT REFERENCES properties(id),
    room TEXT,
    period TEXT,
    reading REAL NOT NULL,
    usage REAL,
    rate REAL,
    photo_url TEXT,
    note TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`);

  // Transactions
  await client.execute(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    type TEXT,
    status TEXT DEFAULT 'unmatched',
    matched_record_id TEXT,
    tenant_id TEXT REFERENCES tenants(id),
    note TEXT,
    operator TEXT,
    auto_created INTEGER DEFAULT 0,
    created_at TEXT,
    description TEXT,
    counterparty TEXT,
    reference TEXT
  )`);

  // Message Logs
  await client.execute(`CREATE TABLE IF NOT EXISTS message_logs (
    id TEXT PRIMARY KEY,
    record_id TEXT REFERENCES records(id),
    tenant_id TEXT REFERENCES tenants(id),
    target_group TEXT,
    operator TEXT,
    status TEXT,
    sent_at TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`);

  // Reminders
  await client.execute(`CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id),
    room TEXT,
    days_before INTEGER DEFAULT 30,
    remind_time TEXT DEFAULT '09:00',
    due_date TEXT,
    enabled INTEGER DEFAULT 1,
    last_triggered_at TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`);

  // Settings
  await client.execute(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )`);

  // Audit Logs
  await client.execute(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    user_id TEXT,
    username TEXT,
    operator TEXT,
    details TEXT,
    created_at TEXT
  )`);

  console.log('[DB] V6 database initialized successfully!');
}

initDb().catch(console.error);
