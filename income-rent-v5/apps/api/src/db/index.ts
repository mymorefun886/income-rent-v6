// Database connection and initialization using libsql
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { existsSync, mkdirSync } from 'fs';
import { dirname, resolve, isAbsolute } from 'path';
import { pathToFileURL } from 'url';
import {
  users,
  properties,
  tenants,
  records,
  contracts,
  payments,
  expenses,
  workOrders,
  workOrderRooms,
  meterDrafts,
  messageLogs,
  reminders,
  receipts,
  uploads,
  transactions,
  settings,
  auditLogs,
  sessions,
  utilityBills,
  utilityBillItems,
  contractsRelations,
  paymentsRelations,
} from './schema.js';

const DB_PATH = process.env.DATABASE_URL || './storage/rental.db';

// Ensure storage directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Convert to absolute path for libsql
const absoluteDbPath = isAbsolute(DB_PATH) ? DB_PATH : resolve(process.cwd(), DB_PATH);

// Convert Windows path to file URL (file:///D:/path/to/db)
const dbUrl = pathToFileURL(absoluteDbPath).href;

// Create libsql client (local file mode)
const client = createClient({
  url: dbUrl,
});

// Schema object with relations
const schema = {
  users,
  properties,
  tenants,
  records,
  contracts,
  payments,
  expenses,
  workOrders,
  workOrderRooms,
  meterDrafts,
  messageLogs,
  reminders,
  receipts,
  uploads,
  transactions,
  settings,
  auditLogs,
  sessions,
  utilityBills,
  utilityBillItems,
  contractsRelations,
  paymentsRelations,
};

// Create Drizzle ORM instance
export const db = drizzle(client, { schema });

// Database initialization
export async function initDb() {
  console.log('[DB] Initializing database...');

  // Enable foreign keys
  await client.execute('PRAGMA foreign_keys = ON');

  // Create tables if not exist
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'viewer',
      portfolio TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      last_login INTEGER
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS properties (
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
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS tenants (
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
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS records (
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
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT REFERENCES tenants(id),
      property_id TEXT REFERENCES properties(id),
      rent REAL NOT NULL,
      deposit REAL DEFAULT 0,
      pay_cycle TEXT DEFAULT 'monthly',
      start_date TEXT,
      end_date TEXT,
      fee_items TEXT,
      attachment_url TEXT,
      notes TEXT,
      status TEXT DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      record_id TEXT REFERENCES records(id),
      tenant_id TEXT REFERENCES tenants(id),
      amount REAL NOT NULL,
      method TEXT DEFAULT 'transfer',
      memo TEXT,
      paid_at TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
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
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS work_orders (
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
      rooms TEXT,
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
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS work_order_rooms (
      id TEXT PRIMARY KEY,
      work_order_id TEXT REFERENCES work_orders(id) ON DELETE CASCADE,
      building TEXT,
      room TEXT,
      room_key TEXT,
      issue TEXT,
      description TEXT,
      status TEXT DEFAULT 'open',
      labor_cost REAL DEFAULT 0,
      material_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      completed_at TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
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
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      user_id TEXT,
      username TEXT,
      operator TEXT,
      details TEXT,
      created_at TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // ── V6 New Tables ──

  await client.execute(`
    CREATE TABLE IF NOT EXISTS meter_drafts (
      id TEXT PRIMARY KEY,
      building TEXT,
      room TEXT,
      cycle TEXT,
      electric_now TEXT,
      water_now TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS message_logs (
      id TEXT PRIMARY KEY,
      record_id TEXT REFERENCES records(id),
      tenant_id TEXT REFERENCES tenants(id),
      target_group TEXT,
      operator TEXT,
      status TEXT,
      sent_at TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS reminders (
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
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      original_name TEXT,
      path TEXT,
      stored_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // ── V6 Utility Bills (水電費盈虧對比) ──

  await client.execute(`
    CREATE TABLE IF NOT EXISTS utility_bills (
      id TEXT PRIMARY KEY,
      bill_type TEXT NOT NULL,
      provider TEXT,
      bill_period TEXT NOT NULL,
      billing_start TEXT,
      billing_end TEXT,
      total_amount REAL NOT NULL,
      total_usage REAL,
      building TEXT,
      meter_no TEXT,
      due_date TEXT,
      paid_date TEXT,
      status TEXT DEFAULT 'unpaid',
      note TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS utility_bill_items (
      id TEXT PRIMARY KEY,
      bill_id TEXT REFERENCES utility_bills(id),
      building TEXT,
      room TEXT,
      room_key TEXT,
      meter_reading_start REAL,
      meter_reading_end REAL,
      usage REAL NOT NULL,
      unit_price REAL,
      amount REAL NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // ── V6 Receipts (收據單) ──

  await client.execute(`
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      record_id TEXT REFERENCES records(id),
      bill_type TEXT DEFAULT 'rent',
      building TEXT,
      room TEXT,
      room_id TEXT,
      property_id TEXT REFERENCES properties(id),
      tenant_id TEXT REFERENCES tenants(id),
      start_time TEXT,
      end_time TEXT,
      cycle TEXT,
      meter_reading_time TEXT,
      electric_this_month REAL,
      electric_last_month REAL,
      electric_usage REAL,
      electric_price REAL,
      electric_cost REAL DEFAULT 0,
      water_this_month REAL,
      water_last_month REAL,
      water_usage REAL,
      water_price REAL,
      water_cost REAL DEFAULT 0,
      ratio REAL DEFAULT 1,
      rental REAL DEFAULT 0,
      deposit REAL DEFAULT 0,
      fees1 REAL DEFAULT 0,
      fees2 REAL DEFAULT 0,
      fees3 REAL DEFAULT 0,
      fees4 REAL DEFAULT 0,
      total_money REAL DEFAULT 0,
      note TEXT,
      accounting_date TEXT,
      payment_date TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  console.log('[DB] Database initialized successfully');
}

export {
  users,
  properties,
  tenants,
  records,
  contracts,
  payments,
  expenses,
  workOrders,
  workOrderRooms,
  meterDrafts,
  utilityBills,
  utilityBillItems,
  messageLogs,
  reminders,
  receipts,
  uploads,
  transactions,
  settings,
  auditLogs,
  sessions,
};
