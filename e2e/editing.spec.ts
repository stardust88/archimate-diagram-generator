// Spec §13 E2E flows.
import { expect, test } from '@playwright/test';
import { validateAgainstXsd } from '../src/test/xsd';
import {
  boot,
  connect,
  drag,
  exportXml,
  model,
  nodeLocator,
  openFixture,
  openPath,
} from './helpers';

const SERVICE_NODE = 'id-019dd58c-3116-72be-8618-072b804c1e6d';
const FUNCTION_NODE = 'id-019dd58c-fbb9-73fa-8251-f74d2a8b73f6';
const SERVICE_EL = 'id-019dd58c-3116-731f-a761-905e3234486b';

test('open fixture, move, rename, connect, export, re-import', async ({ page }) => {
  await openFixture(page, 'archi/bendpoint.test.xml');
  const service = nodeLocator(page, SERVICE_NODE);
  await expect(service).toBeVisible();

  // Move the node 150px to the right.
  const box = (await service.boundingBox())!;
  await drag(
    page,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    { x: box.x + box.width / 2 + 150, y: box.y + box.height / 2 },
  );
  await expect
    .poll(
      async () => (await model(page)).views['id-019dd58b-68f1-765a-bca8-2716884f56b2']!.nodes[0]!.x,
    )
    .toBeGreaterThan(100);

  // Rename inline.
  await service.dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit name on canvas' });
  await editor.fill('Renamed Service');
  await editor.press('Enter');
  await expect
    .poll(async () => (await model(page)).elements[SERVICE_EL]!.name)
    .toEqual({ en: 'Renamed Service' });

  // Draw a new relationship.
  await connect(page, FUNCTION_NODE, SERVICE_NODE, 'Association');
  await expect.poll(async () => Object.keys((await model(page)).relations).length).toBe(3);

  // Export: XSD-valid.
  const { path, xml } = await exportXml(page);
  const result = await validateAgainstXsd(xml);
  expect(result.errors).toEqual([]);

  // Re-import: changes are present.
  await openPath(page, path);
  await expect(page.getByRole('textbox', { name: 'Model name' })).toHaveValue('Bendpoint test');
  const m = await model(page);
  expect(m.elements[SERVICE_EL]!.name).toEqual({ en: 'Renamed Service' });
  expect(
    Object.values(m.relations)
      .map((r) => r.type)
      .sort(),
  ).toEqual(['Association', 'Realization', 'Serving']);
  const v = m.views[m.viewOrder[0]!]!;
  expect(v.nodes.find((n) => n.id === SERVICE_NODE)!.x).toBeGreaterThan(100);
  expect(v.connections).toHaveLength(3);
});

async function newModel(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: 'New model' }).click();
  const dialog = page.getByRole('dialog', { name: 'New model' });
  await dialog.getByRole('textbox').fill(name);
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('tab', { name: /Default View/ })).toBeVisible();
}

async function dropFromPalette(
  page: import('@playwright/test').Page,
  type: string,
  x: number,
  y: number,
) {
  const canvas = page.getByTestId('canvas');
  await page.locator(`[data-type="${type}"]`).dragTo(canvas, { targetPosition: { x, y } });
  // A dropped element starts in inline rename; keep the default name.
  await page.getByRole('textbox', { name: 'Edit name on canvas' }).press('Escape');
}

async function nodeIdFor(page: import('@playwright/test').Page, type: string): Promise<string> {
  const m = await model(page);
  const v = m.views[m.viewOrder[0]!]!;
  const n = v.nodes.find((x) => x.kind === 'element' && m.elements[x.elementRef]?.type === type);
  return n!.id;
}

test('new model, add 3 elements from the palette, connect, export validates', async ({ page }) => {
  await boot(page);
  await newModel(page, 'From scratch');
  await dropFromPalette(page, 'BusinessActor', 150, 120);
  await dropFromPalette(page, 'BusinessRole', 450, 120);
  await dropFromPalette(page, 'BusinessService', 450, 320);
  let m = await model(page);
  expect(
    Object.values(m.elements)
      .map((e) => e.type)
      .sort(),
  ).toEqual(['BusinessActor', 'BusinessRole', 'BusinessService']);

  const actor = await nodeIdFor(page, 'BusinessActor');
  const role = await nodeIdFor(page, 'BusinessRole');
  const service = await nodeIdFor(page, 'BusinessService');
  await connect(page, actor, role, 'Assignment');
  await connect(page, service, role, 'Serving');
  m = await model(page);
  expect(
    Object.values(m.relations)
      .map((r) => r.type)
      .sort(),
  ).toEqual(['Assignment', 'Serving']);

  const { xml } = await exportXml(page);
  const result = await validateAgainstXsd(xml);
  expect(result.errors).toEqual([]);
  expect(xml).toContain('<label xml:lang="en">Business</label>');
});

test('the relationship menu offers only valid types', async ({ page }) => {
  await boot(page);
  await newModel(page, 'Menu');
  await dropFromPalette(page, 'DataObject', 150, 120);
  await dropFromPalette(page, 'BusinessActor', 450, 120);
  const band = nodeLocator(page, await nodeIdFor(page, 'DataObject'))
    .locator('[title="Drag to connect"]')
    .nth(1);
  const b = (await band.boundingBox())!;
  const t = (await nodeLocator(page, await nodeIdFor(page, 'BusinessActor')).boundingBox())!;
  await drag(
    page,
    { x: b.x + 3, y: b.y + b.height / 2 },
    { x: t.x + t.width / 2, y: t.y + t.height / 2 },
  );
  const items = await page
    .getByRole('menu', { name: 'Relationship' })
    .getByRole('menuitem')
    .allTextContents();
  // Data Object -> Business Actor: only association is allowed in ArchiMate 3.2.
  expect(items).toEqual(['Association']);
  await page.keyboard.press('Escape');
});

test('undo/redo across 10 mixed actions', async ({ page }) => {
  await boot(page);
  await newModel(page, 'History');
  const start = await model(page);

  await dropFromPalette(page, 'BusinessActor', 150, 120); // 1
  await dropFromPalette(page, 'BusinessRole', 450, 120); // 2
  await dropFromPalette(page, 'BusinessProcess', 450, 320); // 3
  const actor = await nodeIdFor(page, 'BusinessActor');
  const role = await nodeIdFor(page, 'BusinessRole');
  await connect(page, actor, role, 'Assignment'); // 4

  await nodeLocator(page, actor).click();
  const props = page.getByRole('complementary', { name: 'Properties' });
  const name = props.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill('Customer');
  await name.press('Enter'); // 5
  const doc = props.getByRole('textbox', { name: 'Documentation' });
  await doc.fill('Buys things');
  await doc.blur(); // 6
  await props.getByRole('button', { name: '+ Add property' }).click(); // 7
  await props.getByRole('combobox', { name: 'Element type' }).selectOption('BusinessRole'); // 8
  await nodeLocator(page, actor).click();
  await page.keyboard.press('Shift+ArrowRight'); // 9
  await page.getByRole('toolbar').getByRole('button', { name: 'Add view' }).click();
  await page.getByRole('dialog', { name: 'New view' }).getByRole('button', { name: 'Add' }).click(); // 10

  await expect
    .poll(
      async () =>
        await page.evaluate(
          () =>
            (
              window as unknown as { __editor: { getState(): { past: unknown[] } } }
            ).__editor.getState().past.length,
        ),
    )
    .toBe(10);
  const end = await model(page);

  await page.getByTestId('canvas').click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < 10; i++) await page.keyboard.press('Control+z');
  expect(await model(page)).toEqual(start);
  for (let i = 0; i < 10; i++) await page.keyboard.press('Control+Shift+z');
  expect(await model(page)).toEqual(end);
});
