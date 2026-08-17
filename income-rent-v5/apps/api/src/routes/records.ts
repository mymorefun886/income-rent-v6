// Records (Bills) CRUD routes - V6 Complete
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { records, tenants } from '../db/schema.js';
import { eq, desc, and, gte, lte, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const recordsRouter = new Hono();

// ── Schemas ──
const recordSchema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  tenantName: z.string().optional(),
  building: z.string().optional(),
  room: z.string().optional(),
  roomNo: z.string().optional(),
  roomKey: z.string().optional(),
  cycle: z.string().min(1, 'Cycle is required'),
  rentPart: z.number().default(0),
  receivable: z.number().min(0),
  received: z.number().default(0),
  status: z.string().default('未收'), // 未收/已收/已结清
  sentStatus: z.string().default('unsent'),
  sentAt: z.string().optional(),
  dueDate: z.string().optional(),
  paidAt: z.string().optional(),
  method: z.string().optional(),
  note: z.string().optional(),
  // Electric
  electricPrev: z.string().optional(),
  electricNow: z.string().optional(),
  electricUsage: z.string().optional(),
  electricPrice: z.string().optional(),
  electricCost: z.number().optional(),
  // Water
  waterPrev: z.string().optional(),
  waterNow: z.string().optional(),
  waterUsage: z.string().optional(),
  waterPrice: z.string().optional(),
  waterMinimumCharge: z.string().optional(),
  waterCost: z.number().optional(),
  noWaterMeter: z.boolean().default(false),
  // Other fees
  propertyFee: z.string().default('0'),
  networkFee: z.string().default('0'),
  garbageFee: z.string().default('0'),
  otherFee: z.string().default('0'),
  // Deposit
  depositAdjustment: z.string().default('0'),
  depositAmount: z.number().default(0),
  depositRefund: z.number().default(0),
  depositDeduct: z.number().default(0),
  checkout: z.boolean().default(false),
  payments: z.array(z.any()).optional(),
});

const updateRecordSchema = recordSchema.partial();

// ── Helper: Calculate roomKey ──
function calculateRoomKey(building?: string, room?: string): string {
  return [building, room].filter(Boolean).join('::');
}

// ── GET /api/records ──
recordsRouter.get('/', async (c) => {
  const cycle = c.req.query('cycle');
  const status = c.req.query('status');
  const tenantId = c.req.query('tenantId');
  const building = c.req.query('building');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '50');

  const conditions = [];

  if (cycle) {
    conditions.push(eq(records.cycle, cycle));
  }
  if (status) {
    conditions.push(eq(records.status, status));
  }
  if (tenantId) {
    conditions.push(eq(records.tenantId, tenantId));
  }
  if (building) {
    conditions.push(eq(records.building, building));
  }

  const allRecords = await db.query.records.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(records.cycle), desc(records.createdAt)],
  });

  // Pagination
  const total = allRecords.length;
  const start = (page - 1) * pageSize;
  const items = allRecords.slice(start, start + pageSize);

  return c.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

// ── GET /api/records/:id ──
recordsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const record = await db.query.records.findFirst({
    where: eq(records.id, id),
    with: { tenant: true },
  });

  if (!record) {
    return c.json({ success: false, error: 'Record not found' }, 404);
  }

  return c.json({ success: true, data: record });
});

// ── POST /api/records ──
recordsRouter.post('/', zValidator('json', recordSchema), async (c) => {
  const data = c.req.valid('json');
  const id = randomUUID();

  // Calculate roomKey
  const roomKey = data.roomKey || calculateRoomKey(data.building, data.room);

  await db.insert(records).values({
    id,
    ...data,
    roomKey,
    payments: data.payments ? JSON.stringify(data.payments) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const newRecord = await db.query.records.findFirst({
    where: eq(records.id, id),
  });

  return c.json({ success: true, data: newRecord });
});

// ── PUT /api/records/:id ──
recordsRouter.put('/:id', zValidator('json', updateRecordSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const existing = await db.query.records.findFirst({
    where: eq(records.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Record not found' }, 404);
  }

  const updateData: any = { ...data, updatedAt: new Date() };

  if (data.payments) {
    updateData.payments = JSON.stringify(data.payments);
  }

  // Recalculate roomKey if building/room changed
  if (data.building !== undefined || data.room !== undefined) {
    const building = data.building ?? existing.building;
    const room = data.room ?? existing.room;
    updateData.roomKey = calculateRoomKey(building, room);
  }

  await db.update(records)
    .set(updateData)
    .where(eq(records.id, id));

  const updated = await db.query.records.findFirst({
    where: eq(records.id, id),
  });

  return c.json({ success: true, data: updated });
});

// ── DELETE /api/records/:id ──
recordsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await db.query.records.findFirst({
    where: eq(records.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Record not found' }, 404);
  }

  await db.delete(records).where(eq(records.id, id));

  return c.json({ success: true, message: 'Record deleted' });
});

// ── POST /api/records/mark-sent ──
recordsRouter.post('/mark-sent', async (c) => {
  const body = await c.req.json();
  const ids = body.ids as string[];
  const sentAt = body.sentAt || new Date().toISOString();

  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ success: false, error: 'No ids provided' }, 400);
  }

  // Update all records
  for (const id of ids) {
    await db.update(records)
      .set({ sentStatus: 'sent', sentAt, updatedAt: new Date() })
      .where(eq(records.id, id));
  }

  return c.json({ success: true, message: `${ids.length} records marked as sent` });
});

// ── POST /api/records/quick-receive ──
recordsRouter.post('/quick-receive', async (c) => {
  const body = await c.req.json();
  const { recordId, amount, method, note, paidAt } = body;

  if (!recordId || !amount) {
    return c.json({ success: false, error: 'recordId and amount required' }, 400);
  }

  const existing = await db.query.records.findFirst({
    where: eq(records.id, recordId),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Record not found' }, 404);
  }

  // Use provided date or default to today
  const paymentDate = paidAt || new Date().toISOString().split('T')[0];

  // Add payment
  const payments = existing.payments ? JSON.parse(existing.payments) : [];
  payments.push({
    id: `pay-${Date.now()}`,
    amount,
    paidAt: paymentDate,
    method: method || '微信',
    note: note || '快速收款',
  });

  // Calculate new received amount
  const newReceived = (existing.received || 0) + amount;
  const newStatus = newReceived >= existing.receivable ? '已收' : '部分收款';

  await db.update(records)
    .set({
      received: newReceived,
      status: newStatus,
      payments: JSON.stringify(payments),
      paidAt: paymentDate,
      method: method || existing.method,
      updatedAt: new Date(),
    })
    .where(eq(records.id, recordId));

  const updated = await db.query.records.findFirst({
    where: eq(records.id, recordId),
  });

  return c.json({ success: true, data: updated });
});
