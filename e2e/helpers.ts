import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Model } from '../src/core/model/types';

/** Loads the app with the File System Access API disabled (so <input type=file> is used). */
export async function boot(page: Page): Promise<void> {
  await page.addInitScript(() => {
    delete (window as { showOpenFilePicker?: unknown }).showOpenFilePicker;
    delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    // Start each test without a restore offer from a previous test's autosave (first load
    // only, so a reload within the test still sees its own autosave).
    if (!sessionStorage.getItem('e2e-booted')) {
      sessionStorage.setItem('e2e-booted', '1');
      indexedDB.deleteDatabase('keyval-store');
    }
  });
  await page.goto('/');
}

/** Opens a file through the toolbar's Open button. */
export async function openPath(page: Page, path: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('toolbar').getByRole('button', { name: 'Open', exact: true }).click();
  await (await chooser).setFiles(path);
}

/** Opens a file from /fixtures (booting the app first if needed). */
export async function openFixture(page: Page, rel: string): Promise<void> {
  if (page.url() === 'about:blank') await boot(page);
  await openPath(page, 'fixtures/' + rel);
}

/** Current model from the dev-only store hook. */
export async function model(page: Page): Promise<Model> {
  return page.evaluate(
    () =>
      (window as unknown as { __editor: { getState(): { model: Model } } }).__editor.getState()
        .model,
  );
}

/** Clicks Export XML and returns the downloaded file's path and contents. */
export async function exportXml(page: Page): Promise<{ path: string; xml: string }> {
  const download = page.waitForEvent('download');
  await page.getByRole('toolbar').getByRole('button', { name: 'Export XML' }).click();
  const d = await download;
  const path = test_tmp(d.suggestedFilename());
  await d.saveAs(path);
  return { path, xml: readFileSync(path, 'utf8') };
}

let counter = 0;
function test_tmp(name: string): string {
  return `test-results/downloads/${Date.now()}-${counter++}-${name}`;
}

export function nodeLocator(page: Page, nodeId: string) {
  return page.locator(`.react-flow__node[data-id="${nodeId}"]`);
}

/** Drags with the mouse in small steps (React Flow needs intermediate moves). */
export async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + (to.x - from.x) / 3, from.y + (to.y - from.y) / 3, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

export async function centre(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

/** Draws a connection from a node's right border band to another node, then picks a type. */
export async function connect(
  page: Page,
  fromNode: string,
  toNode: string,
  relType: string,
): Promise<void> {
  const band = nodeLocator(page, fromNode).locator('[title="Drag to connect"]').nth(1);
  const b = await band.boundingBox();
  const target = await nodeLocator(page, toNode).boundingBox();
  await drag(
    page,
    { x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 },
    { x: target!.x + target!.width / 2, y: target!.y + target!.height / 2 },
  );
  await page
    .getByRole('menu', { name: 'Relationship' })
    .getByRole('menuitem', { name: relType, exact: true })
    .click();
}
