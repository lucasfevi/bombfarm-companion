import { test, expect, electron } from './smoke-test.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREMIUM_SHARED_MODULES } from '@bombfarm/contracts';
import { signFixture } from '../fixtures/premium/sign-fixture.mjs';
import { STUB_PATHS, activeStatusBody, startPremiumApiStub } from './premium-api-stub.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');
const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');
const SHIMS_PATH = path.join(desktopRoot, 'dist', 'main', 'premium-shims.json');

const LINKED_PAIR = { accountId: '424242', steamId64: '76561198000000001', token: 'fixture-game-token-linked-0001' };
const PLAYER_NAME = 'Smoke Fixture Player';
const MARKER = 'bfc-premium-fixture-marker';
const FILE_ROUTE = /^\/v1\/premium\/bundle\/(\d+)\/files\//;

/**
 * The Premium host from end to end, against a local stand-in for the API that signs Leases with the
 * public test Lease key and serves the signed fixture bundle: the app signs in, takes the licence,
 * downloads and verifies the bundle through its device-signed requests, runs the worker, and mounts
 * the bundle's panel in the Premium tab.
 *
 * Everything is asserted through the Premium view (`premium:get`) and the page's text; there are no
 * screenshots, so the spec runs with hidden windows (`pnpm test:smoke:hidden`). The shared smoke
 * fixture fails any test during which the app or the page reports a Content Security Policy
 * violation, so a panel the policy refused to load fails the mount test.
 */
function en(key) {
  const source = fs.readFileSync(EN_COPY_PATH, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*(?:\\n\\s*)?(['"])((?:(?!\\1)[^\\\\]|\\\\.)*)\\1`));
  if (!match) throw new Error(`premium-host.spec.mjs: could not find copy key "${key}" in ${EN_COPY_PATH}`);
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

const premiumTab = (page) =>
  page.locator('nav[aria-label="Main"]').getByRole('button', { name: en('premiumNavLabel'), exact: true });

const premiumView = (page) => page.evaluate(() => window.bfc.invoke('premium:get'));

test.describe.serial('The Premium host runs a signed bundle', () => {
  let stub;
  let tempDir;
  let userDataDir;
  let files;
  let app;
  let page;
  const fixtureOne = signFixture({ sequence: 1 });

  test.beforeAll(async () => {
    stub = await startPremiumApiStub({ licence: { userId: 'stub-user-0001', playing: { accountId: LINKED_PAIR.accountId, steamId64: LINKED_PAIR.steamId64 } } });
    stub.state.visible = true;
    stub.state.status = activeStatusBody();
    stub.publishBundle(fixtureOne);

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-premium-host-'));
    userDataDir = path.join(tempDir, 'user-data');
    fs.mkdirSync(userDataDir);
    files = { session: path.join(tempDir, 'session.cfg'), account: path.join(tempDir, 'account.json') };
    playAs(files, LINKED_PAIR);

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
        // The fixture asks for the first app version that carries the host; this tree has not shipped it yet.
        BFC_PREMIUM_DEV_APP_VERSION: '0.32.2',
      },
    });
    await app.evaluate(({ shell }) => {
      shell.openExternal = () => Promise.resolve();
    });
    page = await app.firstWindow();
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });

    const modal = page.getByTestId('consent-modal');
    await expect(modal).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('consent-accept').click();
    await expect(modal).toBeHidden({ timeout: 15_000 });

    await page.getByTestId('shell-settings').click();
    await page.getByTestId('settings-premium-sign-in').click();
    await expect.poll(() => stub.at(STUB_PATHS.signInRequest).length).toBe(1);
    const signInBody = stub.at(STUB_PATHS.signInRequest)[0].body;
    const callback = new URL(signInBody.redirectUri);
    callback.search = new URLSearchParams({ code: stub.state.code, state: signInBody.state }).toString();
    expect((await fetch(callback)).status).toBe(200);
    await expect(page.getByTestId('settings-premium-sign-out')).toBeVisible({ timeout: 20_000 });
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    await stub?.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('signing in takes the licence, downloads the bundle and runs its worker', async () => {
    await expect
      .poll(async () => (await premiumView(page)).licence?.state, { timeout: 30_000 })
      .toBe('holds');

    await expect
      .poll(async () => (await premiumView(page)).host, { timeout: 30_000 })
      .toEqual({
        phase: 'running',
        uiUrl: 'app://bundle/_premium/1/ui/index.js',
        styleUrl: 'app://bundle/_premium/1/ui/index.css',
        localBuild: false,
      });

    // The worker is a real utility process, started from the loader inside the app's own files.
    const utilities = await app.evaluate(({ app: electronApp }) =>
      electronApp.getAppMetrics().filter((metric) => metric.type === 'Utility').map((metric) => metric.name ?? metric.serviceName),
    );
    expect(utilities).toContain('Premium');

    // The fixture worker asked for a capability nobody granted and the host refused it, in its log.
    await expect
      .poll(() => fs.readFileSync(path.join(userDataDir, 'logs', 'main.log'), 'utf8'), { timeout: 15_000 })
      .toMatch(/premium\.capability[\s\S]{0,120}outcome: 'not_granted'/);

    // The verified bundle was kept on disk under the app's data folder.
    expect(fs.readdirSync(path.join(userDataDir, 'premium'))).toContain('1');
  });

  test('the stub saw the manifest before every file, each request signed by the device', async () => {
    const bundleRequests = stub.requests.filter(
      (request) => request.path === STUB_PATHS.bundle || FILE_ROUTE.test(request.path),
    );
    const manifestIndex = bundleRequests.findIndex((request) => request.path === STUB_PATHS.bundle);
    const fileIndexes = bundleRequests.flatMap((request, index) => (FILE_ROUTE.test(request.path) ? [index] : []));
    expect(manifestIndex).toBe(0);
    expect(fileIndexes.map((index) => bundleRequests[index].path.replace(FILE_ROUTE, ''))).toEqual([
      'ui/index.css',
      'ui/index.js',
      'worker/index.cjs',
    ]);
    for (const index of fileIndexes) expect(index).toBeGreaterThan(manifestIndex);
    for (const request of bundleRequests) {
      expect(request.method).toBe('GET');
      expect(request.deviceSigned, `${request.path} carries a verified device signature`).toBe(true);
      expect(stub.state.validTokens.has(request.bearer)).toBe(true);
    }
    expect(stub.unknown).toEqual([]);
  });

  test('the fixture panel mounts in the Premium tab', async () => {
    await expect(premiumTab(page)).toBeVisible({ timeout: 20_000 });
    await premiumTab(page).click();

    const mount = page.getByTestId('premium-host-mount');
    await expect(mount).toBeVisible({ timeout: 20_000 });
    await expect(mount).toContainText(MARKER);
    await expect(page.getByTestId('premium-host-stopped')).toHaveCount(0);
    await expect(page.getByTestId('premium-host-local')).toHaveCount(0);
  });

  test('every shared module the bundle can import has the names its shim exports', async () => {
    const shims = JSON.parse(fs.readFileSync(SHIMS_PATH, 'utf8'));
    expect(Object.keys(shims)).toEqual([...PREMIUM_SHARED_MODULES]);

    const live = await page.evaluate(() => {
      const table = globalThis.__bfcPremiumShared;
      return Object.fromEntries(
        Object.entries(table).map(([name, namespace]) => [name, Object.keys(namespace).filter((key) => key !== 'default').sort()]),
      );
    });
    expect(Object.keys(live)).toEqual([...PREMIUM_SHARED_MODULES]);
    for (const name of PREMIUM_SHARED_MODULES) {
      expect(live[name].length, `${name} has exports`).toBeGreaterThan(0);
      expect([...shims[name]].sort(), `${name} shim names`).toEqual(live[name]);
    }
  });
});
