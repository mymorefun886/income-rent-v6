// Test app - creates Hono app without starting server
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { authRouter } from './routes/auth';
import { propertiesRouter } from './routes/properties';
import { tenantsRouter } from './routes/tenants';
import { recordsRouter } from './routes/records';
import { contractsRouter } from './routes/contracts';
import { paymentsRouter } from './routes/payments';
import { expensesRouter } from './routes/expenses';
import { workOrdersRouter } from './routes/work-orders';
import { meterRouter } from './routes/meter';
import { dashboardRouter } from './routes/dashboard';
import { reportsRouter } from './routes/reports';

export const app = new Hono();

// CORS
app.use('*', cors({
  origin: ['*'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Public routes
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    version: '5.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.route('/api/auth', authRouter);

// Protected routes
app.use('/api/*', jwt({
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  alg: 'HS256',
}));

app.route('/api/properties', propertiesRouter);
app.route('/api/tenants', tenantsRouter);
app.route('/api/records', recordsRouter);
app.route('/api/contracts', contractsRouter);
app.route('/api/payments', paymentsRouter);
app.route('/api/expenses', expensesRouter);
app.route('/api/work-orders', workOrdersRouter);
app.route('/api/meter', meterRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/reports', reportsRouter);
