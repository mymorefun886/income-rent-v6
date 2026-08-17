// Integration tests for transactions routes
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { app } from '../../test-app';
import { db } from '../../db';
import { transactions, users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateAccessToken } from '../../utils/auth';

describe('Transactions API', () => {
  let authToken: string;
  let testTransactionId: string;

  beforeAll(async () => {
    const adminUser = await db.query.users.findFirst({
      where: eq(users.username, 'admin'),
    });

    if (adminUser) {
      authToken = await generateAccessToken(adminUser.id, adminUser.username, adminUser.role);
    }
  });

  afterAll(async () => {
    await db.delete(transactions).where(eq(transactions.note, 'Test transaction'));
  });

  beforeEach(async () => {
    await db.delete(transactions).where(eq(transactions.note, 'Test transaction'));
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${authToken}`,
  });

  describe('GET /api/transactions', () => {
    it('should return list of transactions', async () => {
      const res = await app.request('/api/transactions', {
        headers: authHeaders(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('items');
      expect(Array.isArray(body.data.items)).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await app.request('/api/transactions');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/transactions', () => {
    it('should create a new transaction', async () => {
      const transactionData = {
        amount: 1000,
        type: 'rent_income',
        note: 'Test transaction',
      };

      const res = await app.request('/api/transactions', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.amount).toBe(transactionData.amount);
      expect(body.data.status).toBe('unmatched');

      testTransactionId = body.data.id;
    });

    it('should fail without amount', async () => {
      const res = await app.request('/api/transactions', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'No amount' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/transactions/:id', () => {
    it('should update transaction', async () => {
      // Create first
      const createRes = await app.request('/api/transactions', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: 500, note: 'Test transaction' }),
      });
      const { data } = await createRes.json();

      // Update
      const res = await app.request(`/api/transactions/${data.id}`, {
        method: 'PUT',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'Updated note' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.note).toBe('Updated note');
    });
  });

  describe('DELETE /api/transactions/:id', () => {
    it('should delete transaction', async () => {
      // Create first
      const createRes = await app.request('/api/transactions', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: 500, note: 'Test transaction' }),
      });
      const { data } = await createRes.json();

      // Delete
      const res = await app.request(`/api/transactions/${data.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      expect(res.status).toBe(200);

      // Verify
      const getRes = await app.request(`/api/transactions/${data.id}`, {
        headers: authHeaders(),
      });
      expect(getRes.status).toBe(404);
    });
  });
});
