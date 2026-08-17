// Test setup file
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock matchMedia for theme tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock localStorage
const localStorageMock = {
  getItem: (_key: string | null) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
  clear: () => {},
  length: 0,
  key: (_index: number | null) => null,
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
}
Object.defineProperty(window, 'IntersectionObserver', {
  value: IntersectionObserverMock,
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
}
Object.defineProperty(window, 'ResizeObserver', {
  value: ResizeObserverMock,
});
