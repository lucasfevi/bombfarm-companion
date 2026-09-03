import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');

test.describe('app boot smoke', () => {
  test('main window mounts renderer and IPC round-trips', async () => {
    // Its own profile, like every other spec here: this smoke now clicks, and a click needs a
    // known consent state. Reusing the developer's real profile made the modal present in CI and
    // absent locally, which is the difference that hid a blocked click behind a local pass.
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-app-boot-'));
    const electronExec = path.join(
      desktopRoot,
      'node_modules',
      'electron',
      'dist',
      process.platform === 'win32' ? 'electron.exe' : 'electron',
    );

    const app = await electron.launch({
      executablePath: electronExec,
      args: [desktopRoot],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        BFC_FLAVOR: 'dev',
        BFC_GAME_READER: 'fixture',
        BFC_USER_DATA_DIR: userDataDir,
        ELECTRON_ENABLE_LOGGING: '1',
      },
    });

    try {
      const page = await app.firstWindow();
      await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
      await expect(page.getByTestId('game-status-chip')).toHaveText('Connected', { timeout: 15_000 });

      // Both directions of `BFC_HIDE_WINDOWS`, from whichever run is happening. Without this the
      // hidden run would be green whether or not the flag was honoured, and the flag could rot
      // into a no-op that nothing here would notice.
      const revealed = process.env.BFC_HIDE_WINDOWS !== '1';
      await expect
        .poll(
          () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false),
          { timeout: 15_000 },
        )
        .toBe(revealed);

      const flavor = await page.evaluate(async () => {
        const bridge = window.bfc;
        if (!bridge) throw new Error('preload bridge missing');
        return bridge.invoke('app:getFlavor');
      });
      expect(flavor).toBe('dev');

      const environment = await page.evaluate(async () => {
        const bridge = window.bfc;
        if (!bridge) throw new Error('preload bridge missing');
        return bridge.invoke('app:getEnvironment');
      });
      expect(environment).toEqual({
        flavor: 'dev',
        productName: 'Bomb Farm Companion (Dev)',
        badgeLabel: 'DEV',
        updateChannel: null,
        isPackaged: false,
        version: expect.stringMatching(/^\d+\.\d+\.\d+/),
      });

      await expect(page.getByTestId('flavor-badge')).toHaveText('DEV');
      await expect(page.getByTestId('app-version')).toHaveText(/^v\d+\.\d+\.\d+/);

      // Accept, matching every other spec here: the app shows a permission gate with no nav
      // instead of its content until consent is granted, so nothing below is reachable otherwise.
      const consentModal = page.getByTestId('consent-modal');
      await expect(consentModal).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('consent-accept').click();
      await expect(consentModal).toBeHidden({ timeout: 15_000 });

      // Live is the default tab in every flavor now, so its testids must be reachable the moment
      // consent clears — no nav click. The renderer has no real game process to attach to here, so
      // the honest "nothing read yet" empty state is exactly what should render, never four empty
      // lists standing in for an account that was never read.
      await expect(page.getByTestId('live-view')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('live-view')).toContainText('Nothing read from your account yet');

      // Four tabs: Live, Farm, Inventory, Settings (`navItemsFor`). This asserts the shell
      // rendered its nav at all, not which tabs it holds — `i18n.spec.mjs` names each one.
      const navButtons = page.locator('nav[aria-label="Main"] button');
      await expect(navButtons).toHaveCount(4, { timeout: 30_000 });

      // the renderer's @bombfarm/domain value import reached the DOM.
      await expect(page.getByTestId('domain-label-probe')).toHaveText('Common');

      const ping = await page.evaluate(async () => {
        const bridge = window.bfc;
        if (!bridge) throw new Error('preload bridge missing');
        return bridge.invoke('app:ping');
      });
      expect(ping).toEqual({ ok: true, from: 'main' });

      await app.close();
    } finally {
      await app.close().catch(() => undefined);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
