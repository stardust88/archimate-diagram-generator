// Phase 4 features: auto-layout, align/distribute, theme toggle.
import { expect, test } from '@playwright/test';
import { model, nodeLocator, openFixture } from './helpers';

const VIEW = 'id-019dd58b-68f1-765a-bca8-2716884f56b2';

test('Layout view is one undoable command', async ({ page }) => {
  await openFixture(page, 'opengroup/interop-snippet-03.xml');
  const before = await model(page);
  await page.getByRole('toolbar').getByRole('button', { name: 'Layout', exact: true }).click();
  await page
    .getByRole('menu', { name: 'Layout' })
    .getByRole('menuitem', { name: 'Layout view' })
    .click();
  await expect
    .poll(async () => (await model(page)).views[before.viewOrder[0]!])
    .not.toEqual(before.views[before.viewOrder[0]!]);
  const past = await page.evaluate(() =>
    (
      window as unknown as { __editor: { getState(): { past: { undo: { label: string } }[] } } }
    ).__editor
      .getState()
      .past.map((e) => e.undo.label),
  );
  expect(past).toEqual(['Layout view']);
  await page.keyboard.press('Control+z');
  expect(await model(page)).toEqual(before);
});

test('Arrange aligns the selection to the first selected node', async ({ page }) => {
  await openFixture(page, 'archi/bendpoint.test.xml');
  const a = 'id-019dd58c-3116-72be-8618-072b804c1e6d';
  const b = 'id-019dd58c-fbb9-73fa-8251-f74d2a8b73f6';
  // Move b to the right first so alignment has something to do.
  await nodeLocator(page, b).click();
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');
  await nodeLocator(page, a).click();
  await nodeLocator(page, b).click({ modifiers: ['Shift'] });
  await page.getByRole('toolbar').getByRole('button', { name: 'Arrange' }).click();
  await page
    .getByRole('menu', { name: 'Arrange' })
    .getByRole('menuitem', { name: 'Align left' })
    .click();
  const v = (await model(page)).views[VIEW]!;
  expect(v.nodes.find((n) => n.id === b)!.x).toBe(v.nodes.find((n) => n.id === a)!.x);
});

test('theme toggle cycles system, light and dark and persists', async ({ page }) => {
  await openFixture(page, 'archi/bendpoint.test.xml');
  const btn = page.getByRole('toolbar').getByRole('button', { name: /^Theme:/ });
  await expect(btn).toHaveText('Theme: system');
  await btn.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await btn.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page
    .getByRole('toolbar')
    .getByRole('button', { name: /^Theme:/ })
    .click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
});
