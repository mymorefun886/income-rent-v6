// Unit tests for auth store
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  });

  it('should have initial state', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set auth on login', () => {
    const user = {
      id: 'user-1',
      username: 'admin',
      role: 'admin' as const,
    };

    useAuthStore.getState().setAuth('access-token', 'refresh-token', user);

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('access-token');
    expect(state.refreshToken).toBe('refresh-token');
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
  });

  it('should clear auth on logout', () => {
    // First set auth
    useAuthStore.getState().setAuth('token', 'refresh', {
      id: '1',
      username: 'test',
      role: 'admin',
    });

    // Then clear
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should update access token', () => {
    // Set initial auth
    useAuthStore.getState().setAuth('old-token', 'refresh', {
      id: '1',
      username: 'test',
      role: 'admin',
    });

    // Update token
    useAuthStore.getState().updateAccessToken('new-token');

    expect(useAuthStore.getState().accessToken).toBe('new-token');
    // Other state should remain unchanged
    expect(useAuthStore.getState().refreshToken).toBe('refresh');
  });
});
