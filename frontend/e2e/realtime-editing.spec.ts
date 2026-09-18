import { Browser, expect, Page, test } from '@playwright/test';

/**
 * Critical-path E2E: create a doc, edit it, and see the edit sync to a
 * second logged-in session in real time - proves the whole stack (auth,
 * REST document creation, the custom Yjs WebSocket provider, and the
 * Django Channels consumer) actually works together, not just each
 * piece in isolation.
 */

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

test('editing in one session syncs live to a second session', async ({ browser }: { browser: Browser }) => {
  const email = `e2e-${Date.now()}@example.com`;

  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  const consoleErrorsA: string[] = [];
  pageA.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrorsA.push(msg.text());
  });

  await registerAndLogin(pageA, email);

  // Create a document and capture its id from the URL after navigating in.
  await pageA.click('button:has-text("+ Document")');
  await pageA.waitForSelector('.documents-grid >> text=Untitled document');
  await pageA.click('.documents-grid >> text=Untitled document');
  await pageA.waitForURL('**/documents/*');
  const docUrl = pageA.url();

  // Wait for the editor to actually mount and the socket to connect.
  await pageA.waitForSelector('.ProseMirror');
  await expect(pageA.locator('[data-status="connected"]')).toBeVisible({ timeout: 10000 });

  await pageA.click('.ProseMirror');
  await pageA.keyboard.type('Hello from session A');

  // Second session, same user (no sharing/collaborators yet - this still
  // proves the CRDT sync path end to end between two live connections).
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  const consoleErrorsB: string[] = [];
  pageB.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrorsB.push(msg.text());
  });

  await registerAndLoginExistingUser(pageB, email);
  await pageB.goto(docUrl);
  await pageB.waitForSelector('.ProseMirror');
  await expect(pageB.locator('[data-status="connected"]')).toBeVisible({ timeout: 10000 });

  await expect(pageB.locator('.ProseMirror')).toContainText('Hello from session A', {
    timeout: 10000,
  });

  // And the reverse direction: B edits, A sees it.
  await pageB.click('.ProseMirror');
  await pageB.keyboard.press('End');
  await pageB.keyboard.type(' — and session B');
  await expect(pageA.locator('.ProseMirror')).toContainText('and session B', { timeout: 10000 });

  expect(consoleErrorsA, `console errors in session A: ${consoleErrorsA.join('; ')}`).toEqual([]);
  expect(consoleErrorsB, `console errors in session B: ${consoleErrorsB.join('; ')}`).toEqual([]);

  await contextA.close();
  await contextB.close();
});

async function registerAndLoginExistingUser(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', 'S3curePass!23');
  await page.click('button[type=submit]');
  await page.waitForURL('**/documents');
}
