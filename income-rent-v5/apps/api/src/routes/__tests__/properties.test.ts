// Integration tests for properties routes
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { app } from '../../test-app';
import { db } from '../../db';
import { properties, users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateAccessToken } from '../../utils/auth';

describe('Properties API', () => {
  let authToken: string;
  let testPropertyId: string;

  beforeAll(async () => {
    // Ensure admin user and get auth token
    const adminUser = await db.query.users.findFirst({
      where: eq(users.username, 'admin'),
    });

    if (adminUser) {
      authToken = await generateAccessToken(adminUser.id, adminUser.username, adminUser.role);
    }
  });

  afterAll(async () => {
    // Clean up test properties
    await db.delete(properties).where(eq(properties.name, 'Test Property'));
  });

  beforeEach(async () => {
    // Clean up before each test
    await db.delete(properties).where(eq(properties.name, 'Test Property'));
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${authToken}`,
  });

  describe('GET /api/properties', () => {
    it('should return list of properties', async () => {
      const res = await app.request('/api/properties', {
        headers: authHeaders(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await app.request('/api/properties');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/properties', () => {
    it('should create a new property', async () => {
      const propertyData = {
        name: 'Test Property',
        address: '123 Test St',
        areaSqm: 100.5,
        notes: 'Test notes',
      };

      const res = await app.request('/api/properties', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(propertyData),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe(propertyData.name);
      expect(body.data.address).toBe(propertyData.address);

      testPropertyId = body.data.id;
    });

    it('should fail without name', async () => {
      const res = await app.request('/api/properties', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: 'No name' }),
      });

      expect(res.status).toBe(400);
    });

    it('should require authentication', async () => {
      const res = await app.request('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/properties/:id', () => {
    it('should return property by id', async () => {
      // First create a property
      const createRes = await app.request('/api/properties', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Test Property' }),
      });
      const { data } = await createRes.json();

      // Then fetch it
      const res = await app.request(`/api/properties/${data.id}`, {
        headers: authHeaders(),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe(data.id);
    });

    it('should return 404 for non-existent property', async () => {
      const res = await app.request('/api/properties/non-existent-id', {
        headers: authHeaders(),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/properties/:id', () => {
    it('should update property', async () => {
      // First create a property
      const createRes = await app.request('/api/properties', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Test Property' }),
      });
      const { data } = await createRes.json();

      // Update it
      const res = await app.request(`/api/properties/${data.id}`, {
        method: 'PUT',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Property' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.name).toBe('Updated Property');
    });

    it('should return 404 for non-existent property', async () => {
      const res = await app.request('/api/properties/non-existent-id', {
        method: 'PUT',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated' }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/properties/:id', () => {
    it('should delete property', async () => {
      // First create a property
      const createRes = await app.request('/api/properties', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Test Property' }),
      });
      const { data } = await createRes.json();

      // Delete it
      const res = await app.request(`/api/properties/${data.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      expect(res.status).toBe(200);

      // Verify it's deleted
      const getRes = await app.request(`/api/properties/${data.id}`, {
        headers: authHeaders(),
      });
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent property', async () => {
      const res = await app.request('/api/properties/non-existent-id', {
        method: 'DELETE',
        headers: authHeaders(),
      });

      expect(res.status).toBe(404);
    });
  });
});
