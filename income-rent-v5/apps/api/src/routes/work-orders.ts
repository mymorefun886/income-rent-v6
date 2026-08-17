// Work Orders CRUD routes - 维修工单管理
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { workOrders, workOrderRooms, expenses } from '../db/schema.js';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const workOrdersRouter = new Hono();

// ── Schemas ──
const workOrderRoomSchema = z.object({
  id: z.string().optional(),
  building: z.string().nullable().optional(),
  room: z.string().nullable().optional(),
  issue: z.string().min(1, '问题描述不能为空'),
  description: z.string().nullable().optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).default('open'),
  laborCost: z.number().min(0).default(0),
  materialCost: z.number().min(0).default(0),
  totalCost: z.number().min(0).default(0),
});

const workOrderSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  description: z.string().nullable().optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).default('open'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  scope: z.enum(['single', 'building', 'multi_building', 'multi_room']).default('single'),
  building: z.string().nullable().optional(),
  buildings: z.string().nullable().optional(),
  rooms: z.array(workOrderRoomSchema).optional(),
  room: z.string().nullable().optional(),
  repairDate: z.string().nullable().optional(),
  workerName: z.string().nullable().optional(),
  workerPhone: z.string().nullable().optional(),
  laborCost: z.number().min(0).default(0),
  materialCost: z.number().min(0).default(0),
  totalCost: z.number().min(0).default(0),
  payee: z.string().nullable().optional(),
  propertyId: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  costEstimate: z.number().min(0).default(0),
  amount: z.number().min(0).default(0),
});

const updateWorkOrderSchema = workOrderSchema.partial();

// ── GET /api/work-orders ──
workOrdersRouter.get('/', async (c) => {
  try {
    const status = c.req.query('status');
    const priority = c.req.query('priority');
    const propertyId = c.req.query('propertyId');

    let conditions = [];
    if (status) conditions.push(eq(workOrders.status, status));
    if (priority) conditions.push(eq(workOrders.priority, priority));
    if (propertyId) conditions.push(eq(workOrders.propertyId, propertyId));

    const allWorkOrders = await db.query.workOrders.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(workOrders.repairDate), desc(workOrders.createdAt)],
    });

    // 获取多房间工单的 rooms
    const workOrderIds = allWorkOrders.map((wo) => wo.id);
    let roomsMap: Record<string, any[]> = {};

    if (workOrderIds.length > 0) {
      const allRooms = await db.select().from(workOrderRooms).where(inArray(workOrderRooms.workOrderId, workOrderIds));
      for (const room of allRooms) {
        if (!roomsMap[room.workOrderId]) roomsMap[room.workOrderId] = [];
        roomsMap[room.workOrderId].push(room);
      }
    }

    const enriched = allWorkOrders.map((wo) => ({
      ...wo,
      roomsList: roomsMap[wo.id] || [],
    }));

    return c.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('[work-orders] GET error:', error);
    return c.json({ success: false, error: 'Internal Server Error', message: error.message }, 500);
  }
});

// ── GET /api/work-orders/:id ──
workOrdersRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const workOrder = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, id),
  });

  if (!workOrder) {
    return c.json({ success: false, error: '工单不存在' }, 404);
  }

  // 获取关联的房间列表
  const roomsList = await db.select().from(workOrderRooms).where(eq(workOrderRooms.workOrderId, id));

  return c.json({ success: true, data: { ...workOrder, roomsList } });
});

// ── POST /api/work-orders ──
workOrdersRouter.post('/', zValidator('json', workOrderSchema), async (c) => {
  const data = c.req.valid('json');
  const id = randomUUID();

  // 计算总费用（多房间时累加）
  let laborCost = data.laborCost || 0;
  let materialCost = data.materialCost || 0;
  let totalCost = laborCost + materialCost;

  const rooms = data.rooms || [];
  if (data.scope === 'multi_room' && rooms.length > 0) {
    for (const r of rooms) {
      laborCost += r.laborCost || 0;
      materialCost += r.materialCost || 0;
    }
    totalCost = laborCost + materialCost;
  }

  await db.insert(workOrders).values({
    id,
    title: data.title,
    description: data.description || null,
    status: data.status || 'open',
    priority: data.priority || 'normal',
    scope: data.scope || 'single',
    building: data.building || null,
    room: data.room || null,
    buildings: data.buildings || null,
    rooms: rooms.length > 0 ? JSON.stringify(rooms) : null,
    repairDate: data.repairDate || null,
    workerName: data.workerName || null,
    workerPhone: data.workerPhone || null,
    laborCost,
    materialCost,
    totalCost,
    payee: data.payee || data.workerName || null,
    propertyId: data.propertyId || null,
    assignedTo: data.assignedTo || data.workerName || null,
    costEstimate: data.costEstimate || totalCost,
    amount: totalCost,
    date: data.repairDate || new Date().toISOString().split('T')[0],
    period: data.repairDate ? data.repairDate.slice(0, 7) : new Date().toISOString().slice(0, 7),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 插入多房间明细
  if (data.scope === 'multi_room' && rooms.length > 0) {
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      const roomLabor = r.laborCost || 0;
      const roomMaterial = r.materialCost || 0;
      await db.insert(workOrderRooms).values({
        id: r.id || randomUUID(),
        workOrderId: id,
        building: r.building || data.building || null,
        room: r.room || null,
        roomKey: r.building && r.room ? `${r.building}::${r.room}` : null,
        issue: r.issue,
        description: r.description || null,
        status: r.status || 'open',
        laborCost: roomLabor,
        materialCost: roomMaterial,
        totalCost: roomLabor + roomMaterial,
        sortOrder: i,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  const newWorkOrder = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, id),
  });

  return c.json({ success: true, data: newWorkOrder });
});

// ── PUT /api/work-orders/:id ──
workOrdersRouter.put('/:id', zValidator('json', updateWorkOrderSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const existing = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: '工单不存在' }, 404);
  }

  // 计算总费用
  let laborCost = data.laborCost ?? existing.laborCost;
  let materialCost = data.materialCost ?? existing.materialCost;
  let totalCost = laborCost + materialCost;

  // 多房间时重新计算
  if (data.scope === 'multi_room' && data.rooms) {
    laborCost = 0;
    materialCost = 0;
    for (const r of data.rooms) {
      laborCost += r.laborCost || 0;
      materialCost += r.materialCost || 0;
    }
    totalCost = laborCost + materialCost;
  }

  await db.update(workOrders)
    .set({
      ...data,
      rooms: data.rooms ? JSON.stringify(data.rooms) : undefined,
      laborCost,
      materialCost,
      totalCost,
      amount: totalCost,
      updatedAt: new Date(),
    })
    .where(eq(workOrders.id, id));

  // 更新多房间明细
  if (data.scope === 'multi_room' && data.rooms) {
    // 删除旧的房间记录
    await db.delete(workOrderRooms).where(eq(workOrderRooms.workOrderId, id));
    // 插入新的
    for (let i = 0; i < data.rooms.length; i++) {
      const r = data.rooms[i];
      const roomLabor = r.laborCost || 0;
      const roomMaterial = r.materialCost || 0;
      await db.insert(workOrderRooms).values({
        id: r.id || randomUUID(),
        workOrderId: id,
        building: r.building || data.building || null,
        room: r.room || null,
        roomKey: r.building && r.room ? `${r.building}::${r.room}` : null,
        issue: r.issue,
        description: r.description || null,
        status: r.status || 'open',
        laborCost: roomLabor,
        materialCost: roomMaterial,
        totalCost: roomLabor + roomMaterial,
        sortOrder: i,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  const updated = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, id),
  });

  return c.json({ success: true, data: updated });
});

// ── DELETE /api/work-orders/:id ──
workOrdersRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: '工单不存在' }, 404);
  }

  // 删除关联的房间记录
  await db.delete(workOrderRooms).where(eq(workOrderRooms.workOrderId, id));
  await db.delete(workOrders).where(eq(workOrders.id, id));

  return c.json({ success: true, message: '工单已删除' });
});

// ── POST /api/work-orders/:id/sync-expense ── 同步到支出表
workOrdersRouter.post('/:id/sync-expense', async (c) => {
  const id = c.req.param('id');

  const workOrder = await db.query.workOrders.findFirst({
    where: eq(workOrders.id, id),
  });

  if (!workOrder) {
    return c.json({ success: false, error: '工单不存在' }, 404);
  }

  const totalCost = workOrder.totalCost || (workOrder.laborCost + workOrder.materialCost);
  const note = workOrder.scope === 'multi_room'
    ? `维修工单: ${workOrder.title} (${workOrder.rooms ? JSON.parse(workOrder.rooms).length : 0} 个房间)`
    : `维修工单: ${workOrder.title}`;

  // 如果已经同步过，更新支出记录
  if (workOrder.expenseId) {
    await db.update(expenses)
      .set({
        amount: totalCost,
        date: workOrder.repairDate,
        period: workOrder.repairDate?.slice(0, 7),
        payee: workOrder.workerName || workOrder.payee,
        note,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, workOrder.expenseId));

    return c.json({ success: true, message: '支出记录已更新' });
  }

  // 创建新支出记录
  const expenseId = randomUUID();
  await db.insert(expenses).values({
    id: expenseId,
    date: workOrder.repairDate || new Date().toISOString().split('T')[0],
    period: workOrder.repairDate?.slice(0, 7) || new Date().toISOString().slice(0, 7),
    category: '维修',
    amount: totalCost,
    payee: workOrder.workerName || workOrder.payee,
    paymentMethod: 'transfer',
    note,
    workOrderId: id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 更新工单的 expenseId
  await db.update(workOrders)
    .set({ expenseId })
    .where(eq(workOrders.id, id));

  return c.json({ success: true, message: '已同步到支出表', data: { expenseId } });
});
