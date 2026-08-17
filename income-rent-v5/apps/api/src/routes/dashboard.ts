// Dashboard statistics routes
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { properties, tenants, records, contracts, payments, expenses, workOrders, utilityBills } from '../db/schema.js';
import { eq, gte, lte, and, sql, desc } from 'drizzle-orm';

export const dashboardRouter = new Hono();

// ── GET /api/dashboard/stats ──
dashboardRouter.get('/stats', async (c) => {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Basic counts using query API
    const allProperties = await db.select().from(properties);
    const allTenants = await db.select().from(tenants);
    const activeContracts = await db.select().from(contracts).where(eq(contracts.status, 'active'));

    // Unpaid records
    const unpaidRecords = await db.select().from(records).where(eq(records.status, 'unpaid'));
    const totalReceivable = unpaidRecords.reduce((sum, r) => sum + r.receivable, 0);

    // Monthly income (records created this month)
    const monthlyRecords = await db.select().from(records).where(
      and(
        gte(records.createdAt, startOfMonth),
        lte(records.createdAt, endOfMonth)
      )
    );
    const totalIncome = monthlyRecords.reduce((sum, r) => sum + (r.received || 0), 0);
    const monthlyReceivable = monthlyRecords.reduce((sum, r) => sum + r.receivable, 0);

    // Monthly expenses（其他支出 from expenses + 水电费 from utilityBills）
    const monthlyExpenses = await db.select().from(expenses).where(eq(expenses.period, currentMonth));
    const otherExpensesTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

    // 水电费从 utilityBills 读取（唯一数据源）
    const monthlyUtilityBills = await db.select().from(utilityBills).where(eq(utilityBills.billPeriod, currentMonth));
    const utilityExpensesTotal = monthlyUtilityBills.reduce((sum, b) => sum + b.totalAmount, 0);

    const totalExpense = otherExpensesTotal + utilityExpensesTotal;

    // Work orders
    const openWorkOrders = await db.select().from(workOrders).where(eq(workOrders.status, 'open'));

    // Occupancy rate (based on tenants with active contracts)
    const propertyCount = allProperties.length;
    const activeContractCount = activeContracts.length;
    const occupancyRate = propertyCount > 0 ? Math.round((activeContractCount / propertyCount) * 100) : 0;

    return c.json({
      success: true,
      data: {
        tenantCount: allTenants.length,
        vacantCount: propertyCount - activeContractCount,
        totalReceivable,
        unpaid: unpaidRecords.length,
        occupancyRate,
        totalIncome,
        monthlyReceivable,
        totalExpense,
        otherExpenses: otherExpensesTotal,
        utilityExpenses: utilityExpensesTotal,
        netIncome: totalIncome - totalExpense,
        openWorkOrders: openWorkOrders.length,
      },
    });
  } catch (error) {
    console.error('[Dashboard] Stats error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ── GET /api/dashboard/monthly ──
dashboardRouter.get('/monthly', async (c) => {
  try {
    const year = Number(c.req.query('year') || new Date().getFullYear());

    // Get all records, expenses, and utility bills
    const allRecords = await db.select().from(records);
    const allExpenses = await db.select().from(expenses);
    const allUtilityBills = await db.select().from(utilityBills);

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      const recordsIncome = allRecords
        .filter((r) => {
          const recordDate = r.paidAt ? new Date(r.paidAt) : null;
          return recordDate && recordDate.getFullYear() === year && recordDate.getMonth() === i;
        })
        .reduce((sum, r) => sum + (r.received || 0), 0);

      const expensesTotal = allExpenses
        .filter((e) => e.period === monthStr)
        .reduce((sum, e) => sum + e.amount, 0);

      // 水电费从 utilityBills 读取
      const utilityTotal = allUtilityBills
        .filter((b) => b.billPeriod === monthStr)
        .reduce((sum, b) => sum + b.totalAmount, 0);

      const totalExpenses = expensesTotal + utilityTotal;

      return {
        month: `${month}月`,
        income: recordsIncome,
        expenses: totalExpenses,
        utility: utilityTotal,
        other: expensesTotal,
        net: recordsIncome - totalExpenses,
      };
    });

    return c.json({ success: true, data: monthlyData });
  } catch (error) {
    console.error('[Dashboard] Monthly error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ── GET /api/dashboard/expense-breakdown ──
dashboardRouter.get('/expense-breakdown', async (c) => {
  try {
    const year = Number(c.req.query('year') || new Date().getFullYear());

    const allExpenses = await db.select().from(expenses);
    const allUtilityBills = await db.select().from(utilityBills);

    const categoryTotals: Record<string, number> = {};

    // 其他支出
    allExpenses.forEach((expense) => {
      const expenseDate = expense.date ? new Date(expense.date) : new Date();
      if (expenseDate.getFullYear() === year) {
        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
      }
    });

    // 水电费（按类型拆分）
    let electricTotal = 0;
    let waterTotal = 0;
    allUtilityBills.forEach((bill) => {
      const billDate = bill.billingStart ? new Date(bill.billingStart) : new Date();
      if (billDate.getFullYear() === year) {
        if (bill.billType === 'electric') {
          electricTotal += bill.totalAmount;
        } else if (bill.billType === 'water') {
          waterTotal += bill.totalAmount;
        }
      }
    });

    if (electricTotal > 0) {
      categoryTotals['电费'] = (categoryTotals['电费'] || 0) + electricTotal;
    }
    if (waterTotal > 0) {
      categoryTotals['水费'] = (categoryTotals['水费'] || 0) + waterTotal;
    }

    const breakdown = Object.entries(categoryTotals).map(([category, total]) => ({
      category,
      total,
    }));

    return c.json({ success: true, data: breakdown });
  } catch (error) {
    console.error('[Dashboard] Expense breakdown error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// ── GET /api/dashboard/recent ──
dashboardRouter.get('/recent', async (c) => {
  try {
    const recentPayments = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(5);
    const recentWorkOrders = await db.select().from(workOrders).orderBy(desc(workOrders.createdAt)).limit(5);

    return c.json({
      success: true,
      data: {
        recentPayments,
        recentWorkOrders,
      },
    });
  } catch (error) {
    console.error('[Dashboard] Recent error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});
