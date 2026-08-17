// Properties CRUD routes - V6 Complete
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { properties } from '../db/schema.js';
import { eq, desc, and, like, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const propertiesRouter = new Hono();

// ── Schemas ──
const propertySchema = z.object({
  building: z.string().optional(),
  room: z.string().optional(),
  floor: z.number().optional(),
  totalFloor: z.number().optional(),
  layout: z.string().optional(),
  title: z.string().optional(),
  address: z.string().optional(),
  area: z.number().default(0),
  rent: z.number().default(0),
  displayRent: z.number().default(0),
  usageType: z.string().optional(),
  propertyType: z.string().optional(),
  bankAccount: z.string().optional(),
  status: z.string().default('空置'),
  noWaterMeter: z.boolean().default(false),
  isWholeBuilding: z.boolean().default(false),
  tenantName: z.string().optional(),
  tenantPhone: z.string().optional(),
  contractEnd: z.string().optional(),
  balance: z.number().default(0),
  roomConfigs: z.array(z.any()).optional(),
  roomInventory: z.array(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const updatePropertySchema = propertySchema.partial();

// ── GET /api/properties ──
propertiesRouter.get('/', async (c) => {
  const status = c.req.query('status');
  const building = c.req.query('building');
  const usageType = c.req.query('usageType');
  const search = c.req.query('search');

  const conditions = [];

  if (status) {
    conditions.push(eq(properties.status, status));
  }
  if (building) {
    conditions.push(eq(properties.building, building));
  }
  if (usageType) {
    conditions.push(eq(properties.usageType, usageType));
  }
  if (search) {
    conditions.push(
      or(
        like(properties.title, `%${search}%`),
        like(properties.building, `%${search}%`),
        like(properties.room, `%${search}%`),
        like(properties.address, `%${search}%`)
      )
    );
  }

  const allProperties = await db.query.properties.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(properties.building), properties.room],
  });

  return c.json({ success: true, data: allProperties });
});

// ── GET /api/properties/:id ──
propertiesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const property = await db.query.properties.findFirst({
    where: eq(properties.id, id),
  });

  if (!property) {
    return c.json({ success: false, error: 'Property not found' }, 404);
  }

  return c.json({ success: true, data: property });
});

// ── GET /api/properties/buildings ──
propertiesRouter.get('/stats/buildings', async (c) => {
  const allProperties = await db.query.properties.findMany();

  const buildings = new Map();
  for (const prop of allProperties) {
    if (prop.building) {
      if (!buildings.has(prop.building)) {
        buildings.set(prop.building, {
          name: prop.building,
          total: 0,
          rented: 0,
          vacant: 0,
          selfUse: 0,
        });
      }
      const stats = buildings.get(prop.building);
      stats.total++;
      if (prop.status === '已出租') stats.rented++;
      else if (prop.status === '空置') stats.vacant++;
      else if (prop.status === '自用') stats.selfUse++;
    }
  }

  return c.json({ success: true, data: Array.from(buildings.values()) });
});

// ── POST /api/properties ──
propertiesRouter.post('/', zValidator('json', propertySchema), async (c) => {
  const data = c.req.valid('json');
  const id = randomUUID();

  // Auto-generate title if not provided
  const title = data.title || [data.building, data.room].filter(Boolean).join(' ');

  await db.insert(properties).values({
    id,
    ...data,
    title,
    roomConfigs: data.roomConfigs ? JSON.stringify(data.roomConfigs) : null,
    roomInventory: data.roomInventory ? JSON.stringify(data.roomInventory) : null,
    tags: data.tags ? JSON.stringify(data.tags) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const newProperty = await db.query.properties.findFirst({
    where: eq(properties.id, id),
  });

  return c.json({ success: true, data: newProperty });
});

// ── PUT /api/properties/:id ──
propertiesRouter.put('/:id', zValidator('json', updatePropertySchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const existing = await db.query.properties.findFirst({
    where: eq(properties.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Property not found' }, 404);
  }

  // Merge JSON fields
  const updateData: any = { ...data, updatedAt: new Date() };
  if (data.roomConfigs) {
    updateData.roomConfigs = JSON.stringify(data.roomConfigs);
  }
  if (data.roomInventory) {
    updateData.roomInventory = JSON.stringify(data.roomInventory);
  }
  if (data.tags) {
    updateData.tags = JSON.stringify(data.tags);
  }

  await db.update(properties)
    .set(updateData)
    .where(eq(properties.id, id));

  const updated = await db.query.properties.findFirst({
    where: eq(properties.id, id),
  });

  return c.json({ success: true, data: updated });
});

// ── DELETE /api/properties/:id ──
propertiesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await db.query.properties.findFirst({
    where: eq(properties.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Property not found' }, 404);
  }

  await db.delete(properties).where(eq(properties.id, id));

  return c.json({ success: true, message: 'Property deleted' });
});
