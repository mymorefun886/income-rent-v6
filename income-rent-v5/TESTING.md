# Testing Guide - 收租佬系统 V5

## Overview

This document describes the testing strategy for the rental management system V5.

## Test Structure

```
apps/
├── api/
│   └── src/
│       ├── test/                    # Test setup
│       ├── utils/__tests__/         # Unit tests for utilities
│       └── routes/__tests__/        # Integration tests for routes
└── web/
    ├── e2e/                         # End-to-end tests
    └── src/
        ├── stores/__tests__/        # Store unit tests
        ├── lib/__tests__/           # API client tests
        └── components/__tests__/    # Component unit tests
```

## Running Tests

### Unit Tests (Vitest)

```bash
# Run all unit tests
pnpm test

# Run API unit tests
pnpm --filter api test

# Run Web unit tests
pnpm --filter web test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm --filter api test:watch
pnpm --filter web test:watch
```

### E2E Tests (Playwright)

```bash
# Install Playwright browsers (first time)
pnpm exec playwright install

# Run E2E tests
pnpm --filter web test:e2e

# Run with UI mode (for debugging)
pnpm --filter web test:e2e:ui

# Run specific test file
pnpm exec playwright test apps/web/e2e/auth.spec.ts
```

## Test Categories

### 1. Unit Tests

#### Backend (apps/api)
- **Auth utilities**: Password hashing, JWT tokens, session management
- **Route handlers**: CRUD operations, validation, error handling

#### Frontend (apps/web)
- **Stores**: Auth store, theme store state management
- **API client**: Request handling, token refresh, error handling
- **Components**: ThemeToggle, Button rendering and interactions

### 2. Integration Tests

- **Auth API**: Login, logout, refresh, me endpoints
- **Properties API**: CRUD operations, authentication requirements

### 3. E2E Tests

- **Authentication flow**: Login, logout, session persistence
- **Properties management**: Create, read, update, delete properties
- **Dashboard & Navigation**: Page navigation, theme toggle, responsive design

## Test Data

### Default Test User
- Username: `admin`
- Password: `changeme`

### Creating Test Data

Tests should create their own data and clean up after themselves. Use unique identifiers (timestamps) to avoid conflicts.

## Continuous Integration

Example GitHub Actions workflow:

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm test
      - run: pnpm exec playwright install
      - run: pnpm test:e2e
```

## Coverage Goals

- Unit tests: > 80% code coverage
- Integration tests: All API endpoints
- E2E tests: Critical user flows

## Debugging Tests

### Vitest Debug
```bash
pnpm --filter api test --reporter=verbose
pnpm --filter web test --reporter=verbose
```

### Playwright Debug
```bash
# Run with browser visible
pnpx playwright test --headed

# Pause execution for debugging
pnpx playwright test --debug

# Step through test
pnpx playwright test --trace on
```

## Common Issues

1. **Port conflicts**: Ensure ports 5173 (web) and 8788 (api) are free
2. **Database locked**: Stop any running dev servers before testing
3. **Browser not found**: Run `pnpx playwright install` to install browsers
