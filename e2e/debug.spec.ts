import { test, expect } from '@playwright/test';

test('debug page lists the contents of an opened file', async ({ page }) => {
  await page.goto('/?page=debug');
  await page
    .getByLabel('Open Exchange Format file')
    .setInputFiles('fixtures/synthetic/junctions-labels-containers.xml');
  await expect(page.getByText('7 elements · 7 relationships · 1 views · 0 warnings')).toBeVisible();
  await expect(page.getByText('BusinessEvent: Order received')).toBeVisible();
});
