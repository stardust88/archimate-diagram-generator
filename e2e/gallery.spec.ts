import { test, expect } from '@playwright/test';

// Visual snapshots (spec §13). Update with `npm run e2e -- --update-snapshots` after an intended
// rendering change, and review the diff.
test.describe('gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/?page=gallery');
    await page.evaluate(() => document.fonts.ready);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`element and relationship figures (${theme})`, async ({ page }) => {
      await expect(page.getByTestId(`gallery-${theme}`)).toHaveScreenshot(`gallery-${theme}.png`, {
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
