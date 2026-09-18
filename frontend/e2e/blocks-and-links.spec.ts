import { expect, Page, test } from '@playwright/test';

async function registerAndLogin(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.fill('#name', 'E2E Tester');
  await page.fill('#email', email);
  await page.fill('#password', 'S3curePass!23');
  await page.click('button[type=submit]');
  await page.waitForURL('**/login**');
  await page.fill('#email', email);
  await page.fill('#password', 'S3curePass!23');
  await page.click('button[type=submit]');
  await page.waitForURL('**/documents');
}

async function createAndOpenDocument(page: Page): Promise<void> {
  await page.click('button:has-text("+ Document")');
  await page.waitForSelector('.documents-grid >> text=Untitled document');
  await page.click('.documents-grid >> text=Untitled document');
  await page.waitForURL('**/documents/*');
  await page.waitForSelector('.ProseMirror');
  await expect(page.locator('[data-status="connected"]')).toBeVisible({ timeout: 10000 });
}

test('slash command inserts a heading block', async ({ page }) => {
  await registerAndLogin(page, `e2e-slash-${Date.now()}@example.com`);
  await createAndOpenDocument(page);

  await page.click('.ProseMirror');
  await page.keyboard.type('/Heading');
  await page.waitForSelector('.suggestion-popup__item.is-selected');
  await page.click('.suggestion-popup__item:has-text("Heading 1")');
  await page.keyboard.type('A real heading');

  await expect(page.locator('.ProseMirror h1')).toHaveText('A real heading');
});

test('typing a #tag updates the tag chips after the save debounce', async ({ page }) => {
  await registerAndLogin(page, `e2e-tags-${Date.now()}@example.com`);
  await createAndOpenDocument(page);

  await page.click('.ProseMirror');
  await page.keyboard.type('Some notes #project #urgent ');

  await expect(page.locator('.tag-chip')).toHaveCount(2, { timeout: 5000 });
  await expect(page.locator('.tag-chips')).toContainText('#project');
  await expect(page.locator('.tag-chips')).toContainText('#urgent');
});

test('wiki-link autocomplete inserts a link and the target shows a backlink', async ({ page }) => {
  const email = `e2e-wiki-${Date.now()}@example.com`;
  await registerAndLogin(page, email);

  // Create the target page first, named something findable.
  await page.click('button:has-text("+ Document")');
  await page.waitForSelector('.documents-grid >> text=Untitled document');
  await page.click('.documents-grid >> text=Untitled document');
  await page.waitForURL('**/documents/*');
  await page.waitForSelector('.ProseMirror');
  await page.fill('.title-input', 'Target Page');
  await page.locator('.title-input').blur();

  // Back to the dashboard, create the source page that links to it.
  await page.click('text=← My documents');
  await page.click('button:has-text("+ Document")');
  await page.waitForSelector('.documents-grid >> text=Untitled document');
  // Two "Untitled document" cards now exist (the renamed one is "Target
  // Page"); the new one is the only remaining "Untitled document".
  await page.click('.documents-grid >> text=Untitled document');
  await page.waitForURL('**/documents/*');
  await page.waitForSelector('.ProseMirror');
  await expect(page.locator('[data-status="connected"]')).toBeVisible({ timeout: 10000 });

  await page.click('.ProseMirror');
  await page.keyboard.type('See [[Target');
  await page.waitForSelector('.suggestion-popup__item');
  await page.keyboard.press('Enter');

  await expect(page.locator('.wiki-link')).toContainText('Target Page');

  // Click the inserted link to navigate to the target and confirm the
  // backlink was recorded server-side (proves the save-debounce -> PUT
  // /links/ -> backlinks panel round trip, not just the editor node).
  await page.click('.wiki-link');
  await page.waitForURL('**/documents/*');
  await expect(page.locator('.backlinks')).toContainText('Untitled document', { timeout: 8000 });
});
