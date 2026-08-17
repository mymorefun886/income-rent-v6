// Unit tests for API client
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, authApi, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth store
    useAuthStore.setState({
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      user: null,
      isAuthenticated: false,
    });
  });

  describe('api function', () => {
    it('should make GET request', async () => {
      const mockData = { success: true, data: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await api('/test');

      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
      }));
      expect(result).toEqual(mockData);
    });

    it('should make POST request with body', async () => {
      const mockData = { success: true, data: { id: '1' } };
      const body = { name: 'Test' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const result = await api('/test', { method: 'POST', body });

      expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }));
      expect(result).toEqual(mockData);
    });

    it('should throw ApiError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad request' }),
      });

      try {
        await api('/test');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(400);
      }
    });

    it('should handle 401 with token refresh', async () => {
      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        status: 401,
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
      });

      // Refresh call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { accessToken: 'new-token' },
        }),
      });

      // Retry succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: 'result' }),
      });

      const result = await api('/test');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(useAuthStore.getState().accessToken).toBe('new-token');
      expect(result.data).toBe('result');
    });
  });

  describe('authApi', () => {
    it('should call login endpoint', async () => {
      const mockResponse = {
        success: true,
        data: {
          accessToken: 'token',
          refreshToken: 'refresh',
          user: { id: '1', username: 'test' },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authApi.login('testuser', 'password');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ username: 'testuser', password: 'password' }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call logout endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await authApi.logout();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should call me endpoint', async () => {
      const mockUser = { id: '1', username: 'test', role: 'admin' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockUser }),
      });

      const result = await authApi.me();

      expect(result.data).toEqual(mockUser);
    });
  });
});
