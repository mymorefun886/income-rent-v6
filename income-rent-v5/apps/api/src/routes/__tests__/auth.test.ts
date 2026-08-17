// Integration tests for auth routes
import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../test-app';

describe('Auth API', () => {
  describe('GET /api/health', () => {
    it('should return health status without auth', async () => {
      const res = await app.request('/api/health');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.version).toBe('5.0.0');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'changeme',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      expect(body.data.user.username).toBe('admin');
    });

    it('should reject invalid credentials', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'wrongpassword',
        }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('should require username and password', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const res = await app.request('/api/auth/logout', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should require refresh token', async () => {
      const res = await app.request('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it('should reject invalid refresh token', async () => {
      const res = await app.request('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'invalid-token' }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should require authentication', async () => {
      const res = await app.request('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return user info with valid token', async () => {
      // First login to get token
      const loginRes = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'changeme',
        }),
      });
      const { data } = await loginRes.json();

      // Then get user info
      const res = await app.request('/api/auth/me', {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.username).toBe('admin');
    });
  });
});
