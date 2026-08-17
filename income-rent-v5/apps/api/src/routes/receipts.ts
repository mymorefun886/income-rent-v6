/**
 * Receipts API - 收據單管理
 *
 * 提供 rent8 兼容的收據單功能：
 * - 創建/查看收據單
 * - 記錄抄表數據
 * - 自動計算費用
 * - 到帳確認
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { receipts, records, tenants, properties } from '../db/schema.js';
import { eq, and, desc, like } from 'drizzle-orm';

export const receiptsRouter = new Hono();

// ── Validation Schema ──
const receiptSchema = z.object({
  recordId: z.string().optional(),
  building: z.string().optional(),
  room: z.string().optional(),
  roomId: z.string().optional(),
  propertyId: z.string().optional(),
  tenantId: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  cycle: z.string().optional(),
  meterReadingTime: z.string().optional(),
  electricThisMonth: z.number().optional(),
  electricLastMonth: z.number().optional(),
  electricUsage: z.number().optional(),
  electricPrice: z.number().optional(),
  electricCost: z.number().optional(),
  waterThisMonth: z.number().optional(),
  waterLastMonth: z.number().optional(),
  waterUsage: z.number().optional(),
  waterPrice: z.number().optional(),
  waterCost: z.number().optional(),
  ratio: z.number().default(1),
  rental: z.number().default(0),
  deposit: z.number().default(0),
  fees1: z.number().default(0),
  fees2: z.number().default(0),
  fees3: z.number().default(0),
  fees4: z.number().default(0),
  totalMoney: z.number().default(0),
  note: z.string().optional(),
  accountingDate: z.string().optional(),
  paymentDate: z.string().optional(),
});

// ── GET /api/receipts - 列表 ──
receiptsRouter.get('/', async (c) => {
  try {
    const { building, room, cycle, status } = c.req.query();

    const conditions = [];
    if (building) conditions.push(like(receipts.building, `%${building}%`));
    if (room) conditions.push(eq(receipts.room, room));
    if (cycle) conditions.push(eq(receipts.cycle, cycle));

    const data = await db.query.receipts.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: desc(receipts.createdAt),
    });

    return c.json({ success: true, data });
  } catch (err) {
    console.error('[Receipts API] List error:', err);
    return c.json({ success: false, error: '獲取收據單失敗' }, 500);
  }
});

// ── GET /api/receipts/:id - 詳情 ──
receiptsRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const receipt = await db.query.receipts.findFirst({
      where: eq(receipts.id, id),
    });

    if (!receipt) {
      return c.json({ success: false, error: '收據單不存在' }, 404);
    }

    return c.json({ success: true, data: receipt });
  } catch (err) {
    console.error('[Receipts API] Get error:', err);
    return c.json({ success: false, error: '獲取收據單失敗' }, 500);
  }
});

// ── POST /api/receipts - 創建 ──
receiptsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const validated = receiptSchema.parse(body);

    // 自動計算用量和費用
    const electricUsage = validated.electricThisMonth && validated.electricLastMonth
      ? validated.electricThisMonth - validated.electricLastMonth
      : 0;
    const electricCost = electricUsage * (validated.electricPrice || 0);

    const waterUsage = validated.waterThisMonth && validated.waterLastMonth
      ? validated.waterThisMonth - validated.waterLastMonth
      : 0;
    const waterCost = waterUsage * (validated.waterPrice || 0);

    const totalMoney = (validated.rental || 0)
      + (validated.deposit || 0)
      + electricCost
      + waterCost
      + (validated.fees1 || 0)
      + (validated.fees2 || 0)
      + (validated.fees3 || 0)
      + (validated.fees4 || 0);

    const id = crypto.randomUUID();
    const now = new Date();

    await db.insert(receipts).values({
      id,
      ...validated,
      electricUsage,
      electricCost,
      waterUsage,
      waterCost,
      totalMoney,
      createdAt: now,
      updatedAt: now,
    });

    const newReceipt = await db.query.receipts.findFirst({
      where: eq(receipts.id, id),
    });

    return c.json({ success: true, data: newReceipt });
  } catch (err) {
    console.error('[Receipts API] Create error:', err);
    return c.json({ success: false, error: '創建收據單失敗' }, 500);
  }
});

// ── PUT /api/receipts/:id - 更新 ──
receiptsRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = receiptSchema.partial().parse(body);

    // 重新計算
    const existing = await db.query.receipts.findFirst({
      where: eq(receipts.id, id),
    });

    if (!existing) {
      return c.json({ success: false, error: '收據單不存在' }, 404);
    }

    const electricThis = validated.electricThisMonth ?? existing.electricThisMonth ?? 0;
    const electricLast = validated.electricLastMonth ?? existing.electricLastMonth ?? 0;
    const electricUsage = electricThis - electricLast;
    const electricCost = electricUsage * (validated.electricPrice ?? existing.electricPrice ?? 0);

    const waterThis = validated.waterThisMonth ?? existing.waterThisMonth ?? 0;
    const waterLast = validated.waterLastMonth ?? existing.waterLastMonth ?? 0;
    const waterUsage = waterThis - waterLast;
    const waterCost = waterUsage * (validated.waterPrice ?? existing.waterPrice ?? 0);

    const rental = validated.rental ?? existing.rental ?? 0;
    const deposit = validated.deposit ?? existing.deposit ?? 0;
    const fees1 = validated.fees1 ?? existing.fees1 ?? 0;
    const fees2 = validated.fees2 ?? existing.fees2 ?? 0;
    const fees3 = validated.fees3 ?? existing.fees3 ?? 0;
    const fees4 = validated.fees4 ?? existing.fees4 ?? 0;

    const totalMoney = rental + deposit + electricCost + waterCost + fees1 + fees2 + fees3 + fees4;

    await db
      .update(receipts)
      .set({
        ...validated,
        electricUsage,
        electricCost,
        waterUsage,
        waterCost,
        totalMoney,
        updatedAt: new Date(),
      })
      .where(eq(receipts.id, id));

    const updated = await db.query.receipts.findFirst({
      where: eq(receipts.id, id),
    });

    return c.json({ success: true, data: updated });
  } catch (err) {
    console.error('[Receipts API] Update error:', err);
    return c.json({ success: false, error: '更新收據單失敗' }, 500);
  }
});

// ── DELETE /api/receipts/:id - 刪除 ──
receiptsRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await db.delete(receipts).where(eq(receipts.id, id));
    return c.json({ success: true, message: '刪除成功' });
  } catch (err) {
    console.error('[Receipts API] Delete error:', err);
    return c.json({ success: false, error: '刪除收據單失敗' }, 500);
  }
});

// ── POST /api/receipts/:id/confirm - 確認到帳 ──
receiptsRouter.post('/:id/confirm', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { paymentDate } = body;

    await db
      .update(receipts)
      .set({
        accountingDate: paymentDate || new Date().toISOString(),
        paymentDate: paymentDate || new Date().toISOString(),
        updatedAt: new Date(),
      })
      .where(eq(receipts.id, id));

    // 同時更新對應的 record 狀態
    const receipt = await db.query.receipts.findFirst({
      where: eq(receipts.id, id),
    });

    if (receipt?.recordId) {
      await db
        .update(records)
        .set({
          status: '已收',
          paidAt: paymentDate || new Date().toISOString(),
          updatedAt: new Date(),
        })
        .where(eq(records.id, receipt.recordId));
    }

    return c.json({ success: true, message: '確認成功' });
  } catch (err) {
    console.error('[Receipts API] Confirm error:', err);
    return c.json({ success: false, error: '確認失敗' }, 500);
  }
});

// ── POST /api/receipts/generate - 從賬單生成收據單 ──
receiptsRouter.post('/generate', async (c) => {
  try {
    const body = await c.req.json();
    const { recordId } = body;

    if (!recordId) {
      return c.json({ success: false, error: '缺少賬單ID' }, 400);
    }

    // 獲取賬單數據
    const record = await db.query.records.findFirst({
      where: eq(records.id, recordId),
    });

    if (!record) {
      return c.json({ success: false, error: '賬單不存在' }, 404);
    }

    // 獲取租客數據
    const tenant = record.tenantId
      ? await db.query.tenants.findFirst({
          where: eq(tenants.id, record.tenantId),
        })
      : null;

    // 計算電費
    const electricNow = parseFloat(record.electricNow || '0');
    const electricPrev = parseFloat(record.electricPrev || '0');
    const electricPrice = parseFloat(record.electricPrice || '0');
    const electricUsage = electricNow - electricPrev;
    const electricCost = electricUsage * electricPrice;

    // 計算水費
    const waterNow = parseFloat(record.waterNow || '0');
    const waterPrev = parseFloat(record.waterPrev || '0');
    const waterPrice = parseFloat(record.waterPrice || '0');
    const waterUsage = waterNow - waterPrev;
    const waterCost = waterUsage * waterPrice;

    const totalMoney = (record.rentPart || 0)
      + electricCost
      + waterCost
      + parseFloat(record.propertyFee || '0')
      + parseFloat(record.networkFee || '0')
      + parseFloat(record.garbageFee || '0')
      + parseFloat(record.otherFee || '0');

    const id = crypto.randomUUID();
    const now = new Date();

    await db.insert(receipts).values({
      id,
      recordId: record.id,
      building: record.building,
      room: record.room,
      propertyId: record.tenantId || undefined,
      tenantId: record.tenantId,
      cycle: record.cycle,
      startTime: record.cycle + '-01',
      endTime: record.cycle + '-28',
      meterReadingTime: now.toISOString(),
      electricThisMonth: electricNow,
      electricLastMonth: electricPrev,
      electricUsage,
      electricPrice,
      electricCost,
      waterThisMonth: waterNow,
      waterLastMonth: waterPrev,
      waterUsage,
      waterPrice,
      waterCost,
      rental: record.rentPart || 0,
      deposit: record.depositAmount || 0,
      fees1: parseFloat(record.propertyFee || '0'),
      fees2: parseFloat(record.networkFee || '0'),
      fees3: parseFloat(record.garbageFee || '0'),
      fees4: parseFloat(record.otherFee || '0'),
      totalMoney,
      note: record.note,
      createdAt: now,
      updatedAt: now,
    });

    const newReceipt = await db.query.receipts.findFirst({
      where: eq(receipts.id, id),
    });

    return c.json({ success: true, data: newReceipt });
  } catch (err) {
    console.error('[Receipts API] Generate error:', err);
    return c.json({ success: false, error: '生成收據單失敗' }, 500);
  }
});
