import { config } from 'dotenv';
// Load .env but don't override existing env vars (Docker compose sets them)
config({ override: false });

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { jwt } from 'hono/jwt';

import { db } from './db/index.js';
import { initDb } from './db/init.js';
import { authRouter } from './routes/auth.js';
import { ensureAdminUser } from './utils/auth.js';
import { propertiesRouter } from './routes/properties.js';
import { tenantsRouter } from './routes/tenants.js';
import { recordsRouter } from './routes/records.js';
import { contractsRouter } from './routes/contracts.js';
import { paymentsRouter } from './routes/payments.js';
import { expensesRouter } from './routes/expenses.js';
import { workOrdersRouter } from './routes/work-orders.js';
import { meterDraftsRouter } from './routes/meter-drafts.js';
import { utilityBillsRouter } from './routes/utility-bills.js';
import { transactionsRouter } from './routes/transactions.js';
import { messageLogsRouter } from './routes/message-logs.js';
import { receiptsRouter } from './routes/receipts.js';
import { remindersRouter } from './routes/reminders.js';
import { dashboardRouter } from './routes/dashboard.js';
import { reportsRouter } from './routes/reports.js';
import { wechatRouter } from './routes/wechat.js';
import { rent8Compat } from './routes/compat/rent8.js';
import { errorHandler } from './middleware/error.js';
import { notFoundHandler } from './middleware/not-found.js';

const app = new Hono();
const PORT = Number(process.env.PORT) || 8788;
const HOST = process.env.HOST || '0.0.0.0';

// ── Global Middleware ──
app.use('*', logger());
app.use('*', cors({
  origin: (process.env.ALLOWED_ORIGINS || '').split(','),
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ── Error Handlers ──
app.onError(errorHandler);
app.notFound(notFoundHandler);

// ── Public Routes ──
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    version: '6.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.route('/api/auth', authRouter);

// ── rent8 Compatibility API (for WeChat Mini Program) ──
// These endpoints are public (no JWT) and use rent8 response format
app.route('/', rent8Compat);

// ── Protected Routes (JWT) ──
app.use('/api/*', jwt({
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  alg: 'HS256',
}));

app.route('/api/properties', propertiesRouter);
app.route('/api/tenants', tenantsRouter);
app.route('/api/records', recordsRouter);
app.route('/api/contracts', contractsRouter);
app.route('/api/payments', paymentsRouter);
app.route('/api/transactions', transactionsRouter);
app.route('/api/expenses', expensesRouter);
app.route('/api/work-orders', workOrdersRouter);
app.route('/api/meter-drafts', meterDraftsRouter);
app.route('/api/utility-bills', utilityBillsRouter);
app.route('/api/message-logs', messageLogsRouter);
app.route('/api/receipts', receiptsRouter);
app.route('/api/reminders', remindersRouter);
app.route('/api/wechat', wechatRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/reports', reportsRouter);

// ── Static Files (Frontend) ──
app.get('/*', async (c) => {
  const path = c.req.path;
  if (path.startsWith('/assets/') || path.startsWith('/uploads/')) {
    return c.body('Static file serving not implemented yet', 404);
  }
  return c.html('<!DOCTYPE html><html><body><div id="root"></div><script src="/assets/index.js"></script></body></html>');
});

// ── Initialize Database ──
await initDb();

// ── Create Admin User (after DB init) ──
await ensureAdminUser();

// ── Start Server ──
console.log(`[V6 API] Starting server on http://${HOST}:${PORT}`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});

export default app;
