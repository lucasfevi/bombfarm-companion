import { test, expect, electron } from './smoke-test.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellControl } from './shell-control.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');

/** Mirrors `RENDERER_ERROR_BURST` in `src/main/renderer-error-log.ts`. */
const BURST = 5;
const MESSAGE_CAP = 2048;
const STACK_CAP = 8192;

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

function logFilesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? logFilesUnder(full) : [full];
    })
    .filter((file) => file.endsWith('.log'));
}

/** Every log record in the files, split on the timestamp electron-log opens each one with. */
async function logRecords(app, userDataDir) {
  const dirs = [
    ...new Set([await app.evaluate(({ app: electronApp }) => electronApp.getPath('logs')), path.join(userDataDir, 'logs')]),
  ];
  return dirs
    .flatMap(logFilesUnder)
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n')
    .split(/^(?=\[\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)/m);
}

async function recordsContaining(app, userDataDir, marker) {
  return (await logRecords(app, userDataDir)).filter((record) => record.includes(marker));
}

/**
 * Both crashes below are made the way a stray script or extension would make one, with no hook in
 * the app: a node React owns is moved out of its parent, so the next commit that removes it throws
 * from `removeChild`. React hands a commit-phase error to the nearest boundary exactly as it does a
 * render error, so what reaches the log is what a real screen crash would send.
 */
function detachScreenNodes(page) {
  return page.evaluate(() => {
    const host = document.querySelector('[data-testid="app-ready"]');
    for (const child of [...host.children]) {
      if (child.getAttribute('data-testid') !== 'domain-label-probe') document.body.append(child);
    }
  });
}

async function crashMainScreenBySwitchingTab(page) {
  await detachScreenNodes(page);
  await page.locator('nav[aria-label="Main"] button').nth(1).click();
}

async function crashCompactWindowByHidingEarnings(mini) {
  await mini.evaluate(() => {
    document.body.append(document.querySelector('[data-testid="mini-earnings"]'));
  });
  await mini.getByTestId('mini-live-gear').click();
  await mini.getByRole('switch', { name: 'Earnings' }).click();
}

async function crashRecordsFrom(app, userDataDir, window) {
  const records = await recordsContaining(app, userDataDir, "event: 'screen.crash'");
  return records.filter((record) => record.includes("screen: 'mini-live'") === (window === 'mini'));
}

test.describe('renderer error log smoke', () => {
  test('crashes and probes from both windows reach the log file in a validated shape, and a flood is rate-limited', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-renderer-error-log-'));
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
      const consentModal = page.getByTestId('consent-modal');
      await expect(consentModal).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('consent-accept').click();
      await expect(consentModal).toBeHidden({ timeout: 30_000 });

      const miniOpened = app.waitForEvent('window', { timeout: 30_000 });
      await (await shellControl(page, 'open-mini')).click();
      const mini = await miniOpened;
      await expect(mini.getByTestId('live-map-phase')).toBeVisible({ timeout: 30_000 });

      await test.step("electron-log's own IPC listener and handler are gone, so only the checked channel writes", async () => {
        const outcome = await app.evaluate(({ ipcMain }) => {
          let handlerStillRegistered = false;
          try {
            ipcMain.handle('__ELECTRON_LOG__', () => null);
            ipcMain.removeHandler('__ELECTRON_LOG__');
          } catch {
            handlerStillRegistered = true;
          }
          return { listeners: ipcMain.listenerCount('__ELECTRON_LOG__'), handlerStillRegistered };
        });
        expect(outcome).toEqual({ listeners: 0, handlerStillRegistered: false });
      });

      await test.step('a screen that throws in the main window is logged by its boundary', async () => {
        await crashMainScreenBySwitchingTab(page);
        await expect(page.getByTestId('screen-crash')).toBeVisible({ timeout: 15_000 });

        await expect
          .poll(async () => (await crashRecordsFrom(app, userDataDir, 'main')).length, { timeout: 15_000 })
          .toBe(1);
        const [record] = await crashRecordsFrom(app, userDataDir, 'main');
        expect(record).toContain('[error]');
        expect(record).toContain("scope: 'renderer'");
        expect(record).toContain("event: 'screen.crash'");
        expect(record).toMatch(/screen: '[a-z-]+'/);
        expect(record).toContain('removeChild');
        expect(record).toContain('stack:');
        expect(record).toContain('componentStack:');
      });

      await test.step('a screen that throws in the compact window is logged, and the window keeps its close control', async () => {
        await crashCompactWindowByHidingEarnings(mini);
        await expect(mini.getByTestId('mini-live-crash')).toBeVisible({ timeout: 15_000 });
        await expect(mini.getByTestId('mini-live-close')).toBeVisible();

        await expect
          .poll(async () => (await crashRecordsFrom(app, userDataDir, 'mini')).length, { timeout: 15_000 })
          .toBe(1);
        const [record] = await crashRecordsFrom(app, userDataDir, 'mini');
        expect(record).toContain("scope: 'renderer'");
        expect(record).toContain("screen: 'mini-live'");
        expect(record).toContain("event: 'screen.crash'");
        expect(record).toContain('removeChild');
      });

      await test.step('an oversized, extra-keyed, scope-forging payload is capped and stripped', async () => {
        const hostile = {
          event: 'smoke.hostile.' + 'e'.repeat(186),
          screen: 'hostile-screen-' + 'x'.repeat(175),
          message: '‮ ' + 'm'.repeat(MESSAGE_CAP * 3 - 2),
          stack: 's'.repeat(STACK_CAP * 3),
          componentStack: 'c\u001b[31mc' + 'k'.repeat(STACK_CAP * 2 - 7),
          scope: 'main',
          level: 'info',
          smokeExtraKey: 'smoke-extra-value',
        };
        await page.evaluate((payload) => window.bfc.invoke('log:rendererError', payload), hostile);

        await expect
          .poll(async () => (await recordsContaining(app, userDataDir, 'smoke.hostile')).length, { timeout: 15_000 })
          .toBeGreaterThan(0);
        const [record] = await recordsContaining(app, userDataDir, 'smoke.hostile');
        expect(record).toContain("scope: 'renderer'");
        expect(record).not.toContain("scope: 'main'");
        expect(record).not.toContain('smokeExtraKey');
        expect(record).not.toContain('smoke-extra-value');
        for (const key of ['event', 'screen', 'message', 'stack', 'componentStack']) {
          expect(record, `${key} was cut and says what it was`).toContain(`truncated, was ${hostile[key].length} chars`);
        }
        expect(record).not.toContain('e'.repeat(64));
        expect(record).not.toContain('x'.repeat(64));
        expect(record).not.toContain('m'.repeat(MESSAGE_CAP));
        expect(record).not.toContain('s'.repeat(STACK_CAP));
        expect(record).not.toContain('k'.repeat(STACK_CAP));
        expect(record).not.toContain('\u001b');
        expect(record).not.toContain('‮');
        expect(record).not.toContain(' ');
        expect(record.length).toBeLessThan((MESSAGE_CAP + STACK_CAP + 3000) * 2);
      });

      await test.step('a burst from one window is held to its allowance, and the page is told nothing different', async () => {
        const calls = 40;
        const answers = await mini.evaluate(
          async (calls) =>
            Promise.all(
              Array.from({ length: calls }, (_, index) =>
                window.bfc.invoke('log:rendererError', {
                  event: 'smoke.burst',
                  screen: 'burst',
                  message: `burst-${index}`,
                  stack: '',
                  componentStack: '',
                }),
              ),
            ),
          calls,
        );
        expect(answers).toEqual(Array(calls).fill(null));

        await expect
          .poll(async () => (await recordsContaining(app, userDataDir, 'smoke.burst')).length, { timeout: 15_000 })
          .toBeGreaterThan(0);
        // The compact window had spent one of its five on the crash above, and a token comes back
        // every ten seconds; the whole run is well inside that.
        const written = (await recordsContaining(app, userDataDir, 'smoke.burst')).length;
        expect(written).toBeGreaterThanOrEqual(BURST - 1);
        expect(written).toBeLessThanOrEqual(BURST);
        expect(written).toBeLessThan(calls);
      });

      await test.step('the other window still has its own allowance after one has used up its own', async () => {
        await page.evaluate(() =>
          window.bfc.invoke('log:rendererError', {
            event: 'smoke.independent',
            screen: 'independent',
            message: 'independent-window-record',
            stack: '',
            componentStack: '',
          }),
        );
        await expect
          .poll(async () => (await recordsContaining(app, userDataDir, 'independent-window-record')).length, { timeout: 15_000 })
          .toBe(1);
      });
    } finally {
      await app?.close().catch(() => undefined);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
