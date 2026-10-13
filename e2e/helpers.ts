import type { Page } from '@playwright/test';

/** Opens a file from /fixtures through the Open button (input fallback, no FS Access API). */
export async function openFixture(page: Page, rel: string): Promise<void> {
  if (page.url() === 'about:blank') {
    await page.addInitScript(() => {
      delete (window as { showOpenFilePicker?: unknown }).showOpenFilePicker;
      delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    });
    await page.goto('/');
  }
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('toolbar').getByRole('button', { name: 'Open', exact: true }).click();
  await (await chooser).setFiles('fixtures/' + rel);
}
