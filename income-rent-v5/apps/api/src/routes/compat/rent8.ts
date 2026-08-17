/**
 * rent8 Compatibility API Adapter
 *
 * Provides rent8-style API endpoints for the rent8_wechat mini program.
 * Translates rent8 request format to V6 internal format.
 *
 * rent8 uses:
 * - form-urlencoded POST data
 * - Returns { code: 1, data: ..., msg: ... }
 * - Session-based auth with Authorization header
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { properties, tenants, records, users } from '../../db/schema.js';
import { eq, and, desc, like, sql } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../../utils/auth.js';

export const rent8Compat = new Hono();

// ============================================================
// Auth
// ============================================================

// POST api/user/login
rent8Compat.post('/api/user/login', async (c) => {
  try {
    const body = await c.req.parseBody();
    const { name, password } = body;

    if (!name || !password) {
      return c.json({ code: 0, msg: '用戶名或密碼不能為空' });
    }

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.username, name as string),
    });

    if (!user) {
      return c.json({ code: 0, msg: '用戶不存在' });
    }

    // Verify password
    const valid = await verifyPassword(password as string, user.passwordHash);
    if (!valid) {
      return c.json({ code: 0, msg: '密碼錯誤' });
    }

    // Generate session token
    const sessionToken = crypto.randomUUID();

    return c.json({
      code: 1,
      msg: '登錄成功',
      data: {
        session_id: sessionToken,
        name: user.username,
        id: user.id,
      },
    });
  } catch (err) {
    console.error('[rent8 compat] login error:', err);
    return c.json({ code: 0, msg: '登錄失敗' });
  }
});

// GET api/user/userinfo
rent8Compat.get('/api/user/userinfo', async (c) => {
  // Return user info based on session
  return c.json({
    code: 1,
    data: {
      name: 'admin',
      role: 'admin',
    },
  });
});

// ============================================================
// Properties (房產/房間)
// ============================================================

// GET api/property/queryPropertyAll
rent8Compat.get('/api/property/queryPropertyAll', async (c) => {
  try {
    const props = await db.query.properties.findMany({
      orderBy: desc(properties.createdAt),
    });

    // Convert to rent8 format
    const data = props.map((p, idx) => ({
      value: p.id,
      label: p.building || p.name,
      name: p.building || p.name,
      address: p.address,
      firstly: idx === 0 ? 'Y' : 'N', // First one is default
    }));

    return c.json({ code: 1, data });
  } catch (err) {
    console.error('[rent8 compat] queryPropertyAll error:', err);
    return c.json({ code: 0, msg: '查詢失敗' });
  }
});

// GET api/number/queryNumber
rent8Compat.post('/api/number/queryNumber', async (c) => {
  try {
    const body = await c.req.parseBody();
    const houseId = body.house_id as string;

    // Get rooms for a property
    const rooms = await db.query.tenants.findMany({
      where: and(
        eq(tenants.propertyId, houseId),
        eq(tenants.archived, false)
      ),
    });

    const data = rooms.map((t) => ({
      id: t.id,
      name: t.roomLabel || t.name,
      rental: t.rent,
      deposit: t.deposit,
      tenant_name: t.name,
      tenant_phone: t.phone,
      checkin_time: t.leaseStart,
      leave_time: t.leaseEnd,
      status: t.status,
    }));

    return c.json({ code: 1, data });
  } catch (err) {
    console.error('[rent8 compat] queryNumber error:', err);
    return c.json({ code: 0, msg: '查詢失敗' });
  }
});

// ============================================================
// Bills (賬單)
// ============================================================

// POST api/bill/queryBill
rent8Compat.post('/api/bill/queryBill', async (c) => {
  try {
    const body = await c.req.parseBody();
    const houseId = body.house_id as string;

    // Get all records (bills) for a property
    const bills = await db.query.records.findMany({
      where: eq(records.building, body.house_name as string),
      orderBy: desc(records.createdAt),
    });

    const data = bills.map((b) => ({
      id: b.id,
      house_property_id: houseId,
      house_number_id: b.room,
      tenant_name: b.tenantName,
      cycle: b.cycle,
      rental: b.rentPart,
      receivable: b.receivable,
      received: b.received,
      status: b.status,
      payment_date: b.paidAt,
      electricity_cost: b.electricCost,
      water_cost: b.waterCost,
      total_money: b.receivable,
    }));

    return c.json({ code: 1, data });
  } catch (err) {
    console.error('[rent8 compat] queryBill error:', err);
    return c.json({ code: 0, msg: '查詢失敗' });
  }
});

// POST api/uncollected/queryUncollected
rent8Compat.post('/api/uncollected/queryUncollected', async (c) => {
  try {
    const body = await c.req.parseBody();
    const houseId = body.house_id as string;

    // Get unpaid bills
    const bills = await db.query.records.findMany({
      where: and(
        eq(records.building, body.house_name as string),
        eq(records.status, '未收')
      ),
      orderBy: desc(records.createdAt),
    });

    const data = bills.map((b) => ({
      id: b.id,
      house_property_id: houseId,
      house_number_id: b.room,
      tenant_name: b.tenantName,
      cycle: b.cycle,
      rental: b.rentPart,
      total_money: b.receivable,
      payment_date: b.paidAt,
    }));

    return c.json({ code: 1, data });
  } catch (err) {
    console.error('[rent8 compat] queryUncollected error:', err);
    return c.json({ code: 0, msg: '查詢失敗' });
  }
});

// POST api/uncollected/report (收據單詳情)
rent8Compat.post('/api/uncollected/report', async (c) => {
  try {
    const body = await c.req.parseBody();
    const id = body.id as string;

    const bill = await db.query.records.findFirst({
      where: eq(records.id, id),
    });

    if (!bill) {
      return c.json({ code: 0, msg: '賬單不存在' });
    }

    // Format for rent8 receipt display
    const data = {
      number_id: bill.room,
      start_time: bill.cycle + '-01',
      end_time: bill.cycle + '-28',
      electricity_meter_this_month: bill.electricNow,
      electricity_meter_last_month: bill.electricPrev,
      electricity_consumption: bill.electricUsage,
      electricity_price: bill.electricPrice,
      electricity: bill.electricCost,
      water_meter_this_month: bill.waterNow,
      water_meter_last_month: bill.waterPrev,
      water_consumption: bill.waterUsage,
      water_price: bill.waterPrice,
      water: bill.waterCost,
      rental: bill.rentPart,
      deposit: bill.depositAmount,
      total_money: bill.receivable,
      note: bill.note,
    };

    return c.json({ code: 1, data });
  } catch (err) {
    console.error('[rent8 compat] report error:', err);
    return c.json({ code: 0, msg: '查詢失敗' });
  }
});

// POST api/uncollected/account (確認到賬)
rent8Compat.post('/api/uncollected/account', async (c) => {
  try {
    const body = await c.req.parseBody();
    const { id, payment_date } = body;

    if (!id) {
      return c.json({ code: 0, msg: '參數錯誤' });
    }

    // Update record to paid
    await db
      .update(records)
      .set({
        status: '已收',
        received: sql`${records.receivable}`,
        paidAt: payment_date as string || new Date().toISOString(),
        updatedAt: new Date(),
      })
      .where(eq(records.id, id as string));

    return c.json({ code: 1, msg: '確認成功' });
  } catch (err) {
    console.error('[rent8 compat] account error:', err);
    return c.json({ code: 0, msg: '確認失敗' });
  }
});

// ============================================================
// Fees (其他收費項目)
// ============================================================

// GET api/fee/queryFee
rent8Compat.get('/api/fee/queryFee', async (c) => {
  // Return fee items configuration
  const data = [
    { column_id: 'fees1', column_name: '物業費', default: '0' },
    { column_id: 'fees2', column_name: '網絡費', default: '0' },
    { column_id: 'fees3', column_name: '垃圾費', default: '0' },
    { column_id: 'fees4', column_name: '其他', default: '0' },
  ];

  return c.json({ code: 1, data });
});

// GET api/fee/queryFee2 (收據單的費用明細)
rent8Compat.get('/api/fee/queryFee2', async (c) => {
  const feeArr = [
    { column_id: 'fees1', column_name: '物業費', value: '0' },
    { column_id: 'fees2', column_name: '網絡費', value: '0' },
    { column_id: 'fees3', column_name: '垃圾費', value: '0' },
    { column_id: 'fees4', column_name: '其他', value: '0' },
  ];

  return c.json({ code: 1, data: feeArr });
});

// ============================================================
// Checkout (退房)
// ============================================================

// POST api/bill/checkout
rent8Compat.post('/api/bill/checkout', async (c) => {
  try {
    const body = await c.req.parseBody();
    const { id, leave_time } = body;

    if (!id) {
      return c.json({ code: 0, msg: '參數錯誤' });
    }

    // Mark tenant as checked out
    await db
      .update(records)
      .set({
        checkout: true,
        status: '已結清',
        updatedAt: new Date(),
      })
      .where(eq(records.id, id as string));

    // Update tenant
    const bill = await db.query.records.findFirst({
      where: eq(records.id, id as string),
    });

    if (bill) {
      await db
        .update(tenants)
        .set({
          status: '已退租',
          archived: true,
          leaseEnd: leave_time as string,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, bill.tenantId));
    }

    return c.json({ code: 1, msg: '退房成功' });
  } catch (err) {
    console.error('[rent8 compat] checkout error:', err);
    return c.json({ code: 0, msg: '退房失敗' });
  }
});
