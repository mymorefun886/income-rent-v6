// Integration tests for meter drafts routes
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../test-app';
import { db } from '../../db';
import { meterDrafts, users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateAccessToken } from '../../utils/auth';

describe('Meter Drafts API', () => {
  let authToken: string;

  beforeAll(async () => {
    const adminUser = await db.query.users.findFirst({
      where: eq(users.username, 'admin'),
    });

    if (adminUser) {
      authToken = await generateAccessToken(adminUser.id, adminUser.username, adminUser.role);
    }

    // Clean up
    await db.delete(meterDrafts);
  });

  afterAll(async () => {
    await db.delete(meterDrafts);
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${authToken}`,
  });

  describe('GET /api/meter-drafts', () => {
    it('should return list of meter drafts', async () => {
      const res = await app.request('/api/meter-drafts', {
        headers: authHeaders(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await app.request('/api/meter-drafts');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/meter-drafts', () => {
    it('should create a new meter draft', async () => {
      const draftData = {
        building: 'Test Building',
        room: '101',
        cycle: '2026-08',
        electricNow: '1000',
        waterNow: '500',
      };

      const res = await app.request('/api/meter-drafts', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draftData),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.building).toBe(draftData.building);
      expect(body.data.electricNow).toBe(draftData.electricNow);
    });
  });

  describe('PUT /api/meter-drafts/:id', () => {
    it('should update meter draft', async () => {
      // Create first
      const createRes = await app.request('/api/meter-drafts', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          building: 'Test Building',
          room: '101',
          cycle: '2026-08',
        }),
      });
      const { data } = await createRes.json();

      // Update
      const res = await app.request(`/api/meter-drafts/${data.id}`, {
        method: 'PUT',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ electricNow: '2000' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.electricNow).toBe('2000');
    });
  });

  describe('DELETE /api/meter-drafts/:id', () => {
    it('should delete meter draft', async () => {
      // Create first
      const createRes = await app.request('/api/meter-drafts', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          building: 'Test Building',
          room: '101',
          cycle: '2026-08',
        }),
      });
      const { data } = await createRes.json();

      // Delete
      const res = await app.request(`/api/meter-drafts/${data.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      expect(res.status).toBe(200);

      // Verify
      const getRes = await app.request(`/api/meter-drafts/${data.id}`, {
        headers: authHeaders(),
      });
      expect(getRes.status).toBe(404);
    });
  });
});
