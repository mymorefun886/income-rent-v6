// Expenses CRUD routes
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { expenses } from '../db/schema.js';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const expensesRouter = new Hono();

// ── Schemas ──
const expenseSchema = z.object({
  date: z.string().min(1, '日期不能为空'),
  period: z.string().optional(),
  propertyId: z.string().optional(),
  roomLabel: z.string().optional(),
  category: z.string().min(1, '分类不能为空'),
  amount: z.number().positive('金额必须大于 0'),
  payee: z.string().optional(),
  paymentMethod: z.string().optional(),
  note: z.string().optional(),
  workOrderId: z.string().optional(),
  invoiceNo: z.string().optional(),
});

const updateExpenseSchema = expenseSchema.partial();

// ── GET /api/expenses ──
expensesRouter.get('/', async (c) => {
  const category = c.req.query('category');
  const propertyId = c.req.query('propertyId');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '50');

  let conditions = [];
  if (category) conditions.push(eq(expenses.category, category));
  if (propertyId) conditions.push(eq(expenses.propertyId, propertyId));
  if (from) conditions.push(gte(expenses.date, new Date(from)));
  if (to) conditions.push(lte(expenses.date, new Date(to)));

  const allExpenses = await db.query.expenses.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: desc(expenses.date),
  });

  const total = allExpenses.length;
  const start = (page - 1) * pageSize;
  const items = allExpenses.slice(start, start + pageSize);

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

// ── GET /api/expenses/:id ──
expensesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const expense = await db.query.expenses.findFirst({
    where: eq(expenses.id, id),
  });

  if (!expense) {
    return c.json({ success: false, error: '支出记录不存在' }, 404);
  }

  return c.json({ success: true, data: expense });
});

// ── POST /api/expenses ──
expensesRouter.post('/', zValidator('json', expenseSchema), async (c) => {
  const data = c.req.valid('json');
  const id = randomUUID();

  await db.insert(expenses).values({
    id,
    ...data,
    date: new Date(data.date),
    period: data.period || data.date.slice(0, 7),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const newExpense = await db.query.expenses.findFirst({
    where: eq(expenses.id, id),
  });

  return c.json({ success: true, data: newExpense });
});

// ── PUT /api/expenses/:id ──
expensesRouter.put('/:id', zValidator('json', updateExpenseSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const existing = await db.query.expenses.findFirst({
    where: eq(expenses.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: '支出记录不存在' }, 404);
  }

  await db.update(expenses)
    .set({
      ...data,
      date: data.date ? new Date(data.date) : existing.date,
      updatedAt: new Date(),
    })
    .where(eq(expenses.id, id));

  const updated = await db.query.expenses.findFirst({
    where: eq(expenses.id, id),
  });

  return c.json({ success: true, data: updated });
});

// ── DELETE /api/expenses/:id ──
expensesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await db.query.expenses.findFirst({
    where: eq(expenses.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: '支出记录不存在' }, 404);
  }

  await db.delete(expenses).where(eq(expenses.id, id));

  return c.json({ success: true, message: '支出记录已删除' });
});

// ── GET /api/expenses/summary ──
expensesRouter.get('/summary', async (c) => {
  const year = c.req.query('year') || new Date().getFullYear().toString();

  const allExpenses = await db.query.expenses.findMany();

  const monthlySummary = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, '0')}`,
    total: 0,
    count: 0,
  }));

  allExpenses.forEach((expense) => {
    const expenseDate = expense.date ? new Date(expense.date) : new Date();
    const expenseYear = expenseDate.getFullYear().toString();
    if (expenseYear === year) {
      const monthIndex = expenseDate.getMonth();
      monthlySummary[monthIndex].total += expense.amount;
      monthlySummary[monthIndex].count += 1;
    }
  });

  return c.json({ success: true, data: monthlySummary });
});
