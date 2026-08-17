// Transactions CRUD routes - V6
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { transactions, records, tenants } from '../db/schema.js';
import { eq, desc, and, like } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const transactionsRouter = new Hono();

// ── Schemas ──
const transactionSchema = z.object({
  amount: z.number().min(0),
  type: z.string().optional(), // deposit_collect/deposit_refund/rent_income/other
  status: z.string().default('unmatched'),
  matchedRecordId: z.string().optional(),
  tenantId: z.string().optional(),
  note: z.string().optional(),
  operator: z.string().optional(),
  autoCreated: z.boolean().default(false),
  description: z.string().optional(),
  counterparty: z.string().optional(),
  reference: z.string().optional(),
});

const updateTransactionSchema = transactionSchema.partial();

const matchSchema = z.object({
  transactionId: z.string(),
  recordId: z.string(),
});

// ── GET /api/transactions ──
transactionsRouter.get('/', async (c) => {
  const status = c.req.query('status');
  const tenantId = c.req.query('tenantId');
  const search = c.req.query('search');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '50');

  const conditions = [];

  if (status) {
    conditions.push(eq(transactions.status, status));
  }
  if (tenantId) {
    conditions.push(eq(transactions.tenantId, tenantId));
  }
  if (search) {
    conditions.push(
      like(transactions.note, `%${search}%`)
    );
  }

  const allTransactions = await db.query.transactions.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(transactions.createdAt)],
  });

  // Pagination
  const total = allTransactions.length;
  const start = (page - 1) * pageSize;
  const items = allTransactions.slice(start, start + pageSize);

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

// ── GET /api/transactions/:id ──
transactionsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const transaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, id),
  });

  if (!transaction) {
    return c.json({ success: false, error: 'Transaction not found' }, 404);
  }

  return c.json({ success: true, data: transaction });
});

// ── POST /api/transactions ──
transactionsRouter.post('/', zValidator('json', transactionSchema), async (c) => {
  const data = c.req.valid('json');
  const id = randomUUID();

  await db.insert(transactions).values({
    id,
    ...data,
    createdAt: new Date().toISOString(),
  });

  const newTransaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, id),
  });

  return c.json({ success: true, data: newTransaction });
});

// ── PUT /api/transactions/:id ──
transactionsRouter.put('/:id', zValidator('json', updateTransactionSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const existing = await db.query.transactions.findFirst({
    where: eq(transactions.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Transaction not found' }, 404);
  }

  await db.update(transactions)
    .set(data)
    .where(eq(transactions.id, id));

  const updated = await db.query.transactions.findFirst({
    where: eq(transactions.id, id),
  });

  return c.json({ success: true, data: updated });
});

// ── DELETE /api/transactions/:id ──
transactionsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await db.query.transactions.findFirst({
    where: eq(transactions.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Transaction not found' }, 404);
  }

  await db.delete(transactions).where(eq(transactions.id, id));

  return c.json({ success: true, message: 'Transaction deleted' });
});

// ── POST /api/transactions/match ──
transactionsRouter.post('/match', zValidator('json', matchSchema), async (c) => {
  const { transactionId, recordId } = c.req.valid('json');

  const transaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
  });

  if (!transaction) {
    return c.json({ success: false, error: 'Transaction not found' }, 404);
  }

  const record = await db.query.records.findFirst({
    where: eq(records.id, recordId),
  });

  if (!record) {
    return c.json({ success: false, error: 'Record not found' }, 404);
  }

  // Update transaction as matched
  await db.update(transactions)
    .set({ status: 'matched', matchedRecordId: recordId })
    .where(eq(transactions.id, transactionId));

  // Update record payment
  const payments = record.payments ? JSON.parse(record.payments) : [];
  payments.push({
    id: `pay-${Date.now()}`,
    amount: transaction.amount,
    paidAt: new Date().toISOString().split('T')[0],
    method: '转账',
    note: `交易匹配: ${transaction.id}`,
  });

  const newReceived = (record.received || 0) + transaction.amount;
  const newStatus = newReceived >= record.receivable ? '已收' : '部分收款';

  await db.update(records)
    .set({
      received: newReceived,
      status: newStatus,
      payments: JSON.stringify(payments),
      updatedAt: new Date(),
    })
    .where(eq(records.id, recordId));

  const updatedTransaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
  });

  return c.json({ success: true, data: updatedTransaction });
});

// ── POST /api/transactions/auto-match ──
transactionsRouter.post('/auto-match', async (c) => {
  // Get all unmatched transactions
  const unmatched = await db.query.transactions.findMany({
    where: eq(transactions.status, 'unmatched'),
  });

  let matched = 0;

  for (const tx of unmatched) {
    // Try to find a matching record by amount
    const recordsList = await db.query.records.findMany({
      where: and(
        eq(records.status, '未收'),
        eq(records.receivable, tx.amount)
      ),
    });

    if (recordsList.length === 1) {
      // Exact match found
      const record = recordsList[0];

      await db.update(transactions)
        .set({ status: 'matched', matchedRecordId: record.id })
        .where(eq(transactions.id, tx.id));

      const payments = record.payments ? JSON.parse(record.payments) : [];
      payments.push({
        id: `pay-${Date.now()}`,
        amount: tx.amount,
        paidAt: new Date().toISOString().split('T')[0],
        method: '转账',
        note: `自动匹配: ${tx.id}`,
      });

      const newReceived = (record.received || 0) + tx.amount;
      const newStatus = newReceived >= record.receivable ? '已收' : '部分收款';

      await db.update(records)
        .set({
          received: newReceived,
          status: newStatus,
          payments: JSON.stringify(payments),
          updatedAt: new Date(),
        })
        .where(eq(records.id, record.id));

      matched++;
    }
  }

  return c.json({ success: true, message: `Matched ${matched} transactions` });
});
