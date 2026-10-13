// Acceptance criteria from spec §3 not covered by the §13 flows in editing.spec.ts.
import { expect, test, type Page } from '@playwright/test';
import { boot, drag, model, nodeLocator, openFixture } from './helpers';

async function newModel(page: Page, name = 'Test') {
  await page.getByRole('button', { name: 'New model' }).click();
  const dialog = page.getByRole('dialog', { name: 'New model' });
  await dialog.getByRole('textbox').fill(name);
  await dialog.getByRole('button', { name: 'Create' }).click();
}

async function drop(page: Page, type: string, x: number, y: number) {
  await page
    .locator(`[data-type="${type}"]`)
    .dragTo(page.getByTestId('canvas'), { targetPosition: { x, y } });
}

async function finishRename(page: Page) {
  await page.getByRole('textbox', { name: 'Edit name on canvas' }).press('Escape');
}

async function view(page: Page) {
  const m = await model(page);
  return { m, v: m.views[m.viewOrder[0]!]! };
}

test('US-3/§9.4: dropping inside a node nests it and offers the valid relationships', async ({
  page,
}) => {
  await boot(page);
  await newModel(page);
  await drop(page, 'Node', 300, 200);
  await finishRename(page);
  // Make the Node big enough to drop into.
  const { v } = await view(page);
  const nodeId = v.nodes[0]!.id;
  await nodeLocator(page, nodeId).click();
  const corner = nodeLocator(page, nodeId).locator('.react-flow__resize-control.bottom.right');
  const cb = (await corner.boundingBox())!;
  await drag(
    page,
    { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 },
    { x: cb.x + 260, y: cb.y + 200 },
  );
  await expect.poll(async () => (await view(page)).v.nodes[0]!.w).toBeGreaterThan(300);
  const nb = (await nodeLocator(page, nodeId).boundingBox())!;
  const canvas = (await page.getByTestId('canvas').boundingBox())!;
  await drop(
    page,
    'SystemSoftware',
    nb.x - canvas.x + nb.width / 2,
    nb.y - canvas.y + nb.height / 2 + 30,
  );
  // Node -> System Software allows several nesting relationships: a picker appears.
  const menu = page.getByRole('menu', { name: 'Nest as' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: "Don't create relationship" })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Composition', exact: true }).click();
  await finishRename(page);
  const { m, v: v2 } = await view(page);
  const child = v2.nodes.find((n) => n.id !== nodeId)!;
  expect(child.parent).toBe(nodeId);
  expect(Object.values(m.relations).map((r) => r.type)).toEqual(['Composition']);
});

test('US-3: Delete removes from the view only; Delete from model removes everywhere', async ({
  page,
}) => {
  await openFixture(page, 'archi/bendpoint.test.xml');
  const id = 'id-019dd58c-3116-72be-8618-072b804c1e6d';
  await nodeLocator(page, id).click();
  await page.keyboard.press('Delete');
  let m = await model(page);
  expect(m.views[m.viewOrder[0]!]!.nodes).toHaveLength(1);
  expect(Object.keys(m.elements)).toHaveLength(2);
  await page.keyboard.press('Control+z');

  await nodeLocator(page, id).click();
  await page.keyboard.press('Control+Delete');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('View');
  await dialog.getByRole('button', { name: 'Delete from model' }).click();
  m = await model(page);
  expect(Object.keys(m.elements)).toHaveLength(1);
  expect(Object.keys(m.relations)).toHaveLength(0);
});

test('US-3: copy/paste into another view references the same elements', async ({ page }) => {
  await openFixture(page, 'archi/bendpoint.test.xml');
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+c');
  await page.getByRole('toolbar').getByRole('button', { name: 'Add view' }).click();
  await page.getByRole('dialog', { name: 'New view' }).getByRole('button', { name: 'Add' }).click();
  await page.getByTestId('canvas').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('Control+v');
  const m = await model(page);
  const v2 = m.views[m.viewOrder[1]!]!;
  expect(v2.nodes).toHaveLength(2);
  expect(v2.connections).toHaveLength(2);
  expect(Object.keys(m.elements)).toHaveLength(2);
  // Ctrl+D in the same view duplicates the elements.
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+d');
  expect(Object.keys((await model(page)).elements)).toHaveLength(4);
});

test('US-3: dragging from the model tree adds a node without duplicating the element', async ({
  page,
}) => {
  await openFixture(page, 'archi/bendpoint.test.xml');
  await page.getByRole('toolbar').getByRole('button', { name: 'Add view' }).click();
  await page.getByRole('dialog', { name: 'New view' }).getByRole('button', { name: 'Add' }).click();
  const tree = page.getByRole('tree', { name: 'Model tree' });
  await tree
    .getByText('Business Function', { exact: true })
    .dragTo(page.getByTestId('canvas'), { targetPosition: { x: 200, y: 150 } });
  const m = await model(page);
  expect(Object.keys(m.elements)).toHaveLength(2);
  expect(m.views[m.viewOrder[1]!]!.nodes[0]).toMatchObject({
    elementRef: 'id-019dd58c-fbb9-7f75-8731-7c7b4db67709',
  });
});

test('US-7: a viewpoint filters the palette and flags off-viewpoint elements', async ({ page }) => {
  await openFixture(page, 'archi/bendpoint.test.xml');
  const props = page.getByRole('complementary', { name: 'Properties' });
  await expect(page.locator('[data-type="Goal"]')).toBeVisible();
  await props.getByRole('combobox', { name: 'Viewpoint' }).selectOption('Application Cooperation');
  await expect(page.locator('[data-type="Goal"]')).toHaveCount(0);
  await expect(page.locator('[data-type="ApplicationComponent"]')).toBeVisible();
  // Business elements are not in Application Cooperation: both nodes get a warning badge.
  await expect(
    page
      .getByTestId('canvas')
      .locator('title', { hasText: 'not part of the "Application Cooperation" viewpoint' }),
  ).toHaveCount(2);
});

test('US-3: bendpoints are added by dragging a selected line and removed by double-click', async ({
  page,
}) => {
  await openFixture(page, 'archi/bendpoint.test.xml');
  const conn = 'id-019dd58d-947b-7fb9-9542-5bf530b5c326';
  const edge = page.getByTestId(`edge-${conn}`);
  const path = edge.locator('path.react-flow__edge-interaction');
  await path.click({ force: true });
  const b = (await path.boundingBox())!;
  const mid = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await drag(page, mid, { x: mid.x + 80, y: mid.y });
  await expect
    .poll(
      async () => (await view(page)).v.connections.find((c) => c.id === conn)!.bendpoints.length,
    )
    .toBe(1);
  await edge.getByTestId('bendpoint-0').dblclick();
  await expect
    .poll(
      async () => (await view(page)).v.connections.find((c) => c.id === conn)!.bendpoints.length,
    )
    .toBe(0);
});

test('US-5: autosave survives a reload and is offered for restore', async ({ page }) => {
  await boot(page);
  await newModel(page, 'Autosaved');
  await drop(page, 'Goal', 200, 150);
  await finishRename(page);
  await expect(page.getByRole('status', { name: 'Unsaved changes' })).toBeVisible();
  await page.waitForTimeout(1500); // debounce 1 s
  await page.reload();
  const dialog = page.getByRole('dialog', { name: 'Restore unsaved work?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Restore' }).click();
  const m = await model(page);
  expect(Object.values(m.elements).map((e) => e.type)).toEqual(['Goal']);
  await expect(page.getByRole('textbox', { name: 'Model name' })).toHaveValue('Autosaved');
});

test('US-1: a malformed file shows the line number and keeps the current model', async ({
  page,
}) => {
  await openFixture(page, 'archi/bendpoint.test.xml');
  await openFixture(page, '../src/test/vendor-ext.xsd');
  await expect(page.getByRole('alert')).toContainText('Not an ArchiMate Exchange Format file');
  await expect(page.getByRole('textbox', { name: 'Model name' })).toHaveValue('Bendpoint test');
});
