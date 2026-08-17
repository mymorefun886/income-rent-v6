// Database schema for Drizzle ORM - V6 Complete (V4 Feature Parity)
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

// ── Users ──
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: text('role').default('viewer'),
  portfolio: text('portfolio'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  lastLogin: integer('last_login', { mode: 'timestamp' }),
});

// ── Properties (V4 Complete) ──
export const properties = sqliteTable('properties', {
  id: text('id').primaryKey(),
  building: text('building'),
  room: text('room'),
  floor: integer('floor'),
  totalFloor: integer('total_floor'),
  layout: text('layout'), // 户型: 3室2厅2卫
  title: text('title'),
  address: text('address'),
  area: real('area').default(0), // 面积
  rent: real('rent').default(0),
  displayRent: real('display_rent').default(0),
  usageType: text('usage_type'), // 出租/自用（不出租）
  propertyType: text('property_type'), // 小区住宅/城中村/农民房
  bankAccount: text('bank_account'),
  status: text('status').default('空置'), // 已出租/自用/空置
  noWaterMeter: integer('no_water_meter', { mode: 'boolean' }).default(false),
  isWholeBuilding: integer('is_whole_building', { mode: 'boolean' }).default(false),
  tenantName: text('tenant_name'),
  tenantPhone: text('tenant_phone'),
  contractEnd: text('contract_end'),
  balance: real('balance').default(0),
  roomConfigs: text('room_configs'), // JSON array
  roomInventory: text('room_inventory'), // JSON array
  tags: text('tags'), // JSON array
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  createdBy: text('created_by').references(() => users.id),
});

// ── Tenants (V4 Complete) ──
export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  idNo: text('id_no'), // 身份证号
  building: text('building'),
  room: text('room'),
  propertyId: text('property_id').references(() => properties.id),
  roomLabel: text('room_label'),
  rent: real('rent').default(0),
  deposit: real('deposit').default(0),
  leaseStart: text('lease_start'), // ISO date string
  leaseEnd: text('lease_end'),
  wechatRemark: text('wechat_remark'),
  wechatGroupName: text('wechat_group_name'),
  idCardFront: text('id_card_front'),
  idCardBack: text('id_card_back'),
  feeItems: text('fee_items'), // JSON array of fee configurations
  status: text('status').default('正常'),
  remind: integer('remind', { mode: 'boolean' }).default(true),
  archived: integer('archived', { mode: 'boolean' }).default(false),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Records (Bills) - V4 Complete ──
export const records = sqliteTable('records', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  tenantName: text('tenant_name'),
  building: text('building'),
  room: text('room'),
  roomNo: text('room_no'),
  roomKey: text('room_key'), // building::room
  cycle: text('cycle').notNull(),
  rentPart: real('rent_part').default(0),
  receivable: real('receivable').notNull(),
  received: real('received').default(0),
  status: text('status').default('未收'), // 未收/已收/已结清
  sentStatus: text('sent_status').default('unsent'),
  sentAt: text('sent_at'),
  dueDate: text('due_date'),
  paidAt: text('paid_at'),
  method: text('method'),
  note: text('notes'),
  // Electric
  electricPrev: text('electric_prev'),
  electricNow: text('electric_now'),
  electricUsage: text('electric_usage'),
  electricPrice: text('electric_price'),
  electricCost: real('electric_cost'),
  // Water
  waterPrev: text('water_prev'),
  waterNow: text('water_now'),
  waterUsage: text('water_usage'),
  waterPrice: text('water_price'),
  waterMinimumCharge: text('water_minimum_charge'),
  waterCost: real('water_cost'),
  noWaterMeter: integer('no_water_meter', { mode: 'boolean' }).default(false),
  // Other fees
  propertyFee: text('property_fee').default('0'),
  networkFee: text('network_fee').default('0'),
  garbageFee: text('garbage_fee').default('0'),
  otherFee: text('other_fee').default('0'),
  // Deposit
  depositAdjustment: text('deposit_adjustment').default('0'),
  depositAmount: real('deposit_amount').default(0),
  depositRefund: real('deposit_refund').default(0),
  depositDeduct: real('deposit_deduct').default(0),
  checkout: integer('checkout', { mode: 'boolean' }).default(false),
  payments: text('payments'), // JSON array
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Contracts ──
export const contracts = sqliteTable('contracts', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  propertyId: text('property_id').references(() => properties.id),
  rent: real('rent').notNull(),
  deposit: real('deposit').default(0),
  payCycle: text('pay_cycle').default('monthly'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  feeItems: text('fee_items'),
  attachmentUrl: text('attachment_url'),
  notes: text('notes'),
  status: text('status').default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Payments ──
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  recordId: text('record_id').references(() => records.id),
  tenantId: text('tenant_id').references(() => tenants.id),
  amount: real('amount').notNull(),
  method: text('method').default('transfer'),
  memo: text('memo'),
  paidAt: text('paid_at'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Transactions (Bank/WeChat) - V4 Complete ──
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  amount: real('amount').notNull(),
  type: text('type'), // deposit_collect/deposit_refund/rent_income/other
  status: text('status').default('unmatched'), // unmatched/matched/completed
  matchedRecordId: text('matched_record_id'),
  tenantId: text('tenant_id').references(() => tenants.id),
  note: text('note'),
  operator: text('operator'),
  autoCreated: integer('auto_created', { mode: 'boolean' }).default(false),
  createdAt: text('created_at'),
  description: text('description'),
  counterparty: text('counterparty'),
  reference: text('reference'),
});

// ── Expenses (V4 Complete) ──
export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  date: text('date'),
  period: text('period'),
  propertyId: text('property_id').references(() => properties.id),
  propertyLabel: text('property_label'),
  room: text('room'),
  category: text('category').notNull(), // 水电维修/物业管理费/其他
  amount: real('amount').notNull(),
  payee: text('payee'),
  paymentMethod: text('payment_method'),
  allocationMode: text('allocation_mode'), // single/shared
  sharedByRooms: text('shared_by_rooms'), // JSON array
  sourceBillId: text('source_bill_id'),
  workOrderId: text('work_order_id'),
  invoiceNo: text('invoice_no'),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Work Orders (维修工单) ──
export const workOrders = sqliteTable('work_orders', {
  id: text('id').primaryKey(),
  title: text('title'),
  description: text('description'),
  status: text('status').default('open'),
  priority: text('priority').default('normal'),
  type: text('type'), // 设施维修/其他
  scope: text('scope').default('single'), // single/building/multi_building/multi_room
  building: text('building'), // 楼栋
  room: text('room'), // 房间号（单房间时使用）
  repairDate: text('repair_date'), // 维修日期
  workerName: text('worker_name'), // 师傅姓名
  workerPhone: text('worker_phone'), // 师傅电话
  laborCost: real('labor_cost').default(0), // 人工费
  materialCost: real('material_cost').default(0), // 材料费
  totalCost: real('total_cost').default(0), // 总费用（自动计算）
  propertyId: text('property_id').references(() => properties.id),
  propertyLabel: text('property_label'),
  assignedTo: text('assigned_to'),
  costEstimate: real('cost_estimate').default(0),
  amount: real('amount').default(0),
  expenseId: text('expense_id'), // 关联支出记录
  date: text('date'),
  period: text('period'),
  payee: text('payee'),
  paymentMethod: text('payment_method'),
  invoiceNo: text('invoice_no'),
  buildings: text('buildings'), // JSON array for multi-building
  rooms: text('rooms'), // JSON array for multi-room: [{room, building, issue, description}]
  photos: text('photos'), // JSON array
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Work Order Rooms (多房间工单明细) ──
export const workOrderRooms = sqliteTable('work_order_rooms', {
  id: text('id').primaryKey(),
  workOrderId: text('work_order_id').references(() => workOrders.id, { onDelete: 'cascade' }),
  building: text('building'),
  room: text('room'),
  roomKey: text('room_key'), // building::room
  issue: text('issue'), // 维修问题
  description: text('description'), // 详细描述
  status: text('status').default('open'),
  laborCost: real('labor_cost').default(0),
  materialCost: real('material_cost').default(0),
  totalCost: real('total_cost').default(0),
  completedAt: text('completed_at'),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Meter Drafts (V4) ──
export const meterDrafts = sqliteTable('meter_drafts', {
  id: text('id').primaryKey(),
  building: text('building'),
  room: text('room'),
  cycle: text('cycle'),
  electricNow: text('electric_now'),
  waterNow: text('water_now'),
  status: text('status').default('draft'), // draft/synced
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Utility Bills (房东支付的水务/电网账单) ──
export const utilityBills = sqliteTable('utility_bills', {
  id: text('id').primaryKey(),
  billType: text('bill_type').notNull(), // 'electric' | 'water'
  provider: text('provider'), // '南方电网' | '深圳水务'
  billPeriod: text('bill_period').notNull(), // 账单月份 '2026-08'
  billingStart: text('billing_start'), // 计费开始日期 '2026-07-01'
  billingEnd: text('billing_end'), // 计费结束日期 '2026-07-31'
  totalAmount: real('total_amount').notNull(), // 账单总金额
  totalUsage: real('total_usage'), // 总用量（度/方）
  building: text('building'), // 楼栋
  meterNo: text('meter_no'), // 表号
  dueDate: text('due_date'), // 到期日
  paidDate: text('paid_date'), // 支付日期
  status: text('status').default('unpaid'), // unpaid/paid
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Utility Bill Items (每个房间对应的用量分摊) ──
export const utilityBillItems = sqliteTable('utility_bill_items', {
  id: text('id').primaryKey(),
  billId: text('bill_id').references(() => utilityBills.id),
  building: text('building'),
  room: text('room'),
  roomKey: text('room_key'), // building::room
  meterReadingStart: real('meter_reading_start'), // 起始讀數
  meterReadingEnd: real('meter_reading_end'), // 結束讀數
  usage: real('usage').notNull(), // 用量
  unitPrice: real('unit_price'), // 單價
  amount: real('amount').notNull(), // 分攤金額
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Message Logs (V4) ──
export const messageLogs = sqliteTable('message_logs', {
  id: text('id').primaryKey(),
  recordId: text('record_id').references(() => records.id),
  tenantId: text('tenant_id').references(() => tenants.id),
  targetGroup: text('target_group'),
  operator: text('operator'),
  status: text('status'), // sent/failed
  sentAt: text('sent_at'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Receipts (收據單 - rent8 兼容) ──
export const receipts = sqliteTable('receipts', {
  id: text('id').primaryKey(),
  recordId: text('record_id').references(() => records.id),
  billType: text('bill_type').default('rent'), // rent | utility
  building: text('building'),
  room: text('room'),
  roomId: text('room_id'),
  propertyId: text('property_id').references(() => properties.id),
  tenantId: text('tenant_id').references(() => tenants.id),

  // 帳單週期
  startTime: text('start_time'), // 開始日期
  endTime: text('end_time'),     // 結束日期
  cycle: text('cycle'),          // 帳單月份 '2026-08'

  // 抄表數據
  meterReadingTime: text('meter_reading_time'),
  electricThisMonth: real('electric_this_month'),   // 本月電表
  electricLastMonth: real('electric_last_month'),   // 上月電表
  electricUsage: real('electric_usage'),            // 電用量
  electricPrice: real('electric_price'),            // 電單價
  electricCost: real('electric_cost').default(0),    // 電費

  waterThisMonth: real('water_this_month'),         // 本月水表
  waterLastMonth: real('water_last_month'),         // 上月水表
  waterUsage: real('water_usage'),                  // 水用量
  waterPrice: real('water_price'),                  // 水單價
  waterCost: real('water_cost').default(0),          // 水費

  ratio: real('ratio').default(1),                  // 水電倍率

  // 費用明細
  rental: real('rental').default(0),                // 租金
  deposit: real('deposit').default(0),              // 押金
  fees1: real('fees1').default(0),                  // 費用1（物業費）
  fees2: real('fees2').default(0),                  // 費用2（網絡費）
  fees3: real('fees3').default(0),                  // 費用3（垃圾費）
  fees4: real('fees4').default(0),                  // 費用4（其他）

  // 總計
  totalMoney: real('total_money').default(0),       // 總金額

  // 備註
  note: text('note'),

  // 到帳確認
  accountingDate: text('accounting_date'),          // 到帳時間
  paymentDate: text('payment_date'),                // 收款日期

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Reminders (V4) ──
export const reminders = sqliteTable('reminders', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  room: text('room'),
  daysBefore: integer('days_before').default(30),
  remindTime: text('remind_time').default('09:00'),
  dueDate: text('due_date'),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  lastTriggeredAt: text('last_triggered_at'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Uploads (V4) ──
export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey(), // filename with extension
  originalName: text('original_name'),
  path: text('path'),
  storedAt: integer('stored_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Settings ──
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Audit Logs ──
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  userId: text('user_id'),
  username: text('username'),
  operator: text('operator'),
  details: text('details'),
  createdAt: text('created_at'),
});

// ── Sessions ──
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  token: text('token').unique().notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ── Relations ──
export const contractsRelations = relations(contracts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [contracts.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [contracts.propertyId],
    references: [properties.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  record: one(records, {
    fields: [payments.recordId],
    references: [records.id],
  }),
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
}));

// ── Types ──
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Record = typeof records.$inferSelect;
export type NewRecord = typeof records.$inferInsert;
export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type WorkOrder = typeof workOrders.$inferSelect;
export type NewWorkOrder = typeof workOrders.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type MeterDraft = typeof meterDrafts.$inferSelect;
export type NewMeterDraft = typeof meterDrafts.$inferInsert;
export type UtilityBill = typeof utilityBills.$inferSelect;
export type NewUtilityBill = typeof utilityBills.$inferInsert;
export type UtilityBillItem = typeof utilityBillItems.$inferSelect;
export type NewUtilityBillItem = typeof utilityBillItems.$inferInsert;
export type MessageLog = typeof messageLogs.$inferSelect;
export type NewMessageLog = typeof messageLogs.$inferInsert;
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
