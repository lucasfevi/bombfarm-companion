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
      // Memory mode's tickLive() scans for a real OS process by this name. On a developer
      // machine that actually has BombFarm running (this is the companion for that exact
      // game), the default 'BombFarm.exe' would be found for real and the "game not running"
      // launch would report connected — a false failure that has nothing to do with the
      // feature under test. Pin it to a name that can never exist.
      BFC_GAME_PROCESS: 'bfc-smoke-no-such-process.exe',
      ...env,
    },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  return { app, page };
}

async function getAccount(page) {
  return page.evaluate(async () => {
    const bridge = window.bfc;
    if (!bridge) throw new Error('preload bridge missing');
    return bridge.invoke('account:get');
  });
}

test.describe('account restart round-trip smoke', () => {
  test('an account persists across a full app restart, honestly stamped as stale', async () => {
    // One fresh temp user-data dir shared by both launches, passed via BFC_USER_DATA_DIR
    // (T9) — never the developer's real %APPDATA% flavor directory (design R-7).
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-account-restart-'));

    let firstView;
    try {
      // --- Launch 1: fixture mode, the game is "running" -----------------------------------
      const { app: app1, page: page1 } = await launchApp({
        BFC_GAME_READER: 'fixture',
        BFC_USER_DATA_DIR: userDataDir,
      });
      try {
        // Give the fixture producer at least one tick to commit before reading account:get.
        await expect
          .poll(
            async () => {
              const view = await getAccount(page1);
              return view.payload.fidelity?.account?.status;
            },
            { timeout: 30_000 },
          )
          .toBe('resolved');

        firstView = await getAccount(page1);
      } finally {
        await app1.close().catch(() => undefined);
      }

      expect(firstView.payload.fidelity?.account).toEqual({
        status: 'resolved',
        capturedAt: expect.any(String),
      });
      expect(firstView.payload.fidelity?.heroes.status).toBe('resolved');
      expect(firstView.payload.fidelity?.items.status).toBe('resolved');
      expect(firstView.payload.fidelity?.skills).toEqual({ status: 'missing' });
      expect(firstView.payload.fidelity?.casa).toEqual({ status: 'missing' });

      const capturedAt = {
        account: firstView.payload.fidelity.account.capturedAt,
        heroes: firstView.payload.fidelity.heroes.capturedAt,
        items: firstView.payload.fidelity.items.capturedAt,
      };

      // --- Launch 2: no game reader running, same user-data dir -----------------------------
      const { app: app2, page: page2 } = await launchApp({
        BFC_USER_DATA_DIR: userDataDir,
      });
      let secondView;
      try {
        secondView = await getAccount(page2);
      } finally {
        await app2.close().catch(() => undefined);
      }

      // Bodies survived, byte-for-byte.
      expect(secondView.payload.account).toEqual(firstView.payload.account);
      expect(secondView.payload.heroes).toEqual(firstView.payload.heroes);
      expect(secondView.payload.items).toEqual(firstView.payload.items);

      // Timestamps are string-identical to launch 1's — never re-stamped.
      expect(secondView.payload.fidelity.account.capturedAt).toBe(capturedAt.account);
      expect(secondView.payload.fidelity.heroes.capturedAt).toBe(capturedAt.heroes);
      expect(secondView.payload.fidelity.items.capturedAt).toBe(capturedAt.items);

      // Every section is stale or missing — explicitly never resolved (the headline claim).
      for (const section of ['account', 'heroes', 'skills', 'casa', 'items']) {
        const status = secondView.payload.fidelity[section].status;
        expect(status, `section "${section}" must not be resolved after restart`).not.toBe('resolved');
        expect(['stale', 'missing']).toContain(status);
      }
      expect(secondView.payload.fidelity.account.status).toBe('stale');
      expect(secondView.payload.fidelity.heroes.status).toBe('stale');
      expect(secondView.payload.fidelity.items.status).toBe('stale');
      expect(secondView.payload.fidelity.skills.status).toBe('missing');
      expect(secondView.payload.fidelity.casa.status).toBe('missing');

      expect(secondView.gameRunning).toBe(false);
      expect(secondView.store.status).toBe('ok');
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
