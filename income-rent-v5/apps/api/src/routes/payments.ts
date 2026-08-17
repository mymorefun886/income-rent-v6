// Payments CRUD routes
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { payments, records } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const paymentsRouter = new Hono();

// ── Schemas ──
const paymentSchema = z.object({
  recordId: z.string().min(1, '账单不能为空'),
  tenantId: z.string().optional(),
  amount: z.number().positive('金额必须大于 0'),
  method: z.enum(['cash', 'transfer', 'wechat', 'alipay', 'fps']).default('transfer'),
  memo: z.string().optional(),
  paidAt: z.string().optional(),
});

// ── GET /api/payments ──
paymentsRouter.get('/', async (c) => {
  const recordId = c.req.query('recordId');
  const tenantId = c.req.query('tenantId');
  const limit = Number(c.req.query('limit') || '50');

  let conditions = [];
  if (recordId) conditions.push(eq(payments.recordId, recordId));
  if (tenantId) conditions.push(eq(payments.tenantId, tenantId));

  const allPayments = await db.query.payments.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: desc(payments.createdAt),
    limit,
  });

  return c.json({ success: true, data: allPayments });
});

// ── GET /api/payments/:id ──
paymentsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, id),
  });

  if (!payment) {
    return c.json({ success: false, error: '收款记录不存在' }, 404);
  }

  return c.json({ success: true, data: payment });
});

// ── POST /api/payments ──
paymentsRouter.post('/', zValidator('json', paymentSchema), async (c) => {
  const data = c.req.valid('json');
  const id = randomUUID();

  // Verify record exists
  const record = await db.query.records.findFirst({
    where: eq(records.id, data.recordId),
  });

  if (!record) {
    return c.json({ success: false, error: '账单不存在' }, 400);
  }

  await db.insert(payments).values({
    id,
    ...data,
    paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
    createdAt: new Date(),
  });

  // Update record received amount
  const allPayments = await db.query.payments.findMany({
    where: eq(payments.recordId, data.recordId),
  });

  const totalReceived = allPayments.reduce((sum, p) => sum + p.amount, 0);
  const newStatus = totalReceived >= record.receivable ? 'paid' : totalReceived > 0 ? 'partial' : 'unpaid';

  await db.update(records)
    .set({
      received: totalReceived,
      status: newStatus,
      paidAt: newStatus === 'paid' ? new Date() : null,
      method: data.method,
      updatedAt: new Date(),
    })
    .where(eq(records.id, data.recordId));

  const newPayment = await db.query.payments.findFirst({
    where: eq(payments.id, id),
  });

  return c.json({ success: true, data: newPayment });
});

// ── PUT /api/payments/:id ──
paymentsRouter.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = await db.query.payments.findFirst({
    where: eq(payments.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: '收款记录不存在' }, 404);
  }

  await db.update(payments)
    .set({
      ...body,
      paidAt: body.paidAt ? new Date(body.paidAt) : existing.paidAt,
    })
    .where(eq(payments.id, id));

  const updated = await db.query.payments.findFirst({
    where: eq(payments.id, id),
  });

  return c.json({ success: true, data: updated });
});

// ── DELETE /api/payments/:id ──
paymentsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await db.query.payments.findFirst({
    where: eq(payments.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: '收款记录不存在' }, 404);
  }

  await db.delete(payments).where(eq(payments.id, id));

  return c.json({ success: true, message: '收款记录已删除' });
});
