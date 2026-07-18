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
        ELECTRON_ENABLE_LOGGING: '1',
      },
    });

    try {
      const page = await app.firstWindow();
      await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });

      const flavor = await page.evaluate(async () => {
        const bridge = window.bfc;
        if (!bridge) throw new Error('preload bridge missing');
        return bridge.invoke('app:getFlavor');
      });
      expect(flavor).toBe('dev');

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
