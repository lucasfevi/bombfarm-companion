import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');

const win32 = process.platform === 'win32';

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

async function launchTrayApp(userDataDir) {
  const app = await electron.launch({
    executablePath: electronExecutable(),
    args: [desktopRoot],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      BFC_GAME_READER: 'fixture',
      BFC_USER_DATA_DIR: userDataDir,
      BFC_GAME_PROCESS: 'bfc-smoke-no-such-process.exe',
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      ELECTRON_ENABLE_LOGGING: '1',
    },
  });

  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  await expect(page.getByTestId('game-status-chip')).toHaveText('Connected', { timeout: 15_000 });

  const consentModal = page.getByTestId('consent-modal');
  await expect(consentModal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(consentModal).toBeHidden({ timeout: 15_000 });

  return { app, page };
}

async function closeMainWindow(app) {
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.close();
  });
}

async function isMainWindowVisible(app) {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false);
}

async function readShellSmokeBridge(app) {
  return app.evaluate(() => globalThis.__bfcShellSmoke ?? null);
}

async function trayShow(app) {
  await app.evaluate(() => {
    const bridge = globalThis.__bfcShellSmoke;
    if (!bridge) throw new Error('shell smoke bridge missing');
    bridge.show();
  });
}

async function trayQuit(app) {
  await app.evaluate(() => {
    const bridge = globalThis.__bfcShellSmoke;
    if (!bridge) throw new Error('shell smoke bridge missing');
    bridge.quitFromTray();
  });
}

async function simulateSecondInstance(app) {
  await app.evaluate(() => {
    const bridge = globalThis.__bfcShellSmoke;
    if (!bridge) throw new Error('shell smoke bridge missing');
    bridge.simulateSecondInstance();
  });
}

test.describe('tray hide smoke', () => {
  test.skip(!win32, 'hide-to-tray ships on Windows only');

  test('closing the main window hides it while the process keeps running, then Show and Quit work', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-tray-hide-'));
    let app;

    try {
      ({ app } = await launchTrayApp(userDataDir));

      const bridge = await readShellSmokeBridge(app);
      expect(bridge?.trayPresent).toBe(true);

      await closeMainWindow(app);
      await expect.poll(() => isMainWindowVisible(app), { timeout: 15_000 }).toBe(false);

      const page = await app.firstWindow();
      await expect(page.getByTestId('game-status-chip')).toHaveText('Connected', { timeout: 15_000 });

      await trayShow(app);
      await expect.poll(() => isMainWindowVisible(app), { timeout: 15_000 }).toBe(true);
      await expect(page.getByTestId('live-view')).toBeVisible({ timeout: 15_000 });

      const closed = app.waitForEvent('close', { timeout: 60_000 });
      await trayQuit(app);
      await closed;
    } finally {
      await app?.close().catch(() => undefined);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  test('second-instance-style show while hidden surfaces the main window', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-tray-second-'));
    let app;

    try {
      ({ app } = await launchTrayApp(userDataDir));

      await closeMainWindow(app);
      await expect.poll(() => isMainWindowVisible(app), { timeout: 15_000 }).toBe(false);

      await simulateSecondInstance(app);
      await expect.poll(() => isMainWindowVisible(app), { timeout: 15_000 }).toBe(true);

      const page = await app.firstWindow();
      await expect(page.getByTestId('live-view')).toBeVisible({ timeout: 15_000 });
    } finally {
      await app?.close().catch(() => undefined);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
