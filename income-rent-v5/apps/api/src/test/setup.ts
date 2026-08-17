// Test setup for API tests
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test defaults
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
if (process.env.TEST_QUIET === 'true') {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
}
