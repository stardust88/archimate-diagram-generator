// Performance targets (spec §3 US-1, §12), measured on the production build (vite preview, see
// playwright.config.ts) with the generated model: ~5 MB, 5,000 elements, 200 views, view 0 with
// 500 nodes. Import and export are timed through the UI.
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { generateLargeModel } from '../src/test/large-model';
import { boot, openPath } from './helpers';

const FILE = 'test-results/perf/large-model.xml';

test.beforeAll(() => {
  mkdirSync('test-results/perf', { recursive: true });
  writeFileSync(FILE, generateLargeModel(5000, 200, 25, 500, 680));
});

test('5 MB / 5,000 elements / 200 views: import < 3 s, export < 2 s, pan >= 50 fps on 500 nodes', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await boot(page);

  // Import: from choosing the file to the first view's nodes on screen.
  const t0 = Date.now();
  await openPath(page, FILE);
  await expect(page.getByRole('tab', { name: /View 0/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });
  const importMs = Date.now() - t0;
  const marks = await page.evaluate(() =>
    Object.fromEntries(
      performance.getEntriesByType('mark').map((m) => [m.name, Math.round(m.startTime)]),
    ),
  );
  // App time: file received -> read -> parsed -> first canvas frame. The rest of the end-to-end
  // figure is the test harness pushing 5 MB through the file chooser.
  const appImportMs = marks['am:import-rendered']! - marks['am:file-picked']!;

  // Export: from clicking Export XML to the download (serialization + pretty-print + blob).
  const t1 = Date.now();
  const download = page.waitForEvent('download');
  await page.getByRole('toolbar').getByRole('button', { name: 'Export XML' }).click();
  await download;
  const exportMs = Date.now() - t1;

  // Pan: count frames while dragging the background across the 500-node view.
  const canvas = (await page.getByTestId('canvas').boundingBox())!;
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__frames = [];
    w.__stop = false;
    const tick = (t: number) => {
      w.__frames.push(t);
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const start = { x: canvas.x + 20, y: canvas.y + canvas.height - 20 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 60; i++) {
    await page.mouse.move(start.x + i * 6, start.y - i * 4);
  }
  await page.mouse.up();
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__stop = true;
    return w.__frames;
  });
  const span = frames[frames.length - 1]! - frames[0]!;
  const fps = ((frames.length - 1) / span) * 1000;
  const nodeCount = await page.locator('.react-flow__node-am').count();

  console.log(
    `import ${appImportMs} ms in app (${importMs} ms end-to-end incl. test harness), export ${Math.round(exportMs)} ms, pan ${fps.toFixed(1)} fps ` +
      `(${frames.length} frames, ${nodeCount} nodes rendered of 500 with onlyRenderVisibleElements)`,
  );
  expect(appImportMs).toBeLessThan(3000);
  expect(exportMs).toBeLessThan(2000);
  expect(fps).toBeGreaterThanOrEqual(50);
});
