import { test, expect, electron } from './smoke-test.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUNDLE_MARKER,
  LINKED_PAIR,
  OTHER_SECTION_MARKER,
  PLAYER_NAME,
  TRACKING_CAPABILITIES,
  stageBattleLogFolder,
  trackingBundle,
  writeTrackingCapture,
} from '../fixtures/premium/tracking-fixtures.mjs';
import { STUB_PATHS, activeStatusBody, startPremiumApiStub } from './premium-api-stub.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

/**
 * The tracking fixture bundle, loaded once: it reaches running with all eight capabilities and the
 * Live slot granted, its worker keeps its throwaway table and hears both game feeds, and its panel
 * answers a round trip to the worker. This is the sanity check the tracking checks build on; it
 * asserts through IPC and page text, never a screenshot, so it runs with hidden windows.
 */
function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

function writeAtomically(file, contents) {
  const staging = `${file}.next`;
  fs.writeFileSync(staging, contents);
  fs.renameSync(staging, file);
}

test.describe.serial('The tracking fixture bundle loads', () => {
  let stub;
  let tempDir;
  let app;
  let page;

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    await stub?.close();
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('it reaches running with the eight capabilities granted, and its worker and panel answer', async () => {
    test.setTimeout(180_000);
    stub = await startPremiumApiStub({
      licence: {
        userId: 'stub-user-0001',
        playing: { accountId: LINKED_PAIR.accountId, steamId64: LINKED_PAIR.steamId64 },
      },
    });
    stub.state.visible = true;
    stub.state.status = activeStatusBody();
    stub.publishBundle(trackingBundle());

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-premium-tracking-fixture-'));
    const userDataDir = path.join(tempDir, 'user-data');
    fs.mkdirSync(userDataDir);
    const session = path.join(tempDir, 'session.cfg');
    const account = path.join(tempDir, 'account.json');
    writeAtomically(
      session,
      `[auth]\ntoken="${LINKED_PAIR.token}"\naccount_id="${LINKED_PAIR.accountId}"\nsteam_id64="${LINKED_PAIR.steamId64}"\n`,
    );
    const fixture = JSON.parse(fs.readFileSync(ACCOUNT_FIXTURE, 'utf8'));
    fixture.account = { ...fixture.account, account_id: Number(LINKED_PAIR.accountId), player_name: PLAYER_NAME };
    writeAtomically(account, JSON.stringify(fixture));

    app = await electron.launch({
      executablePath: electronExecutable(),
      args: [desktopRoot],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        BFC_FLAVOR: 'dev',
        ELECTRON_ENABLE_LOGGING: '1',
        BFC_GAME_PROCESS: 'bfc-smoke-no-such-process.exe',
        BFC_GAME_READER: 'fixture',
        BFC_FIXTURE_ACCOUNT_FILE: account,
        BFC_USER_DATA_DIR: userDataDir,
        BFC_TOKEN_PATH_OVERRIDE: session,
        BFC_PREMIUM_API_ORIGIN: stub.origin,
        BFC_PREMIUM_DEV_APP_VERSION: '0.32.2',
        BFC_LIVE_SOURCE: 'replay',
        BFC_REPLAY_CAPTURE: writeTrackingCapture(path.join(tempDir, 'capture.bfcc')),
        // Empty: the replay serves no duel or collection body beside the one in the capture.
        BFC_REPLAY_PVP_FIXTURE: '',
        BFC_REPLAY_COLLECTIONS_FIXTURE: '',
        BFC_BATTLE_LOG_DIR_OVERRIDE: stageBattleLogFolder(path.join(tempDir, 'game')),
      },
    });
    await app.evaluate(({ shell, Notification }) => {
      shell.openExternal = () => Promise.resolve();
      Notification.isSupported = () => false;
    });
    page = await app.firstWindow();
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });

    const modal = page.getByTestId('consent-modal');
    await expect(modal).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('consent-accept').click();
    await expect(modal).toBeHidden({ timeout: 15_000 });

    const requestsBefore = stub.at(STUB_PATHS.signInRequest).length;
    await page.getByTestId('shell-settings').click();
    await page.getByTestId('settings-premium-sign-in').click();
    await expect.poll(() => stub.at(STUB_PATHS.signInRequest).length).toBe(requestsBefore + 1);
    const signInBody = stub.at(STUB_PATHS.signInRequest)[requestsBefore].body;
    const callback = new URL(signInBody.redirectUri);
    callback.search = new URLSearchParams({ code: stub.state.code, state: signInBody.state }).toString();
    expect((await fetch(callback)).status).toBe(200);
    await expect(page.getByTestId('settings-premium-sign-out')).toBeVisible({ timeout: 20_000 });

    const view = () => page.evaluate(() => window.bfc.invoke('premium:get'));
    await expect
      .poll(async () => (await view()).host?.uiUrl ?? null, { timeout: 90_000 })
      .toBe('app://bundle/_premium/1/ui/index.js');
    const host = (await view()).host;
    expect(host.phase).toBe('running');
    expect(host.slots).toEqual(['premium.tab', 'live.section']);

    await page.locator('nav[aria-label="Main"]').getByRole('button', { name: 'Premium', exact: true }).click();
    const mount = page.getByTestId('premium-host-mount');
    await expect(mount).toContainText(BUNDLE_MARKER, { timeout: 20_000 });

    await expect(mount.getByTestId('tracking-slot')).toHaveText('slot: premium.tab');
    await expect(mount.getByTestId('tracking-worker')).toHaveText('worker: ok ping-premium.tab', { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-granted')).toHaveText(`granted: ${TRACKING_CAPABILITIES.filter((name) => name !== 'live.section').join(',')}`, { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-db')).toHaveText('db: ready 1', { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-row')).toHaveText('row: first-run', { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-subscribed')).toHaveText('subscribed: tap=true battleLog=true', { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-starts')).toHaveText('starts: 1');
    await expect(mount.getByTestId('tracking-sequence')).toHaveText('sequence: 1');

    // Both feeds reach the worker: a frame and a body from the replay, and the licensed section only.
    await expect(mount.getByTestId('tracking-tap-count')).not.toHaveText('tap: 0', { timeout: 60_000 });
    await expect(mount.getByTestId('tracking-battle-count')).not.toHaveText('battleLog: 0', { timeout: 60_000 });

    // What the worker recorded, asked through the panel's own path: the licensed section only, as a baseline.
    const recorded = await page.evaluate(() => window.bfc.invoke('premium:uiCall', 'premium.worker', { op: 'state' }));
    expect(recorded.ok).toBe(true);
    const { battle } = recorded.value;
    expect(battle[0]).toMatchObject({ section: `acc_${LINKED_PAIR.accountId}`, accountKey: LINKED_PAIR.accountId, baseline: true, gameLanguage: 'en' });
    expect(JSON.stringify(battle)).not.toContain(OTHER_SECTION_MARKER);
    expect(stub.unknown).toEqual([]);
  });
});
