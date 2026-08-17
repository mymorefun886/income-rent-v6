// Message Logs routes - V6
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { messageLogs } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const messageLogsRouter = new Hono();

// ── Schemas ──
const messageLogSchema = z.object({
  recordId: z.string().optional(),
  tenantId: z.string().optional(),
  targetGroup: z.string().optional(),
  operator: z.string().optional(),
  status: z.string().default('sent'), // sent/failed
  sentAt: z.string().optional(),
});

// ── GET /api/message-logs ──
messageLogsRouter.get('/', async (c) => {
  const recordId = c.req.query('recordId');
  const tenantId = c.req.query('tenantId');
  const status = c.req.query('status');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '50');

  const conditions = [];

  if (recordId) {
    conditions.push(eq(messageLogs.recordId, recordId));
  }
  if (tenantId) {
    conditions.push(eq(messageLogs.tenantId, tenantId));
  }
  if (status) {
    conditions.push(eq(messageLogs.status, status));
  }

  const allLogs = await db.query.messageLogs.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(messageLogs.createdAt)],
  });

  // Pagination
  const total = allLogs.length;
  const start = (page - 1) * pageSize;
  const items = allLogs.slice(start, start + pageSize);

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

// ── GET /api/message-logs/:id ──
messageLogsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const log = await db.query.messageLogs.findFirst({
    where: eq(messageLogs.id, id),
  });

  if (!log) {
    return c.json({ success: false, error: 'Message log not found' }, 404);
  }

  return c.json({ success: true, data: log });
});

// ── POST /api/message-logs ──
messageLogsRouter.post('/', zValidator('json', messageLogSchema), async (c) => {
  const data = c.req.valid('json');
  const id = randomUUID();

  await db.insert(messageLogs).values({
    id,
    ...data,
    createdAt: new Date(),
  });

  const newLog = await db.query.messageLogs.findFirst({
    where: eq(messageLogs.id, id),
  });

  return c.json({ success: true, data: newLog });
});

// ── POST /api/message-logs/batch ──
messageLogsRouter.post('/batch', async (c) => {
  const body = await c.req.json();
  const logs = body.logs as Array<{
    recordId?: string;
    tenantId?: string;
    targetGroup?: string;
    operator?: string;
    status?: string;
    sentAt?: string;
  }>;

  if (!Array.isArray(logs) || logs.length === 0) {
    return c.json({ success: false, error: 'No logs provided' }, 400);
  }

  const ids = [];
  for (const log of logs) {
    const id = randomUUID();
    await db.insert(messageLogs).values({
      id,
      ...log,
      status: log.status || 'sent',
      createdAt: new Date(),
    });
    ids.push(id);
  }

  return c.json({ success: true, message: `${logs.length} logs created`, data: { ids } });
});

// ── DELETE /api/message-logs/:id ──
messageLogsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await db.query.messageLogs.findFirst({
    where: eq(messageLogs.id, id),
  });

  if (!existing) {
    return c.json({ success: false, error: 'Message log not found' }, 404);
  }

  await db.delete(messageLogs).where(eq(messageLogs.id, id));

  return c.json({ success: true, message: 'Message log deleted' });
});
