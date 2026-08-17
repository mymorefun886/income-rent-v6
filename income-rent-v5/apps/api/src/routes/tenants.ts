// Tenants CRUD routes - V4 Compatible
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { tenants, properties } from '../db/schema.js';
import { eq, desc, and, ne, like, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const tenantsRouter = new Hono();

// ── Schemas ──
const feeItemSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  billingMode: z.string(), // 抄表计算/固定金额
  unitPrice: z.number().optional(),
  unit: z.string().optional(),
  initialReading: z.number().optional(),
  hasMinimum: z.boolean().default(false),
  minimumCharge: z.number().default(0),
});

const tenantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  idNo: z.string().optional(),
  building: z.string().optional(),
  room: z.string().optional(),
  propertyId: z.string().optional(),
  roomLabel: z.string().optional(),
  rent: z.number().default(0),
  deposit: z.number().default(0),
  leaseStart: z.string().optional(),
  leaseEnd: z.string().optional(),
  wechatRemark: z.string().optional(),
  wechatGroupName: z.string().optional(),
  idCardFront: z.string().optional(),
  idCardBack: z.string().optional(),
  feeItems: z.array(feeItemSchema).optional(),
  status: z.string().default('正常'),
  remind: z.boolean().default(true),
  notes: z.string().optional(),
});

const updateTenantSchema = tenantSchema.partial().extend({
  archived: z.boolean().optional(),
});

// ── GET /api/tenants ──
tenantsRouter.get('/', async (c) => {
  const showArchived = c.req.query('archived') === 'true';
  const propertyId = c.req.query('propertyId');
  const building = c.req.query('building');
  const search = c.req.query('search');

  const conditions = [];

  if (!showArchived) {
    conditions.push(eq(tenants.archived, false));
  }
  if (propertyId) {
    conditions.push(eq(tenants.propertyId, propertyId));
  }
  if (building) {
    conditions.push(eq(tenants.building, building));
  }
  if (search) {
    conditions.push(
      or(
        like(tenants.name, `%${search}%`),
        like(tenants.phone, `%${search}%`),
        like(tenants.room, `%${search}%`),
        like(tenants.building, `%${search}%`)
      )
    );
  }

  const allTenants = await db.query.tenants.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(tenants.building), tenants.room],
  });

  return c.json({ success: true, data: allTenants });
});

// ── GET /api/tenants/status-summary ──
// 获取租客状态统计（必须在 /:id 之前）
tenantsRouter.get('/status-summary', async (c) => {
  try {
    const allTenants = await db.query.tenants.findMany({
      where: eq(tenants.archived, false),
    });

    const summary = {
      '正常': 0,
      '即将到期': 0,
      '欠款': 0,
      '已退租': 0,
      '纠纷': 0,
    };

    for (const tenant of allTenants) {
      const status = tenant.status || '正常';
      if (summary.hasOwnProperty(status)) {
        summary[status as keyof typeof summary]++;
      }
    }

    return c.json({ success: true, data: summary });
  } catch (error) {
    console.error('[Tenants] Status summary error:', error);
    return c.json({ success: false, error: '获取状态统计失败' }, 500);
  }
});

// ── POST /api/tenants/auto-update-status ──
// 自动更新所有租客状态（必须在 /:id 之前）
tenantsRouter.post('/auto-update-status', async (c) => {
  try {
    const { records } = await import('../db/schema.js');
    const { and } = await import('drizzle-orm');

    // 获取所有未归档的租客
    const allTenants = await db.query.tenants.findMany({
      where: eq(tenants.archived, false),
    });

    const now = new Date();
    const updates: { id: string; oldStatus: string; newStatus: string; reason: string }[] = [];

    for (const tenant of allTenants) {
      let newStatus = tenant.status || '正常';
      let reason = '';

      // 检查是否有未收账单
      const unpaidRecords = await db.select({ id: records.id })
        .from(records)
        .where(
          and(
            eq(records.tenantId, tenant.id),
            eq(records.status, '未收')
          )
        );

      // 检查租约状态
      if (tenant.leaseEnd) {
        const leaseEndDate = new Date(tenant.leaseEnd);
        const daysUntilExpiry = Math.ceil((leaseEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        if (daysUntilExpiry < 0) {
          // 租约已结束
          newStatus = '已退租';
          reason = '租约已结束';
        } else if (daysUntilExpiry <= 30) {
          // 30天内到期
          newStatus = '即将到期';
          reason = `租约将在${daysUntilExpiry}天后到期`;
        }
      }

      // 检查欠费（优先级低于即将到期）
      if (newStatus !== '即将到期' && unpaidRecords.length > 0) {
        newStatus = '欠款';
        reason = `有${unpaidRecords.length}笔未收账单`;
      }

      // 如果状态应该是正常（没有上述情况）
      if (!newStatus || (!newStatus.includes('即将到期') && !newStatus.includes('欠款') && !newStatus.includes('已退租'))) {
        newStatus = '正常';
        reason = '';
      }

      // 只有状态变化时才更新
      if (newStatus !== tenant.status) {
        await db.update(tenants)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(tenants.id, tenant.id));

        updates.push({
          id: tenant.id,
          oldStatus: tenant.status || '正常',
          newStatus,
          reason,
        });
      }
    }

    return c.json({
      success: true,
      message: `已更新${updates.length}个租客状态`,
      data: { updates },
    });
  } catch (error) {
    console.error('[Tenants] Auto update status error:', error);
    return c.json({ success: false, error: '自动更新状态失败' }, 500);
  }
});

// ── GET /api/tenants/:id ──
tenantsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, id),
  });

  if (!tenant) {
    return c.json({ success: false, error: 'Tenant not found' }, 404);
  }

  return c.json({ success: true, data: tenant });
});

// ── POST /api/tenants ──
tenantsRouter.post('/', zValidator('json', tenantSchema), async (c) => {
  const data = c.req.valid('json');
  const id = randomUUID();

  await db.insert(tenants).values({
    id,
    ...data,
    feeItems: data.feeItems ? JSON.stringify(data.feeItems) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const newTenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, id),
  });

  return c.json({ success: true, data: newTenant });
});

// ── PUT /api/tenants/:id ──
tenantsRouter.put('/:id', zValidator('json', updateTenantSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Tenant not found' }, 404);
  }

  const updateData: any = { ...data, updatedAt: new Date() };
  if (data.feeItems) {
    updateData.feeItems = JSON.stringify(data.feeItems);
  }

  await db.update(tenants)
    .set(updateData)
    .where(eq(tenants.id, id));

  const updated = await db.query.tenants.findFirst({
    where: eq(tenants.id, id),
  });

  return c.json({ success: true, data: updated });
});

// ── DELETE /api/tenants/:id ──
tenantsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Tenant not found' }, 404);
  }

  await db.delete(tenants).where(eq(tenants.id, id));

  return c.json({ success: true, message: 'Tenant deleted' });
});
