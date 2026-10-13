import { test, expect } from '@playwright/test';

test('app shell loads with empty state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('toolbar', { name: 'Main toolbar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New model' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open ArchiMate XML' })).toBeVisible();
});
