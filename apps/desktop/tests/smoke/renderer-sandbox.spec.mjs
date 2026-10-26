import { test, expect, electron } from './smoke-test.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellControl } from './shell-control.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

async function exerciseBridge(page, channel) {
  return page.evaluate(async (channel) => {
    const bridge = window.bfc;
    if (!bridge) throw new Error('preload bridge missing');
    const dispose = bridge.on('consent:changed', () => undefined);
    const disposerIsFunction = typeof dispose === 'function';
    dispose();
    let loggingThrew = false;
    try {
      await bridge.invoke('log:rendererError', {
        event: 'sandbox.smoke',
        screen: 'sandbox-smoke',
        message: 'sandbox smoke probe',
        stack: '',
        componentStack: '',
      });
    } catch {
      loggingThrew = true;
    }
    return {
      keys: Object.keys(bridge).sort(),
      ping: bridge.ping(),
      invoked: await bridge.invoke(channel),
      disposerIsFunction,
      loggingThrew,
      electronLog: typeof window.__electronLog,
      nodeGlobals: {
        require: typeof window.require,
        process: typeof window.process,
        Buffer: typeof window.Buffer,
      },
    };
  }, channel);
}

function expectBridge(result) {
  expect(result.keys).toEqual(['invoke', 'on', 'ping']);
  expect(result.ping).toEqual({ ok: true, from: 'preload' });
  expect(result.disposerIsFunction).toBe(true);
  expect(result.loggingThrew).toBe(false);
  expect(result.electronLog).toBe('undefined');
  expect(result.nodeGlobals).toEqual({ require: 'undefined', process: 'undefined', Buffer: 'undefined' });
}

test.describe('renderer sandbox smoke', () => {
  test('both windows run sandboxed, and the sandboxed preload still bridges, delivers events and logs without throwing', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-renderer-sandbox-'));
    let app;

    try {
      app = await electron.launch({
        executablePath: electronExecutable(),
        args: [desktopRoot],
        env: {
          ...process.env,
          NODE_ENV: 'production',
          BFC_FLAVOR: 'dev',
          BFC_GAME_READER: 'fixture',
          BFC_LIVE_SOURCE: 'replay',
          BFC_USER_DATA_DIR: userDataDir,
          BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
          ELECTRON_ENABLE_LOGGING: '1',
        },
      });

      const page = await app.firstWindow();
      await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });

      await page.evaluate(() => {
        window.__sandboxSmokeEvents = [];
        window.bfc.on('consent:changed', (payload) => window.__sandboxSmokeEvents.push(payload));
      });

      const consentModal = page.getByTestId('consent-modal');
      await expect(consentModal).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('consent-accept').click();
      await expect(consentModal).toBeHidden({ timeout: 30_000 });
      await expect
        .poll(() => page.evaluate(() => window.__sandboxSmokeEvents.map((event) => event.decision)), {
          timeout: 15_000,
        })
        .toContain('granted');

      const miniOpened = app.waitForEvent('window', { timeout: 30_000 });
      await (await shellControl(page, 'open-mini')).click();
      const mini = await miniOpened;
      await expect(mini.getByTestId('mini-live-page')).toBeVisible({ timeout: 30_000 });
      // Printed only once a live frame has crossed the bridge's `on` into this window.
      await expect(mini.getByTestId('live-map-phase')).toBeVisible({ timeout: 30_000 });

      const windows = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().map((win) => {
          const prefs = win.webContents.getLastWebPreferences();
          return {
            sandbox: prefs.sandbox,
            contextIsolation: prefs.contextIsolation,
            nodeIntegration: prefs.nodeIntegration,
          };
        }),
      );
      expect(windows).toHaveLength(2);
      for (const win of windows) {
        expect(win).toEqual({ sandbox: true, contextIsolation: true, nodeIntegration: false });
      }

      // The preferences above are what was asked for; the process table is what the OS is running.
      const rendererSandboxed = await app.evaluate(({ app: electronApp }) =>
        electronApp
          .getAppMetrics()
          .filter((metric) => metric.type === 'Tab')
          .map((metric) => metric.sandboxed),
      );
      expect(rendererSandboxed.length).toBeGreaterThanOrEqual(2);
      expect(rendererSandboxed.every((sandboxed) => sandboxed === true)).toBe(true);

      // The compact window may invoke only its own channels; `settings:get` is one of them.
      const mainResult = await exerciseBridge(page, 'app:ping');
      expectBridge(mainResult);
      expect(mainResult.invoked).toEqual({ ok: true, from: 'main' });

      const miniResult = await exerciseBridge(mini, 'settings:get');
      expectBridge(miniResult);
      expect(miniResult.invoked).toEqual(expect.objectContaining({}));
      expect(miniResult.invoked).not.toBeNull();
    } finally {
      await app?.close().catch(() => undefined);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
