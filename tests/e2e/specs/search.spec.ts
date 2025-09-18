import { test, expect } from '@playwright/test';
test('dev login + geo + hotel inputs', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Dev Login').click();
  await page.getByText('Logged in').waitFor({ timeout: 5000 });
  await page.fill('input[placeholder="City"]', 'Rovaniemi');
  await page.fill('input[placeholder="Hotel City Code (IATA)"]', 'RVN');
  await page.fill('input[placeholder="Check-in YYYY-MM-DD"]', '2025-12-01');
  await page.getByText('Search').click();
  await expect(page.getByText('Rovaniemi')).toBeVisible();
});
