import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function launchApp(env) {
  const app = await electron.launch({
    executablePath: electronExecutable(),
    args: [desktopRoot],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      ELECTRON_ENABLE_LOGGING: '1',
      // No live game and no real token anywhere in this suite (SAFETY — the implementer
      // brief forbids running against the live game or a real token). Memory mode's
      // tickLive() scans for this process name and will never find it.
      BFC_GAME_PROCESS: 'bfc-smoke-no-such-process.exe',
      // Redirects session-token-file.ts's sessionCfgPath() away from the real
      // %APPDATA%/Godot/app_userdata/BombFarm/session.cfg (T-fix-4). Without this, the first
      // scenario below accepts consent, and the very next account-refresh cycle would open
      // whichever real session.cfg exists on the machine running this suite and issue a live,
      // authenticated request using the real player's token — entirely as a side effect of a
      // test run. Only takes effect when `app.isPackaged` is false (this suite always launches
      // unpackaged from source), the same gate BFC_USER_DATA_DIR already uses one line below.
      // Pointed at a path that deliberately does not exist: readSessionToken degrades that to
      // `token_unavailable` (no network call at all), which is strictly safer than requiring a
      // fixture file this suite would otherwise have to maintain.
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      ...env,
    },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  return { app, page };
}

test.describe('consent modal smoke (MP2 F2, LAR-01/03, Success Criterion "shown once, survives restart")', () => {
  test('shows on first run with the required disclosure, accepting closes it, and a relaunch of the same profile does not show it again', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-consent-modal-'));

    try {
      // --- Launch 1: fresh profile, no consent row ever written -----------------------------
      const { app: app1, page: page1 } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        const modal = page1.getByTestId('consent-modal');
        await expect(modal).toBeVisible({ timeout: 30_000 });

        const body = page1.getByTestId('consent-modal-body');
        await expect(body).toContainText('no disruptive action is taken without your approval');

        await page1.getByTestId('consent-accept').click();
        await expect(modal).toBeHidden({ timeout: 15_000 });

        // The decision round-tripped through the real IPC handler, not just local component state.
        const record = await page1.evaluate(async () => window.bfc.invoke('consent:get'));
        expect(record.decision).toBe('granted');
        expect(typeof record.grantedAt).toBe('string');
      } finally {
        await app1.close().catch(() => undefined);
      }

      // --- Launch 2: same user-data dir — the answer must survive the restart ---------------
      const { app: app2, page: page2 } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        // The shell is fully usable and the modal never re-appears for an already-granted profile.
        await expect(page2.getByTestId('app-ready')).toBeVisible();
        await expect(page2.getByTestId('consent-modal')).toHaveCount(0);

        const record = await page2.evaluate(async () => window.bfc.invoke('consent:get'));
        expect(record.decision).toBe('granted');
      } finally {
        await app2.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  test('declining leaves the app usable and records the decision', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-consent-modal-decline-'));

    try {
      const { app, page } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        const modal = page.getByTestId('consent-modal');
        await expect(modal).toBeVisible({ timeout: 30_000 });

        await page.getByTestId('consent-decline').click();
        await expect(modal).toBeHidden({ timeout: 15_000 });

        // Declining does not block window creation or the rest of the UI (LAR-04).
        await expect(page.getByTestId('app-ready')).toBeVisible();

        const record = await page.evaluate(async () => window.bfc.invoke('consent:get'));
        expect(record.decision).toBe('declined');

        // The stored account still serves (an empty/all-missing view, not an error).
        const view = await page.evaluate(async () => window.bfc.invoke('account:get'));
        expect(view.payload.fidelity).toBeDefined();
      } finally {
        await app.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
