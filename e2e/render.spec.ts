import { test, expect } from '@playwright/test';
import { openFixture } from './helpers';

test('opens a fixture and renders its first view with nesting and edges', async ({ page }) => {
  await openFixture(page, 'opengroup/interop-snippet-03.xml');
  await expect(page.getByRole('toolbar')).toContainText('Interoperability testing snippet-3');
  await expect(page.getByRole('tab', { name: /Default View/ })).toBeVisible();
  const canvas = page.getByTestId('canvas');
  await expect(canvas.locator('.react-flow__node')).toHaveCount(24);
  await expect(canvas.locator('.am-edge')).not.toHaveCount(0);
  await expect(canvas.getByText('Underwriting', { exact: true })).toBeVisible();
});

test('shows import warnings for a file with dangling references', async ({ page }) => {
  await openFixture(page, 'synthetic/dangling-and-unknown.xml');
  await expect(page.getByRole('region', { name: 'Import warnings' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Import warnings' })).toContainText(
    'missing element',
  );
});

test('reports a parse error and keeps the current model', async ({ page }) => {
  await openFixture(page, 'synthetic/multi-lang.xml');
  await openFixture(page, '../package.json');
  await expect(page.getByRole('alert')).toContainText('Could not open package.json');
  await expect(page.getByRole('toolbar')).toContainText('Gestion des commandes');
});
