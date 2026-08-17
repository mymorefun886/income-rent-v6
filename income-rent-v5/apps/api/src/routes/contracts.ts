// Contracts CRUD routes
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { contracts, tenants } from '../db/schema.js';
import { eq, desc, and, lte, gte } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const contractsRouter = new Hono();

// ── Schemas ──
const contractSchema = z.object({
  tenantId: z.string().min(1, '租客不能为空'),
  propertyId: z.string().optional(),
  rent: z.number().min(0, '租金不能为负'),
  deposit: z.number().min(0).default(0),
  payCycle: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'expired', 'terminated']).default('active'),
});

const updateContractSchema = contractSchema.partial();

// ── GET /api/contracts ──
contractsRouter.get('/', async (c) => {
  const status = c.req.query('status');
  const tenantId = c.req.query('tenantId');

  let conditions = [];
  if (status) conditions.push(eq(contracts.status, status));
  if (tenantId) conditions.push(eq(contracts.tenantId, tenantId));

  const allContracts = await db.query.contracts.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: desc(contracts.createdAt),
    with: { tenant: true },
  });

  return c.json({ success: true, data: allContracts });
});

// ── GET /api/contracts/:id ──
contractsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const contract = await db.query.contracts.findFirst({
    where: eq(contracts.id, id),
    with: { tenant: true },
  });

  if (!contract) {
    return c.json({ success: false, error: '合同不存在' }, 404);
  }

  return c.json({ success: true, data: contract });
});

// ── GET /api/contracts/reminders ──
contractsRouter.get('/reminders', async (c) => {
  const now = new Date();
  const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const expiringContracts = await db.query.contracts.findMany({
    where: and(
      eq(contracts.status, 'active'),
      lte(contracts.endDate, sixtyDaysLater),
      gte(contracts.endDate, now)
    ),
    with: { tenant: true },
  });

  const reminders = expiringContracts.map((contract) => {
    const endDate = contract.endDate ? new Date(contract.endDate) : new Date();
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return {
      contractId: contract.id,
      tenantId: contract.tenantId,
      tenantName: contract.tenant?.name || '未知',
      endDate: contract.endDate,
      daysLeft,
      level: daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'warning' : 'normal',
    };
  });

  return c.json({ success: true, data: reminders });
});

// ── POST /api/contracts ──
contractsRouter.post('/', zValidator('json', contractSchema), async (c) => {
  const data = c.req.valid('json');
  const id = randomUUID();

  // Verify tenant exists
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, data.tenantId),
  });

  if (!tenant) {
    return c.json({ success: false, error: '租客不存在' }, 400);
  }

  await db.insert(contracts).values({
    id,
    ...data,
    startDate: data.startDate ? new Date(data.startDate) : null,
    endDate: data.endDate ? new Date(data.endDate) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const newContract = await db.query.contracts.findFirst({
    where: eq(contracts.id, id),
  });

  return c.json({ success: true, data: newContract });
});

// ── PUT /api/contracts/:id ──
contractsRouter.put('/:id', zValidator('json', updateContractSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const existing = await db.query.contracts.findFirst({
    where: eq(contracts.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: '合同不存在' }, 404);
  }

  await db.update(contracts)
    .set({
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
      endDate: data.endDate ? new Date(data.endDate) : existing.endDate,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, id));

  const updated = await db.query.contracts.findFirst({
    where: eq(contracts.id, id),
  });

  return c.json({ success: true, data: updated });
});

// ── DELETE /api/contracts/:id ──
contractsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await db.query.contracts.findFirst({
    where: eq(contracts.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: '合同不存在' }, 404);
  }

  await db.delete(contracts).where(eq(contracts.id, id));

  return c.json({ success: true, message: '合同已删除' });
});

// ── POST /api/contracts/:id/renew ──
// 合同续签
contractsRouter.post('/:id/renew', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { endDate, rent, notes } = body;

    const existing = await db.query.contracts.findFirst({
      where: eq(contracts.id, id),
    });

    if (!existing) {
      return c.json({ success: false, error: '合同不存在' }, 404);
    }

    // 创建新合同（续签）
    const newId = randomUUID();
    const startDt = endDate ? new Date(endDate) : new Date();
    const endDt = new Date(startDt);
    endDt.setFullYear(endDt.getFullYear() + 1); // 默认续签1年

    await db.insert(contracts).values({
      id: newId,
      tenantId: existing.tenantId,
      propertyId: existing.propertyId || null,
      rent: rent || existing.rent,
      deposit: existing.deposit,
      payCycle: existing.payCycle,
      startDate: startDt,
      endDate: endDt,
      notes: notes || `续签自合同 ${existing.id}`,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 将旧合同标记为过期
    await db.update(contracts)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(contracts.id, id));

    const newContract = await db.query.contracts.findFirst({
      where: eq(contracts.id, newId),
    });

    return c.json({ success: true, data: newContract, message: '合同续签成功' });
  } catch (error) {
    console.error('[Contracts] Renew error:', error);
    return c.json({ success: false, error: '续签失败' }, 500);
  }
});

// ── POST /api/contracts/auto-generate-records ──
// 根据合同自动生成账单
contractsRouter.post('/auto-generate-records', async (c) => {
  try {
    const body = await c.req.json();
    const { period } = body; // 格式: YYYY-MM

    if (!period) {
      return c.json({ success: false, error: '请指定账期' }, 400);
    }

    const activeContracts = await db.query.contracts.findMany({
      where: eq(contracts.status, 'active'),
    });

    const generatedRecords = [];

    for (const contract of activeContracts) {
      // 检查是否已存在该账期的账单
      const existingRecords = await db.query.records.findMany({
        where: and(
          eq(records.tenantId, contract.tenantId),
          eq(records.cycle, period)
        ),
      });

      if (existingRecords.length > 0) {
        continue; // 跳过已存在的
      }

      // 创建新账单
      const recordId = randomUUID();
      const cycleStart = new Date(period + '-01');
      const cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, 0);

      await db.insert(records).values({
        id: recordId,
        tenantId: contract.tenantId,
        cycle: period,
        receivable: contract.rent,
        received: 0,
        status: 'unpaid',
        dueDate: cycleEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const newRecord = await db.query.records.findFirst({
        where: eq(records.id, recordId),
      });

      generatedRecords.push(newRecord);
    }

    return c.json({
      success: true,
      data: generatedRecords,
      message: `已生成 ${generatedRecords.length} 条账单`,
    });
  } catch (error) {
    console.error('[Contracts] Auto-generate error:', error);
    return c.json({ success: false, error: '生成失败' }, 500);
  }
});
