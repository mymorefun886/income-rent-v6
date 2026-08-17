// Utility Bills API - 房东支付的水务/电网账单
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db/index.js';
import { utilityBills, utilityBillItems } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';

export const utilityBillsRouter = new Hono();

// Validation schemas
const utilityBillSchema = z.object({
  billType: z.enum(['electric', 'water']),
  provider: z.string().optional(),
  billPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  billingStart: z.string().optional(),
  billingEnd: z.string().optional(),
  totalAmount: z.number().min(0),
  totalUsage: z.number().optional(),
  building: z.string().optional(),
  meterNo: z.string().optional(),
  dueDate: z.string().optional(),
  paidDate: z.string().optional(),
  status: z.enum(['unpaid', 'paid']).default('unpaid'),
  note: z.string().optional(),
});

const utilityBillItemSchema = z.object({
  billId: z.string(),
  building: z.string().optional(),
  room: z.string().optional(),
  roomKey: z.string().optional(),
  meterReadingStart: z.number().optional(),
  meterReadingEnd: z.number().optional(),
  usage: z.number().min(0),
  unitPrice: z.number().optional(),
  amount: z.number().min(0),
});

// GET /api/utility-bills - List all bills
utilityBillsRouter.get('/', async (c) => {
  const { billType, building, status, period } = c.req.query();

  const conditions = [];
  if (billType) conditions.push(eq(utilityBills.billType, billType));
  if (building) conditions.push(eq(utilityBills.building, building));
  if (status) conditions.push(eq(utilityBills.status, status));
  if (period) conditions.push(eq(utilityBills.billPeriod, period));

  const bills = await db.query.utilityBills.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(utilityBills.billPeriod), desc(utilityBills.createdAt)],
  });

  return c.json({ success: true, data: bills });
});

// GET /api/utility-bills/:id - Get bill with items
utilityBillsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  const bill = await db.query.utilityBills.findFirst({
    where: eq(utilityBills.id, id),
  });

  if (!bill) {
    return c.json({ success: false, error: 'Bill not found' }, 404);
  }

  const items = await db.query.utilityBillItems.findMany({
    where: eq(utilityBillItems.billId, id),
  });

  return c.json({ success: true, data: { ...bill, items } });
});

// POST /api/utility-bills - Create bill
utilityBillsRouter.post('/', zValidator('json', utilityBillSchema), async (c) => {
  const data = c.req.valid('json');

  const id = `ub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  await db.insert(utilityBills).values({
    id,
    ...data,
    totalUsage: data.totalUsage ?? null,
  });

  const bill = await db.query.utilityBills.findFirst({
    where: eq(utilityBills.id, id),
  });

  return c.json({ success: true, data: bill });
});

// POST /api/utility-bills/with-items - Create bill with items
utilityBillsRouter.post('/with-items', async (c) => {
  const body = await c.req.json();
  const { bill, items } = body;

  const billId = `ub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  await db.insert(utilityBills).values({
    id: billId,
    billType: bill.billType,
    provider: bill.provider || null,
    billPeriod: bill.billPeriod,
    billingStart: bill.billingStart || null,
    billingEnd: bill.billingEnd || null,
    totalAmount: bill.totalAmount,
    totalUsage: bill.totalUsage || null,
    building: bill.building || null,
    meterNo: bill.meterNo || null,
    dueDate: bill.dueDate || null,
    paidDate: bill.paidDate || null,
    status: bill.status || 'unpaid',
    note: bill.note || null,
  });

  // Insert items
  if (items && Array.isArray(items) && items.length > 0) {
    for (const item of items) {
      const itemId = `ubi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      await db.insert(utilityBillItems).values({
        id: itemId,
        billId,
        building: item.building || null,
        room: item.room || null,
        roomKey: item.roomKey || null,
        meterReadingStart: item.meterReadingStart || null,
        meterReadingEnd: item.meterReadingEnd || null,
        usage: item.usage,
        unitPrice: item.unitPrice || null,
        amount: item.amount,
      });
    }
  }

  const result = await db.query.utilityBills.findFirst({
    where: eq(utilityBills.id, billId),
  });

  const resultItems = await db.query.utilityBillItems.findMany({
    where: eq(utilityBillItems.billId, billId),
  });

  return c.json({ success: true, data: { ...result, items: resultItems } });
});

// PUT /api/utility-bills/:id - Update bill
utilityBillsRouter.put('/:id', zValidator('json', utilityBillSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const existing = await db.query.utilityBills.findFirst({
    where: eq(utilityBills.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Bill not found' }, 404);
  }

  await db.update(utilityBills).set(data).where(eq(utilityBills.id, id));

  const bill = await db.query.utilityBills.findFirst({
    where: eq(utilityBills.id, id),
  });

  return c.json({ success: true, data: bill });
});

// DELETE /api/utility-bills/:id - Delete bill and items
utilityBillsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await db.query.utilityBills.findFirst({
    where: eq(utilityBills.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Bill not found' }, 404);
  }

  // Delete items first
  await db.delete(utilityBillItems).where(eq(utilityBillItems.billId, id));
  // Delete bill
  await db.delete(utilityBills).where(eq(utilityBills.id, id));

  return c.json({ success: true, message: 'Bill deleted' });
});

// GET /api/utility-bills/profit-loss/:period - 盈虧對比
utilityBillsRouter.get('/profit-loss/:period', async (c) => {
  const period = c.req.param('period'); // e.g., '2026-08'

  // 1. 房東實際支付的水電費（支出）
  const bills = await db.query.utilityBills.findMany({
    where: eq(utilityBills.billPeriod, period),
  });

  const electricPaid = bills
    .filter(b => b.billType === 'electric')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  const waterPaid = bills
    .filter(b => b.billType === 'water')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  // 2. 租客承擔的水電費（收入）- 從 records 獲取
  // 注意：租客承擔的是「上個月賬單」對應的用量
  // 例如：9月賬單包含的是8月賬單對應的用量
  const [year, month] = period.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevCycle = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

  // 獲取上個月的租金賬單（包含租客承擔的水電費）
  const { records } = await import('../db/schema.js');
  const prevRecords = await db.query.records.findMany({
    where: eq(records.cycle, prevCycle),
  });

  const electricFromTenants = prevRecords.reduce((sum, r) => {
    const usage = Number(r.electricUsage || 0);
    const price = Number(r.electricPrice || 0.8);
    return sum + usage * price;
  }, 0);

  const waterFromTenants = prevRecords.reduce((sum, r) => {
    const usage = Number(r.waterUsage || 0);
    const price = Number(r.waterPrice || 5.5);
    return sum + usage * price;
  }, 0);

  // 3. 計算盈虧
  const electricProfit = electricFromTenants - electricPaid;
  const waterProfit = waterFromTenants - waterPaid;
  const totalProfit = electricProfit + waterProfit;

  return c.json({
    success: true,
    data: {
      period,
      billingPeriod: prevCycle, // 計費周期（對應用量周期）
      expense: {
        electric: electricPaid,
        water: waterPaid,
        total: electricPaid + waterPaid,
      },
      income: {
        electric: electricFromTenants,
        water: waterFromTenants,
        total: electricFromTenants + waterFromTenants,
      },
      profit: {
        electric: electricProfit,
        water: waterProfit,
        total: totalProfit,
      },
    },
  });
});
