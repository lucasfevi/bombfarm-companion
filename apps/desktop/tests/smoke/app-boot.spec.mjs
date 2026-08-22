import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');

test.describe('app boot smoke', () => {
  test('main window mounts renderer and IPC round-trips', async () => {
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
        ELECTRON_ENABLE_LOGGING: '1',
      },
    });

    try {
      const page = await app.firstWindow();
      await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
      await expect(page.getByTestId('game-status-chip')).toHaveText('Connected', { timeout: 15_000 });

      // Planning is the default tab, so the raw payload dump needs an explicit nav click. It is
      // offered in the development flavors only, which this launch selects via BFC_FLAVOR.
      await page.getByRole('button', { name: 'Diagnostics' }).click();
      const snapshotJson = await page.getByTestId('game-snapshot-json').innerText();
      expect(snapshotJson).toContain('"gold"');

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

      // MP3 F1 (AD-032) — the renderer's @bombfarm/domain value import reached the DOM.
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
    }
  });
});
