import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeShellOverflow, shellControl } from './shell-control.mjs';

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
      // brief forbids running against the live game or a real token). The live path's
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

test.describe('consent modal smoke (Success Criterion "shown once, survives restart")', () => {
  test('shows on first run with the required disclosure, accepting closes it, and a relaunch of the same profile does not show it again', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-consent-modal-'));

    try {
      // --- Launch 1: fresh profile, no consent row ever written -----------------------------
      const { app: app1, page: page1 } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        const modal = page1.getByTestId('consent-modal');
        await expect(modal).toBeVisible({ timeout: 30_000 });

        const body = page1.getByTestId('consent-modal-body');
        await expect(body).toContainText(
          'it attaches to the running game client to read the traffic that client is already exchanging with that server',
        );
        await expect(body).toContainText(
          'Attaching to another running program is the technique behavior-based detection looks for',
        );
        await expect(body).toContainText('only after you confirm each run');

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

  test('declining records the decision and gates the app, and the gate leads back to a grant', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-consent-modal-decline-'));

    try {
      const { app, page } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        const modal = page.getByTestId('consent-modal');
        await expect(modal).toBeVisible({ timeout: 30_000 });

        await page.getByTestId('consent-decline').click();
        await expect(modal).toBeHidden({ timeout: 15_000 });

        const record = await page.evaluate(async () => window.bfc.invoke('consent:get'));
        expect(record.decision).toBe('declined');

        // The window still opens, but there is nothing in it: the companion has no data source
        // that does not need consent, so it says so instead of rendering an empty planner.
        await expect(page.getByTestId('app-ready')).toBeVisible();
        await expect(page.getByTestId('consent-gate')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('nav[aria-label="Main"] button')).toHaveCount(0);

        // The one control that outlives the gate. It reads nothing and attaches to nothing, so
        // it is not part of what was just declined — and Settings, which carries the labelled
        // half, is unreachable from here.
        const coffee = await shellControl(page, 'shell-coffee');
        await expect(coffee).toBeVisible();
        await expect(coffee).toHaveAttribute(
          'href',
          'https://buymeacoffee.com/lucasfevi',
        );
        // The referral chip is the other one, and outlives the gate for the same reason. Which
        // code it carries is referral-link.test.tsx's to prove — asserting the text here would be
        // read as a disclosure-wording assertion by consent-smoke-text-drift.test.ts.
        await expect(await shellControl(page, 'shell-referral')).toBeVisible();

        // Reading those two opens the overflow menu on a bar narrow enough to have folded them,
        // and an open menu holds the pointer for the whole window. The gate below is unreachable
        // until it is shut.
        await closeShellOverflow(page);

        // The gate is not a dead end, and the only way out of it is through the disclosure.
        await page.getByTestId('consent-gate-read-again').click();
        await expect(modal).toBeVisible({ timeout: 15_000 });
        await page.getByTestId('consent-accept').click();

        await expect(page.getByTestId('consent-gate')).toHaveCount(0, { timeout: 15_000 });
        const afterAccept = await page.evaluate(async () => window.bfc.invoke('consent:get'));
        expect(afterAccept.decision).toBe('granted');
      } finally {
        await app.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
