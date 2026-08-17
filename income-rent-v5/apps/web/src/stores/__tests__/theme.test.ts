// Unit tests for theme store
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore } from '@/stores/theme';

// Mock document.documentElement
const mockClassList = {
  add: vi.fn(),
  remove: vi.fn(),
  contains: vi.fn(),
  toggle: vi.fn(),
};

Object.defineProperty(document, 'documentElement', {
  value: {
    classList: mockClassList,
    style: {
      colorScheme: '',
    },
  },
  writable: true,
});

describe('Theme Store', () => {
  beforeEach(() => {
    // Reset store and mocks
    useThemeStore.setState({
      theme: 'system',
    });
    vi.clearAllMocks();
  });

  it('should have system theme as default', () => {
    expect(useThemeStore.getState().theme).toBe('system');
  });

  it('should set theme to light', () => {
    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('should set theme to dark', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('should toggle from light to dark', () => {
    useThemeStore.getState().setTheme('light');
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('should toggle from dark to light', () => {
    useThemeStore.getState().setTheme('dark');
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('should toggle from system to dark', () => {
    useThemeStore.getState().setTheme('system');
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('dark');
  });
});
