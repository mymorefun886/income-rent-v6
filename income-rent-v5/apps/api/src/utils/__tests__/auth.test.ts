// Unit tests for auth utilities
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
} from '../auth';

describe('Auth Utilities', () => {
  // ── Password Hashing (pure functions, no DB needed) ──
  describe('Password Hashing', () => {
    it('should hash password', async () => {
      const hash = await hashPassword('mypassword');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('mypassword');
      expect(hash.startsWith('$2a$')).toBe(true);
    });

    it('should verify correct password', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hash = await hashPassword('correctpassword');
      const isValid = await verifyPassword('wrongpassword', hash);
      expect(isValid).toBe(false);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'samepassword';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
      // But both should verify correctly
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });
  });

  // ── JWT Tokens (pure functions, no DB needed) ──
  describe('JWT Tokens', () => {
    it('should generate access token', async () => {
      const token = await generateAccessToken('user-1', 'testuser', 'admin');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      // JWT has 3 parts separated by dots
      expect(token.split('.')).toHaveLength(3);
    });

    it('should verify valid access token', async () => {
      const payload = { sub: 'user-1', username: 'testuser', role: 'admin' };
      const token = await generateAccessToken(payload.sub, payload.username, payload.role);
      const decoded = await verifyAccessToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe(payload.sub);
      expect(decoded?.username).toBe(payload.username);
      expect(decoded?.role).toBe(payload.role);
    });

    it('should reject invalid token', async () => {
      const decoded = await verifyAccessToken('invalid.token.here');
      expect(decoded).toBeNull();
    });

    it('should reject tampered token', async () => {
      const token = await generateAccessToken('user-1', 'testuser', 'admin');
      const parts = token.split('.');
      // Tamper with the payload
      parts[1] = Buffer.from('{"sub":"hacker"}').toString('base64url');
      const tamperedToken = parts.join('.');
      const decoded = await verifyAccessToken(tamperedToken);
      expect(decoded).toBeNull();
    });
  });
});

