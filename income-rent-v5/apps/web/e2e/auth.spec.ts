// E2E test - Authentication flow
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=收租佬系统 V5')).toBeVisible();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('.text-destructive, .error-message, [role="alert"]')).toBeVisible({ timeout: 5000 });
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'changeme');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
    await expect(page.locator('text=首页').first()).toBeVisible();
  });

  test('should maintain session after refresh', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'changeme');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

    // Refresh page
    await page.reload();

    // Should still be logged in
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'changeme');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

    // Click logout
    await page.click('text=退出登录');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login$/, { timeout: 10000 });
  });
});
