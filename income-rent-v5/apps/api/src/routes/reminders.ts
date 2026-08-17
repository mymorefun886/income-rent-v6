// Reminders routes - V6
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { reminders, tenants } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const remindersRouter = new Hono();

// ── Schemas ──
const reminderSchema = z.object({
  tenantId: z.string().min(1, 'Tenant is required'),
  room: z.string().optional(),
  daysBefore: z.number().default(30),
  remindTime: z.string().default('09:00'),
  dueDate: z.string().optional(),
  enabled: z.boolean().default(true),
  lastTriggeredAt: z.string().optional(),
});

const updateReminderSchema = reminderSchema.partial();

// ── GET /api/reminders ──
remindersRouter.get('/', async (c) => {
  const tenantId = c.req.query('tenantId');
  const enabled = c.req.query('enabled');

  const conditions = [];

  if (tenantId) {
    conditions.push(eq(reminders.tenantId, tenantId));
  }
  if (enabled !== undefined) {
    conditions.push(eq(reminders.enabled, enabled === 'true'));
  }

  const allReminders = await db.query.reminders.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(reminders.dueDate)],
  });

  return c.json({ success: true, data: allReminders });
});

// ── GET /api/reminders/:id ──
remindersRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const reminder = await db.query.reminders.findFirst({
    where: eq(reminders.id, id),
  });

  if (!reminder) {
    return c.json({ success: false, error: 'Reminder not found' }, 404);
  }

  return c.json({ success: true, data: reminder });
});

// ── POST /api/reminders ──
remindersRouter.post('/', zValidator('json', reminderSchema), async (c) => {
  const data = c.req.valid('json');
  const id = randomUUID();

  await db.insert(reminders).values({
    id,
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const newReminder = await db.query.reminders.findFirst({
    where: eq(reminders.id, id),
  });

  return c.json({ success: true, data: newReminder });
});

// ── PUT /api/reminders/:id ──
remindersRouter.put('/:id', zValidator('json', updateReminderSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');

  const existing = await db.query.reminders.findFirst({
    where: eq(reminders.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Reminder not found' }, 404);
  }

  await db.update(reminders)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(reminders.id, id));

  const updated = await db.query.reminders.findFirst({
    where: eq(reminders.id, id),
  });

  return c.json({ success: true, data: updated });
});

// ── DELETE /api/reminders/:id ──
remindersRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await db.query.reminders.findFirst({
    where: eq(reminders.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Reminder not found' }, 404);
  }

  await db.delete(reminders).where(eq(reminders.id, id));

  return c.json({ success: true, message: 'Reminder deleted' });
});

// ── GET /api/reminders/upcoming ──
remindersRouter.get('/upcoming', async (c) => {
  const today = new Date();
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const allReminders = await db.query.reminders.findMany({
    where: and(
      eq(reminders.enabled, true),
    ),
    orderBy: [desc(reminders.dueDate)],
  });

  // Filter reminders due within 30 days
  const upcoming = allReminders.filter(r => {
    if (!r.dueDate) return false;
    const dueDate = new Date(r.dueDate);
    return dueDate <= thirtyDaysFromNow && dueDate >= today;
  });

  return c.json({ success: true, data: upcoming });
});
