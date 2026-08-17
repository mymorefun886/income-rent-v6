// Integration tests for reminders routes
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../test-app';
import { db } from '../../db';
import { reminders, users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateAccessToken } from '../../utils/auth';

describe('Reminders API', () => {
  let authToken: string;

  beforeAll(async () => {
    const adminUser = await db.query.users.findFirst({
      where: eq(users.username, 'admin'),
    });

    if (adminUser) {
      authToken = await generateAccessToken(adminUser.id, adminUser.username, adminUser.role);
    }

    // Clean up
    await db.delete(reminders);
  });

  afterAll(async () => {
    await db.delete(reminders);
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${authToken}`,
  });

  describe('GET /api/reminders', () => {
    it('should return list of reminders', async () => {
      const res = await app.request('/api/reminders', {
        headers: authHeaders(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await app.request('/api/reminders');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/reminders', () => {
    it('should create a new reminder', async () => {
      const reminderData = {
        tenantId: 'test-tenant-id',
        room: 'Test Room 101',
        daysBefore: 30,
        remindTime: '09:00',
        dueDate: '2026-12-31',
        enabled: true,
      };

      const res = await app.request('/api/reminders', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reminderData),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.room).toBe(reminderData.room);
      expect(body.data.daysBefore).toBe(reminderData.daysBefore);
    });

    it('should fail without tenantId', async () => {
      const res = await app.request('/api/reminders', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ room: 'No tenant' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/reminders/:id', () => {
    it('should update reminder', async () => {
      // Create first
      const createRes = await app.request('/api/reminders', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: 'test-tenant-id',
          room: 'Test Room 101',
        }),
      });
      const { data } = await createRes.json();

      // Update
      const res = await app.request(`/api/reminders/${data.id}`, {
        method: 'PUT',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: false }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.enabled).toBe(0);
    });
  });

  describe('DELETE /api/reminders/:id', () => {
    it('should delete reminder', async () => {
      // Create first
      const createRes = await app.request('/api/reminders', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: 'test-tenant-id',
          room: 'Test Room 101',
        }),
      });
      const { data } = await createRes.json();

      // Delete
      const res = await app.request(`/api/reminders/${data.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      expect(res.status).toBe(200);

      // Verify
      const getRes = await app.request(`/api/reminders/${data.id}`, {
        headers: authHeaders(),
      });
      expect(getRes.status).toBe(404);
    });
  });

  describe('GET /api/reminders/upcoming', () => {
    it('should return upcoming reminders', async () => {
      const res = await app.request('/api/reminders/upcoming', {
        headers: authHeaders(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });
});
