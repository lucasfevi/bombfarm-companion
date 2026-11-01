import { test, expect, electron } from './smoke-test.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signFixture } from '../fixtures/premium/sign-fixture.mjs';
import { STUB_PATHS, activeStatusBody, startPremiumApiStub } from './premium-api-stub.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');
const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');

const LINKED_PAIR = { accountId: '424242', steamId64: '76561198000000001', token: 'fixture-game-token-linked-0001' };
const PLAYER_NAME = 'Smoke Fixture Player';
const MARKER = 'bfc-premium-fixture-marker';
const FILE_ROUTE = /^\/v1\/premium\/bundle\/(\d+)\/files\//;
const CAPABILITIES = ['premium.status', 'store', 'log', 'notify'];
const SHORT_LEASE_SECONDS = 20;
const LONG_LEASE_SECONDS = 3600;
// A manual refresh is held to one per 30 s, so the checks that wait on renewals need room.
const LONG_TEST_MS = 300_000;

/**
 * The first four Premium capabilities from end to end, against a local stand-in for the API that
 * signs Leases with the public test Lease key and serves a signed check bundle: a worker that calls
 * each capability once and writes what came back into `store`, and a panel that prints it.
 *
 * Eight checks, in order, on one stub and one data folder: signed out; activation; a restart;
 * the Lease window ending; the licence ending and moving away; the wrong audience; an update; and a
 * raised floor. Everything is read through `window.bfc.invoke` and the page's text, never a
 * screenshot, so the spec runs with hidden windows (`pnpm test:smoke:hidden`).
 *
 * The system toast is switched off in the main process (`Notification.isSupported` answers false),
 * so `notify` answers `unavailable` and no toast appears on the machine running the suite.
 */
function en(key) {
  const source = fs.readFileSync(EN_COPY_PATH, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*(?:\\n\\s*)?(['"])((?:(?!\\1)[^\\\\]|\\\\.)*)\\1`));
  if (!match) throw new Error(`premium-capabilities.spec.mjs: could not find copy key "${key}" in ${EN_COPY_PATH}`);
  return match[2].replace(/\\'/g, "'");
}

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

/** Replaces a file in one step, so the fixture reader never sees it half written. */
function writeAtomically(file, contents) {
  const staging = `${file}.next`;
  fs.writeFileSync(staging, contents);
  fs.renameSync(staging, file);
}

function playAs(files, pair) {
  writeAtomically(
    files.session,
    `[auth]\ntoken="${pair.token}"\naccount_id="${pair.accountId}"\nsteam_id64="${pair.steamId64}"\n`,
  );
  const fixture = JSON.parse(fs.readFileSync(ACCOUNT_FIXTURE, 'utf8'));
  fixture.account = { ...fixture.account, account_id: Number(pair.accountId), player_name: PLAYER_NAME };
  writeAtomically(files.account, JSON.stringify(fixture));
}

const checkBundle = (sequence, version) =>
  signFixture({ dir: 'check-bundle', sequence, version, hostApi: '>=1.1.0 <2.0.0', capabilities: CAPABILITIES });

const premiumTab = (page) =>
  page.locator('nav[aria-label="Main"]').getByRole('button', { name: en('premiumNavLabel'), exact: true });
const premiumView = (page) => page.evaluate(() => window.bfc.invoke('premium:get'));
const uiCall = (page, capability, args) =>
  page.evaluate(([name, value]) => window.bfc.invoke('premium:uiCall', name, value), [capability, args]);

test.describe.serial('The Premium capabilities, end to end', () => {
  let stub;
  let tempDir;
  let userDataDir;
  let files;
  let app;
  let page;

  const bundleRequestCount = () =>
    stub.requests.filter((request) => request.path === STUB_PATHS.bundle || FILE_ROUTE.test(request.path)).length;
  const premiumFolders = () => {
    const dir = path.join(userDataDir, 'premium');
    return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
  };
  const mainLog = () => fs.readFileSync(path.join(userDataDir, 'logs', 'main.log'), 'utf8');

  async function launch() {
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
        BFC_FIXTURE_ACCOUNT_FILE: files.account,
        BFC_USER_DATA_DIR: userDataDir,
        BFC_TOKEN_PATH_OVERRIDE: files.session,
        BFC_PREMIUM_API_ORIGIN: stub.origin,
        BFC_PREMIUM_DEV_APP_VERSION: '0.32.2',
      },
    });
    await app.evaluate(({ shell, Notification }) => {
      shell.openExternal = () => Promise.resolve();
      // No toast on the machine running the suite: the host then answers `unavailable`.
      Notification.isSupported = () => false;
    });
    page = await app.firstWindow();
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  }

  async function quit() {
    await app?.close().catch(() => undefined);
    app = undefined;
  }

  async function acceptConsent() {
    const modal = page.getByTestId('consent-modal');
    await expect(modal).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('consent-accept').click();
    await expect(modal).toBeHidden({ timeout: 15_000 });
  }

  async function signIn() {
    const requestsBefore = stub.at(STUB_PATHS.signInRequest).length;
    await page.getByTestId('shell-settings').click();
    await page.getByTestId('settings-premium-sign-in').click();
    await expect.poll(() => stub.at(STUB_PATHS.signInRequest).length).toBe(requestsBefore + 1);
    const signInBody = stub.at(STUB_PATHS.signInRequest)[requestsBefore].body;
    const callback = new URL(signInBody.redirectUri);
    callback.search = new URLSearchParams({ code: stub.state.code, state: signInBody.state }).toString();
    expect((await fetch(callback)).status).toBe(200);
    await expect(page.getByTestId('settings-premium-sign-out')).toBeVisible({ timeout: 20_000 });
  }

  /** Presses Refresh until `read` returns a value `done` accepts: the renewal it triggers is what carries news. */
  async function refreshUntil(read, done, timeout = 120_000) {
    await expect
      .poll(
        async () => {
          try {
            await page.evaluate(() => window.bfc.invoke('premium:refresh'));
            return done(await read());
          } catch {
            return false; // The page was reloading.
          }
        },
        { timeout, intervals: [1_000, 2_000, 5_000] },
      )
      .toBe(true);
  }

  const hostView = async () => (await premiumView(page)).host;
  const waitForRunning = (sequence) =>
    expect
      .poll(async () => (await hostView())?.uiUrl ?? null, { timeout: 60_000 })
      .toBe(`app://bundle/_premium/${sequence}/ui/index.js`);

  async function showPanel() {
    await expect(premiumTab(page)).toBeVisible({ timeout: 20_000 });
    await premiumTab(page).click();
    const mount = page.getByTestId('premium-host-mount');
    await expect(mount).toBeVisible({ timeout: 20_000 });
    await expect(mount).toContainText(MARKER, { timeout: 20_000 });
    return mount;
  }

  test.beforeAll(async () => {
    stub = await startPremiumApiStub({
      licence: {
        userId: 'stub-user-0001',
        playing: { accountId: LINKED_PAIR.accountId, steamId64: LINKED_PAIR.steamId64 },
      },
    });
    stub.state.visible = true;
    stub.state.status = activeStatusBody();
    stub.publishBundle(checkBundle(1, '1.0.0'));

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-premium-capabilities-'));
    userDataDir = path.join(tempDir, 'user-data');
    fs.mkdirSync(userDataDir);
    files = { session: path.join(tempDir, 'session.cfg'), account: path.join(tempDir, 'account.json') };
    playAs(files, LINKED_PAIR);
  });

  test.afterAll(async () => {
    await quit();
    await stub?.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('check one: signed out, nothing mounts and no bundle is asked for', async () => {
    await launch();
    await acceptConsent();
    await page.waitForTimeout(4_000);

    expect((await premiumView(page)).session).toBe('signed-out');
    await expect(page.getByTestId('premium-host-mount')).toHaveCount(0);
    expect(bundleRequestCount()).toBe(0);
    expect(stub.at(STUB_PATHS.lease)).toHaveLength(0);
  });

  test('check two: signing in mounts the panel, which shows all four capability results', async () => {
    await signIn();
    await expect.poll(async () => (await premiumView(page)).licence?.state, { timeout: 30_000 }).toBe('holds');
    await waitForRunning(1);

    const mount = await showPanel();
    await expect(mount.getByTestId('check-status')).toHaveText('status: ok active=true audience=owner paused=false', { timeout: 30_000 });
    await expect(mount.getByTestId('check-store')).toHaveText('store: ok read-back=1');
    await expect(mount.getByTestId('check-log')).toHaveText('log: ok written');
    // The system toast is off for this run, so the host refuses `notify` as unavailable.
    await expect(mount.getByTestId('check-notify')).toHaveText('notify: refused unavailable');
    await expect(mount.getByTestId('check-sequence')).toHaveText('sequence: 1');
    await expect(mount.getByTestId('check-starts')).toHaveText('starts: 1');

    // The panel's own path reaches the same channel as the worker's.
    const status = await uiCall(page, 'premium.status', undefined);
    expect(status).toMatchObject({ ok: true, value: { active: true, audience: 'owner', paused: false } });
    expect(await uiCall(page, 'not.granted', undefined)).toMatchObject({ ok: false, error: 'not_granted' });

    await expect.poll(mainLog, { timeout: 15_000 }).toMatch(/premium\.bundle_log[\s\S]{0,200}bundleEvent: 'check\.ran'/);
    expect(stub.unknown).toEqual([]);
  });

  test('check three: a value kept with store is read back after a restart', async () => {
    await quit();
    await launch();

    await expect.poll(async () => (await premiumView(page)).licence?.state, { timeout: 30_000 }).toBe('holds');
    await waitForRunning(1);
    const mount = await showPanel();
    // The worker counted a second start from the value the first run stored.
    await expect(mount.getByTestId('check-starts')).toHaveText('starts: 2', { timeout: 30_000 });
    await expect(mount.getByTestId('check-store')).toHaveText('store: ok read-back=2');
  });

  test('check four: when the Lease window ends the host pauses, refuses a call, and resumes on renewal', async () => {
    test.setTimeout(LONG_TEST_MS);
    // A short Lease, then renewals that fail: nothing extends the window.
    stub.state.leaseSeconds = SHORT_LEASE_SECONDS;
    const renewalsBefore = stub.at(STUB_PATHS.lease).length;
    await refreshUntil(
      () => stub.at(STUB_PATHS.lease).length,
      (count) => count > renewalsBefore,
    );
    stub.state.renewalStatus = 503;

    await expect
      .poll(async () => (await hostView())?.paused ?? null, { timeout: 60_000, intervals: [1_000] })
      .toEqual({ reason: 'unconfirmed' });
    expect((await hostView())?.phase).toBe('paused');
    expect(await uiCall(page, 'premium.status', undefined)).toMatchObject({ ok: false, error: 'paused' });
    // The shipped mount shows the bundle only while it runs.
    await expect(page.getByTestId('premium-host-mount')).toHaveCount(0);
    // A renewal that is asked for while the stub fails is refused, and the host stays paused.
    await refreshUntil(
      () => stub.at(STUB_PATHS.lease).filter((entry) => entry.extra.refused === 503).length,
      (count) => count > 0,
    );
    expect((await hostView())?.paused).toEqual({ reason: 'unconfirmed' });

    stub.state.renewalStatus = null;
    stub.state.leaseSeconds = LONG_LEASE_SECONDS;
    await refreshUntil(hostView, (host) => host?.phase === 'running' && !host.paused);
    expect(await uiCall(page, 'premium.status', undefined)).toMatchObject({ ok: true, value: { paused: false } });
    await showPanel();
  });

  test('check five: ended, then moved, each unmounts, deletes the code and its store, and reports once', async () => {
    test.setTimeout(LONG_TEST_MS);
    stub.state.cleanupProbe = () => ({ premiumFolderPresent: fs.existsSync(path.join(userDataDir, 'premium')) });

    for (const [index, reason] of ['ended', 'moved'].entries()) {
      stub.state.leaseState = reason;
      await refreshUntil(
        () => stub.at(STUB_PATHS.licenceCleanup).length,
        (count) => count === index + 1,
      );
      const cleanup = stub.at(STUB_PATHS.licenceCleanup)[index];
      expect(cleanup.extra.probe, `${reason}: nothing was left to delete when the report arrived`).toEqual({
        premiumFolderPresent: false,
      });
      expect(cleanup.deviceSigned).toBe(true);
      await expect.poll(async () => (await hostView())?.phase, { timeout: 30_000 }).toBe('none');
      await expect(page.getByTestId('premium-host-mount')).toHaveCount(0);
      expect(premiumFolders()).toEqual([]);
      expect(stub.at(STUB_PATHS.licenceCleanup)).toHaveLength(index + 1);

      // The last PC comes back: the licence is held again, and at the next start the code downloads
      // again. The start count is back at one because the store went with the code.
      stub.state.leaseState = 'active';
      await quit();
      await launch();
      await waitForRunning(1);
      const mount = await showPanel();
      await expect(mount.getByTestId('check-starts'), `${reason}: the store went with the code`).toHaveText('starts: 1', {
        timeout: 30_000,
      });
    }
  });

  test('check six: a public user is not offered an owner-only bundle, so nothing mounts', async () => {
    test.setTimeout(LONG_TEST_MS);
    // Start from nothing on disk: the licence ends, then the user is a public one.
    stub.state.cleanupProbe = null;
    stub.state.leaseState = 'ended';
    const cleanupsBefore = stub.at(STUB_PATHS.licenceCleanup).length;
    await refreshUntil(
      () => stub.at(STUB_PATHS.licenceCleanup).length,
      (count) => count === cleanupsBefore + 1,
    );
    await expect.poll(async () => (await hostView())?.phase, { timeout: 30_000 }).toBe('none');

    stub.state.me.audience = 'public';
    stub.state.bundleAudience = 'owner';
    stub.state.leaseState = 'active';
    const requestsBefore = bundleRequestCount();
    await quit();
    await launch();
    await expect
      .poll(() => stub.at(STUB_PATHS.bundle).filter((entry) => entry.extra.audienceRefused === true).length, {
        timeout: 60_000,
      })
      .toBeGreaterThan(0);

    expect(bundleRequestCount()).toBeGreaterThan(requestsBefore);
    await page.waitForTimeout(2_000);
    expect((await hostView())?.uiUrl ?? null).toBeNull();
    await expect(page.getByTestId('premium-host-mount')).toHaveCount(0);
    expect(premiumFolders()).toEqual([]);
    expect(stub.at(STUB_PATHS.bundle).every((entry) => entry.extra.audienceRefused === true || entry.extra.audienceRefused === undefined)).toBe(true);
  });

  test('check seven: a newer bundle waits for the next start while the older one keeps running', async () => {
    test.setTimeout(LONG_TEST_MS);
    stub.state.me.audience = 'owner';
    stub.state.bundleAudience = 'owner';
    await quit();
    await launch();
    await waitForRunning(1);
    const mount = await showPanel();
    await expect(mount.getByTestId('check-sequence')).toHaveText('sequence: 1', { timeout: 30_000 });

    const manifestsBefore = stub.at(STUB_PATHS.bundle).length;
    stub.publishBundle(checkBundle(2, '1.1.0'));
    await refreshUntil(
      () => stub.requests.filter((request) => /^\/v1\/premium\/bundle\/2\/files\//.test(request.path)).length,
      (count) => count === 3,
    );
    expect(stub.at(STUB_PATHS.bundle).length).toBeGreaterThan(manifestsBefore);

    // Still the first bundle, running, until the app starts again.
    expect((await hostView())?.uiUrl).toBe('app://bundle/_premium/1/ui/index.js');
    expect((await hostView())?.phase).toBe('running');
    await expect(page.getByTestId('premium-host-mount').getByTestId('check-sequence')).toHaveText('sequence: 1');

    await quit();
    await launch();
    await waitForRunning(2);
    const next = await showPanel();
    await expect(next.getByTestId('check-sequence')).toHaveText('sequence: 2', { timeout: 30_000 });
  });

  test('check eight: a Lease whose floor is above the running bundle stops it on the next renewal', async () => {
    test.setTimeout(LONG_TEST_MS);
    expect((await hostView())?.phase).toBe('running');

    stub.state.minSequence = 3;
    await refreshUntil(hostView, (host) => host?.phase !== 'running' && (host?.uiUrl ?? null) === null);

    await expect(page.getByTestId('premium-host-mount')).toHaveCount(0);
    await expect.poll(premiumFolders, { timeout: 30_000 }).toEqual([]);
    expect(stub.unknown).toEqual([]);
  });
});
