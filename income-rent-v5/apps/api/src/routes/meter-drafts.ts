// Meter Drafts routes - V6
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { meterDrafts, properties, records, tenants } from '../db/schema.js';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const meterDraftsRouter = new Hono();

// ── Helper: Get previous cycle ──
function getPreviousCycle(cycle: string): string {
  const [year, month] = cycle.split('-').map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

// ── Schemas ──
const meterDraftSchema = z.object({
  building: z.string().optional(),
  room: z.string().optional(),
  cycle: z.string().optional(),
  electricNow: z.string().optional(),
  waterNow: z.string().optional(),
});

const updateMeterDraftSchema = meterDraftSchema.partial();

const generateDraftsSchema = z.object({
  building: z.string().min(1, 'Building is required'),
  cycle: z.string().min(1, 'Cycle is required'),
});

const batchUpdateSchema = z.array(z.object({
  id: z.string().optional(),
  building: z.string(),
  room: z.string(),
  cycle: z.string(),
  electricNow: z.string().optional(),
  waterNow: z.string().optional(),
}));

// ── GET /api/meter-drafts ──
meterDraftsRouter.get('/', async (c) => {
  const cycle = c.req.query('cycle');
  const building = c.req.query('building');
  const status = c.req.query('status') || 'draft'; // 默认只查草稿

  const conditions = [];

  if (cycle) {
    conditions.push(eq(meterDrafts.cycle, cycle));
  }
  if (building) {
    conditions.push(eq(meterDrafts.building, building));
  }
  if (status !== 'all') {
    conditions.push(eq(meterDrafts.status, status));
  }

  const drafts = await db.query.meterDrafts.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(meterDrafts.createdAt)],
  });

  return c.json({ success: true, data: drafts });
});

// ── GET /api/meter-drafts/:id ──
meterDraftsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const draft = await db.query.meterDrafts.findFirst({
    where: eq(meterDrafts.id, id),
  });

  if (!draft) {
    return c.json({ success: false, error: 'Meter draft not found' }, 404);
  }

  return c.json({ success: true, data: draft });
});

// ── POST /api/meter-drafts ──
meterDraftsRouter.post('/', zValidator('json', meterDraftSchema), async (c) => {
  const data = c.req.valid('json');
  const id = randomUUID();

  await db.insert(meterDrafts).values({
    id,
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const newDraft = await db.query.meterDrafts.findFirst({
    where: eq(meterDrafts.id, id),
  });

  return c.json({ success: true, data: newDraft });
});

// ── POST /api/meter-drafts/generate ──
// V4-style: Generate drafts from building's properties
meterDraftsRouter.post('/generate', zValidator('json', generateDraftsSchema), async (c) => {
  const { building, cycle } = c.req.valid('json');

  // Get all properties for this building
  const buildingProperties = await db.query.properties.findMany({
    where: eq(properties.building, building),
  });

  if (buildingProperties.length === 0) {
    return c.json({ success: false, error: 'No properties found for this building' }, 404);
  }

  // Delete existing drafts for this building + cycle
  await db.delete(meterDrafts)
    .where(and(
      eq(meterDrafts.building, building),
      eq(meterDrafts.cycle, cycle)
    ));

  // Create new drafts for each property
  const newDrafts = [];
  for (const prop of buildingProperties) {
    const id = randomUUID();
    await db.insert(meterDrafts).values({
      id,
      building,
      room: prop.room || '',
      cycle,
      electricNow: '',
      waterNow: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    newDrafts.push({ id, building, room: prop.room, cycle });
  }

  // Fetch the created drafts
  const drafts = await db.query.meterDrafts.findMany({
    where: and(
      eq(meterDrafts.building, building),
      eq(meterDrafts.cycle, cycle)
    ),
  });

  return c.json({
    success: true,
    data: drafts,
    message: `Generated ${drafts.length} drafts for ${building} - ${cycle}`
  });
});

// ── POST /api/meter-drafts/batch ──
// Batch update drafts (for batch entry UI)
meterDraftsRouter.post('/batch', zValidator('json', batchUpdateSchema), async (c) => {
  const drafts = c.req.valid('json');

  const results = [];
  for (const draft of drafts) {
    if (draft.id) {
      // Update existing
      await db.update(meterDrafts)
        .set({
          electricNow: draft.electricNow,
          waterNow: draft.waterNow,
          updatedAt: new Date(),
        })
        .where(eq(meterDrafts.id, draft.id));

      const updated = await db.query.meterDrafts.findFirst({
        where: eq(meterDrafts.id, draft.id),
      });
      results.push(updated);
    } else {
      // Create new
      const id = randomUUID();
      await db.insert(meterDrafts).values({
        id,
        building: draft.building,
        room: draft.room,
        cycle: draft.cycle,
        electricNow: draft.electricNow || '',
        waterNow: draft.waterNow || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const newDraft = await db.query.meterDrafts.findFirst({
        where: eq(meterDrafts.id, id),
      });
      results.push(newDraft);
    }
  }

  return c.json({
    success: true,
    data: results,
    message: `Updated ${results.length} drafts`
  });
});

// ── PUT /api/meter-drafts/:id ──
meterDraftsRouter.put('/:id', zValidator('json', updateMeterDraftSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const existing = await db.query.meterDrafts.findFirst({
    where: eq(meterDrafts.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Meter draft not found' }, 404);
  }

  await db.update(meterDrafts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(meterDrafts.id, id));

  const updated = await db.query.meterDrafts.findFirst({
    where: eq(meterDrafts.id, id),
  });

  return c.json({ success: true, data: updated });
});

// ── POST /api/meter-drafts/sync ──
// Sync drafts to bills (records) - V4 style
meterDraftsRouter.post('/sync', zValidator('json', z.object({
  building: z.string().min(1),
  cycle: z.string().min(1),
})), async (c) => {
  const { building, cycle } = c.req.valid('json');

  // Get all drafts for this building + cycle
  const drafts = await db.query.meterDrafts.findMany({
    where: and(
      eq(meterDrafts.building, building),
      eq(meterDrafts.cycle, cycle)
    ),
  });

  if (drafts.length === 0) {
    return c.json({ success: false, error: 'No drafts found' }, 404);
  }

  // Import records and tenants
  const { records, tenants } = await import('../db/schema.js').then(m => m);

  // For each draft, find the tenant and create/update a record
  const results = [];
  for (const draft of drafts) {
    // Find tenant for this room
    const tenant = await db.query.tenants.findFirst({
      where: and(
        eq(tenants.building, building),
        eq(tenants.room, draft.room)
      ),
    });

    if (!tenant) {
      // Skip vacant rooms
      continue;
    }

    // Check if record already exists for this tenant + cycle
    const existingRecord = await db.query.records.findFirst({
      where: and(
        eq(records.tenantId, tenant.id),
        eq(records.cycle, cycle)
      ),
    });

    // Get previous cycle readings for usage calculation
    const prevCycle = getPreviousCycle(cycle);
    const prevDraft = await db.query.meterDrafts.findFirst({
      where: and(
        eq(meterDrafts.building, building),
        eq(meterDrafts.room, draft.room),
        eq(meterDrafts.cycle, prevCycle)
      ),
    });

    // Calculate usage
    const electricNow = parseFloat(draft.electricNow || '0') || 0;
    const waterNow = parseFloat(draft.waterNow || '0') || 0;
    const electricPrev = parseFloat(prevDraft?.electricNow || '0') || 0;
    const waterPrev = parseFloat(prevDraft?.waterNow || '0') || 0;
    const electricUsage = Math.max(0, electricNow - electricPrev);
    const waterUsage = Math.max(0, waterNow - waterPrev);

    if (existingRecord) {
      // Update existing record with meter readings
      await db.update(records)
        .set({
          electricPrev: String(electricPrev),
          electricNow: String(electricNow),
          electricUsage: String(electricUsage),
          waterPrev: String(waterPrev),
          waterNow: String(waterNow),
          waterUsage: String(waterUsage),
          updatedAt: new Date(),
        })
        .where(eq(records.id, existingRecord.id));
      results.push({ room: draft.room, action: 'updated' });
    } else {
      // Create new record
      const id = randomUUID();
      await db.insert(records).values({
        id,
        tenantId: tenant.id,
        tenantName: tenant.name,
        building,
        room: draft.room,
        cycle,
        rentPart: tenant.rent || 0,
        receivable: tenant.rent || 0,
        received: 0,
        status: '未收',
        electricPrev: String(electricPrev),
        electricNow: String(electricNow),
        electricUsage: String(electricUsage),
        waterPrev: String(waterPrev),
        waterNow: String(waterNow),
        waterUsage: String(waterUsage),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      results.push({ room: draft.room, action: 'created' });
    }
  }

  // 更新草稿状态为已同步
  await db.update(meterDrafts)
    .set({ status: 'synced', updatedAt: new Date() })
    .where(
      and(
        eq(meterDrafts.building, building),
        eq(meterDrafts.cycle, cycle),
        eq(meterDrafts.status, 'draft')
      )
    );

  return c.json({
    success: true,
    data: results,
    message: `已生成 ${results.length} 个房间的账单 (${building} - ${cycle})`
  });
});
