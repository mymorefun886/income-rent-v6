// Reports routes - 报表和高级统计
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { properties, tenants, records, contracts, payments, expenses, workOrders } from '../db/schema.js';
import { eq, gte, lte, and, sql, desc, asc } from 'drizzle-orm';

export const reportsRouter = new Hono();

// ── GET /api/reports/income-statement ──
// 收入支出报表
reportsRouter.get('/income-statement', async (c) => {
  try {
    const year = Number(c.req.query('year') || new Date().getFullYear());
    const month = c.req.query('month');

    // 获取所有记录
    const allRecords = await db.select().from(records);
    const allExpenses = await db.select().from(expenses);
    const allPayments = await db.select().from(payments);

    // 按月汇总
    const monthlyReport = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthStr = `${year}-${String(m).padStart(2, '0')}`;

      // 收入（已收）
      const income = allPayments
        .filter((p) => {
          const d = p.paidAt ? new Date(p.paidAt) : null;
          return d && d.getFullYear() === year && d.getMonth() === i;
        })
        .reduce((sum, p) => sum + p.amount, 0);

      // 支出
      const expense = allExpenses
        .filter((e) => e.period === monthStr)
        .reduce((sum, e) => sum + e.amount, 0);

      // 应收
      const receivable = allRecords
        .filter((r) => {
          const d = r.createdAt ? new Date(r.createdAt) : null;
          return d && d.getFullYear() === year && d.getMonth() === i;
        })
        .reduce((sum, r) => sum + r.receivable, 0);

      return {
        month: monthStr,
        income,
        expense,
        net: income - expense,
        receivable,
      };
    });

    // 如果指定了月份，只返回该月
    if (month) {
      const filtered = monthlyReport.filter((r) => r.month === month);
      return c.json({ success: true, data: filtered[0] || null });
    }

    // 年度汇总
    const summary = {
      totalIncome: monthlyReport.reduce((s, r) => s + r.income, 0),
      totalExpense: monthlyReport.reduce((s, r) => s + r.expense, 0),
      totalNet: monthlyReport.reduce((s, r) => s + r.net, 0),
      totalReceivable: monthlyReport.reduce((s, r) => s + r.receivable, 0),
    };

    return c.json({
      success: true,
      data: {
        monthly: monthlyReport,
        summary,
      },
    });
  } catch (error) {
    console.error('[Reports] Income statement error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ── GET /api/reports/occupancy ──
// 出租率报表
reportsRouter.get('/occupancy', async (c) => {
  try {
    const allProperties = await db.select().from(properties);
    const activeContracts = await db.select().from(contracts).where(eq(contracts.status, 'active'));
    const allTenants = await db.select().from(tenants);

    const propertyCount = allProperties.length;
    const occupiedCount = activeContracts.length;
    const tenantCount = allTenants.filter((t) => !t.archived).length;

    // 按房源统计
    const propertyStats = allProperties.map((prop) => {
      const contractsForProp = activeContracts.filter((c) => c.propertyId === prop.id);
      return {
        id: prop.id,
        name: prop.name,
        address: prop.address,
        occupied: contractsForProp.length > 0,
        tenantCount: contractsForProp.length,
        totalRent: contractsForProp.reduce((s, c) => s + c.rent, 0),
      };
    });

    return c.json({
      success: true,
      data: {
        totalProperties: propertyCount,
        occupiedProperties: occupiedCount,
        vacantProperties: propertyCount - occupiedCount,
        occupancyRate: propertyCount > 0 ? Math.round((occupiedCount / propertyCount) * 100) : 0,
        totalTenants: tenantCount,
        properties: propertyStats,
      },
    });
  } catch (error) {
    console.error('[Reports] Occupancy error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ── GET /api/reports/tenant-balance ──
// 租客余额报表（欠费/预存）
reportsRouter.get('/tenant-balance', async (c) => {
  try {
    const allTenants = await db.select().from(tenants).where(eq(tenants.archived, false));
    const allRecords = await db.select().from(records);

    const tenantBalances = allTenants.map((tenant) => {
      const tenantRecords = allRecords.filter((r) => r.tenantId === tenant.id);
      const totalReceivable = tenantRecords.reduce((s, r) => s + r.receivable, 0);
      const totalReceived = tenantRecords.reduce((s, r) => s + (r.received || 0), 0);
      const balance = totalReceived - totalReceivable; // 正数=预存，负数=欠费

      return {
        id: tenant.id,
        name: tenant.name,
        phone: tenant.phone,
        roomLabel: tenant.roomLabel,
        totalReceivable,
        totalReceived,
        balance,
        status: balance >= 0 ? 'credit' : 'debt',
      };
    });

    // 欠费租客
    const debtors = tenantBalances
      .filter((t) => t.balance < 0)
      .sort((a, b) => a.balance - b.balance);

    // 预存租客
    const creditors = tenantBalances
      .filter((t) => t.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    return c.json({
      success: true,
      data: {
        tenants: tenantBalances,
        debtors,
        creditors,
        totalDebt: debtors.reduce((s, d) => s + Math.abs(d.balance), 0),
        totalCredit: creditors.reduce((s, c) => s + c.balance, 0),
      },
    });
  } catch (error) {
    console.error('[Reports] Tenant balance error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ── GET /api/reports/work-order-summary ──
// 工单统计报表
reportsRouter.get('/work-order-summary', async (c) => {
  try {
    const allWorkOrders = await db.select().from(workOrders);
    const allExpenses = await db.select().from(expenses);

    // 按状态统计
    const byStatus = {
      open: allWorkOrders.filter((w) => w.status === 'open').length,
      in_progress: allWorkOrders.filter((w) => w.status === 'in_progress').length,
      completed: allWorkOrders.filter((w) => w.status === 'completed').length,
      cancelled: allWorkOrders.filter((w) => w.status === 'cancelled').length,
    };

    // 按优先级统计
    const byPriority = {
      urgent: allWorkOrders.filter((w) => w.priority === 'urgent').length,
      high: allWorkOrders.filter((w) => w.priority === 'high').length,
      normal: allWorkOrders.filter((w) => w.priority === 'normal').length,
      low: allWorkOrders.filter((w) => w.priority === 'low').length,
    };

    // 费用统计
    const totalEstimated = allWorkOrders.reduce((s, w) => s + w.costEstimate, 0);
    const totalActual = allWorkOrders.reduce((s, w) => s + w.amount, 0);

    // 关联的支出
    const workOrderExpenses = allExpenses.filter((e) => e.workOrderId);
    const totalExpensesFromWO = workOrderExpenses.reduce((s, e) => s + e.amount, 0);

    return c.json({
      success: true,
      data: {
        total: allWorkOrders.length,
        byStatus,
        byPriority,
        totalEstimated,
        totalActual,
        variance: totalActual - totalEstimated,
        totalExpensesFromWO,
      },
    });
  } catch (error) {
    console.error('[Reports] Work order summary error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});


// ── GET /api/reports/export ──
// 导出报表数据（JSON格式，前端可转换为Excel）
reportsRouter.get('/export', async (c) => {
  try {
    const type = c.req.query('type') || 'all';
    const year = Number(c.req.query('year') || new Date().getFullYear());

    const result: Record<string, unknown> = {};

    if (type === 'all' || type === 'income') {
      const allPayments = await db.select().from(payments);
      const allExpenses = await db.select().from(expenses);

      result.income = allPayments.map((p) => ({
        type: '收入',
        date: p.paidAt,
        amount: p.amount,
        method: p.method,
        memo: p.memo,
      }));

      result.expenses = allExpenses.map((e) => ({
        type: '支出',
        date: e.date,
        amount: e.amount,
        category: e.category,
        payee: e.payee,
        note: e.note,
      }));
    }

    if (type === 'all' || type === 'contracts') {
      const allContracts = await db.select().from(contracts);
      result.contracts = allContracts;
    }

    if (type === 'all' || type === 'work-orders') {
      const allWorkOrders = await db.select().from(workOrders);
      result.workOrders = allWorkOrders;
    }

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('[Reports] Export error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});
