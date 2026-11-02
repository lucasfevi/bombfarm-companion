import { test, expect, electron } from './smoke-test.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  STUB_APPROVAL_URL,
  STUB_HAND_OFF_URL,
  STUB_PATHS,
  graceStatusBody,
  startPremiumApiStub,
} from './premium-api-stub.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');
const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');

const GAME_TOKEN = 'fixture-game-token-0123456789abcdef';
const GAME_ACCOUNT_ID = '424242';
const GAME_STEAM_ID = '76561198000000001';
const GAME_PLAYER_NAME = 'Smoke Fixture Player';

/**
 * Premium sign-in, status and hand-off, driven against a local stand-in for the API.
 *
 * Nothing here reaches a real host: the app is pointed at the stub through the unpackaged-only
 * origin override, the system browser is replaced by a recorder in the main process, and the game
 * session file is a fixture holding a known token, account id and SteamID, beside an account fixture
 * that names the same account and gives it a player name. The browser's own job
 * (following the approval and landing on the loopback callback) is done by the spec.
 *
 * The clock the app reads for its refresh floor is moved forward in the main process rather than
 * waited out, and copy is read out of `en.ts` rather than hardcoded.
 */
function en(key) {
  const source = fs.readFileSync(EN_COPY_PATH, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) throw new Error(`premium.spec.mjs: could not find copy key "${key}" in ${EN_COPY_PATH}`);
  return match[1].replace(/\\'/g, "'");
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

async function launchApp({ userDataDir, sessionFile, accountFile, origin }) {
  const app = await electron.launch({
    executablePath: electronExecutable(),
    args: [desktopRoot],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      ELECTRON_ENABLE_LOGGING: '1',
      BFC_GAME_PROCESS: 'bfc-smoke-no-such-process.exe',
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: accountFile,
      BFC_USER_DATA_DIR: userDataDir,
      BFC_TOKEN_PATH_OVERRIDE: sessionFile,
      BFC_PREMIUM_API_ORIGIN: origin,
    },
  });
  await app.evaluate(({ shell }) => {
    globalThis.__openedUrls = [];
    shell.openExternal = (url) => {
      globalThis.__openedUrls.push(String(url));
      return Promise.resolve();
    };
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  return { app, page };
}

const openedUrls = (app) => app.evaluate(() => globalThis.__openedUrls ?? []);

async function acceptConsent(page) {
  const modal = page.getByTestId('consent-modal');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(modal).toBeHidden({ timeout: 15_000 });
}

async function openSettings(page) {
  await page.getByTestId('shell-settings').click();
  await expect(page.getByTestId('settings-view')).toBeVisible({ timeout: 20_000 });
}

const premiumTab = (page) =>
  page.locator('nav[aria-label="Main"]').getByRole('button', { name: en('premiumNavLabel'), exact: true });

function sessionRow(userDataDir) {
  const db = new DatabaseSync(path.join(userDataDir, 'account.db'), { readOnly: true });
  try {
    const row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get('premium_session_v1');
    return row === undefined ? null : String(row.value);
  } finally {
    db.close();
  }
}

test.describe.serial('Premium sign-in and status against a stand-in API', () => {
  let stub;
  let tempDir;
  let userDataDir;
  let sessionFile;
  let accountFile;
  let app;
  let page;
  let openedAtSignOut;
  let encryptionAvailable;

  test.beforeAll(async () => {
    stub = await startPremiumApiStub();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-premium-'));
    userDataDir = path.join(tempDir, 'user-data');
    fs.mkdirSync(userDataDir);
    sessionFile = path.join(tempDir, 'session.cfg');
    fs.writeFileSync(
      sessionFile,
      `[auth]\ntoken="${GAME_TOKEN}"\naccount_id="${GAME_ACCOUNT_ID}"\nsteam_id64="${GAME_STEAM_ID}"\n`,
    );
    const fixture = JSON.parse(fs.readFileSync(ACCOUNT_FIXTURE, 'utf8'));
    fixture.account = { ...fixture.account, account_id: Number(GAME_ACCOUNT_ID), player_name: GAME_PLAYER_NAME };
    accountFile = path.join(tempDir, 'account.json');
    fs.writeFileSync(accountFile, JSON.stringify(fixture));
    ({ app, page } = await launchApp({ userDataDir, sessionFile, accountFile, origin: stub.origin }));
    await acceptConsent(page);
    encryptionAvailable = await app.evaluate(({ safeStorage }) => safeStorage.isEncryptionAvailable());
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    await stub?.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('shows no Premium tab while the API says it is hidden, and Settings offers Sign in', async () => {
    await expect(premiumTab(page)).toHaveCount(0);
    await openSettings(page);
    await expect(page.getByTestId('settings-premium-sign-in')).toBeVisible();
    await expect(page.getByTestId('settings-premium-sign-out')).toHaveCount(0);
    await expect(premiumTab(page)).toHaveCount(0);
  });

  test('carries the licence line signed out and sends no licence request without a session', async () => {
    const view = await page.evaluate(() => window.bfc.invoke('premium:get'));

    expect(view.session).toBe('signed-out');
    expect(view.licence).toMatchObject({ state: 'signed_out', moveInFlight: false });
    expect(Object.keys(view.licence).sort()).toEqual(['moveFailed', 'moveInFlight', 'removalDone', 'state']);
    const licencePaths = ['/v1/premium/licence', '/v1/premium/licence/activate', '/v1/premium/lease', '/v1/premium/licence/cleanup'];
    expect(stub.requests.filter((request) => licencePaths.includes(request.path))).toEqual([]);
    expect(stub.unknown).toEqual([]);
  });

  test('signs in through the browser callback and keeps the token out of the stored row', async () => {
    await page.getByTestId('settings-premium-sign-in').click();

    await expect.poll(() => stub.at(STUB_PATHS.signInRequest).length).toBe(1);
    await expect.poll(() => openedUrls(app)).toEqual([STUB_APPROVAL_URL]);
    const signInBody = stub.at(STUB_PATHS.signInRequest)[0].body;
    expect(signInBody.codeChallengeMethod).toBe('S256');

    const callback = new URL(signInBody.redirectUri);
    callback.search = new URLSearchParams({ code: stub.state.code, state: signInBody.state }).toString();
    const landed = await fetch(callback);
    expect(landed.status).toBe(200);

    await expect(page.getByTestId('settings-premium-sign-out')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('settings-premium-sign-in')).toHaveCount(0);

    const exchanges = stub.at(STUB_PATHS.token);
    expect(exchanges).toHaveLength(1);
    expect(exchanges[0].extra.verifierMatchesChallenge).toBe(true);
    expect(exchanges[0].body.redirectUri).toBe(signInBody.redirectUri);

    if (!encryptionAvailable) {
      test.info().annotations.push({ type: 'note', description: 'OS encryption unavailable: no stored row expected' });
      expect(sessionRow(userDataDir)).toBeNull();
      return;
    }
    const stored = sessionRow(userDataDir);
    expect(stored).not.toBeNull();
    for (const token of [stub.state.firstToken, stub.state.rotatedToken]) {
      expect(stored).not.toContain(token);
      expect(stored).not.toContain(Buffer.from(token).toString('base64'));
    }
  });

  test('reports the game account once with its two ids and the player name, and no game token', async () => {
    await expect(
      page.getByText(en('settingsPremiumReportLinked').replace('{id}', GAME_ACCOUNT_ID)),
    ).toBeVisible({ timeout: 20_000 });

    const reports = stub.at(STUB_PATHS.report);
    expect(reports).toHaveLength(1);
    expect(Object.keys(reports[0].body).sort()).toEqual(['account_id', 'player_name', 'steam_id64']);
    expect(reports[0].body).toEqual({
      account_id: GAME_ACCOUNT_ID,
      steam_id64: GAME_STEAM_ID,
      player_name: GAME_PLAYER_NAME,
    });
    for (const request of stub.requests) {
      expect(request.text).not.toContain(GAME_TOKEN);
      expect(request.bearer ?? '').not.toContain(GAME_TOKEN);
    }
  });

  test('rotates a due sign-in exactly once before the first bearer call and then uses the new token', async () => {
    const bearerCalls = stub.requests.filter((request) => request.bearer !== null);
    const rotations = bearerCalls.filter((request) => request.path === STUB_PATHS.rotate);

    expect(rotations).toHaveLength(1);
    expect(bearerCalls[0].path).toBe(STUB_PATHS.rotate);
    expect(bearerCalls[0].bearer).toBe(stub.state.firstToken);
    const afterRotation = bearerCalls.slice(1);
    expect(afterRotation.length).toBeGreaterThanOrEqual(3);
    expect(afterRotation.map((request) => request.bearer)).toEqual(
      afterRotation.map(() => stub.state.rotatedToken),
    );
    expect(afterRotation.map((request) => request.path)).toEqual(
      expect.arrayContaining([STUB_PATHS.status, STUB_PATHS.me, STUB_PATHS.report]),
    );
  });

  test('shows the Premium tab and the payment-problem banner once the API makes Premium visible and a refresh runs', async () => {
    await expect(premiumTab(page)).toHaveCount(0);
    stub.state.visible = true;
    stub.state.status = graceStatusBody();
    await app.evaluate(() => {
      const real = Date.now.bind(Date);
      Date.now = () => real() + 120_000;
    });

    const result = await page.evaluate(() => window.bfc.invoke('premium:refresh'));
    expect(result).toEqual({ ok: true });

    await expect(premiumTab(page)).toBeVisible({ timeout: 20_000 });
    await premiumTab(page).click();
    await expect(page.getByTestId('premium-view')).toBeVisible({ timeout: 20_000 });
    const banner = page.getByTestId('premium-banner-grace');
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await expect(banner).toContainText(en('premiumBannerGraceTitle'));
    await expect(banner).toContainText(en('premiumBannerGraceBody').split('{date}')[0]);
    await expect(page.getByTestId('premium-headline')).toHaveText(en('premiumActive'));
  });

  test('Manage Premium opens exactly the URL the API returned', async () => {
    await page.getByTestId('premium-manage').click();

    await expect.poll(() => openedUrls(app)).toEqual([STUB_APPROVAL_URL, STUB_HAND_OFF_URL]);
    const handOffs = stub.at(STUB_PATHS.handOff);
    expect(handOffs).toHaveLength(1);
    expect(handOffs[0].bearer).toBe(stub.state.rotatedToken);
  });

  test('signing out tells the API with the bearer, deletes the stored row, and stays signed out after a relaunch', async () => {
    await openSettings(page);
    await page.getByTestId('settings-premium-sign-out').click();

    await expect(page.getByTestId('settings-premium-sign-in')).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => stub.at(STUB_PATHS.signOut).length).toBe(1);
    expect(stub.at(STUB_PATHS.signOut)[0].bearer).toBe(stub.state.rotatedToken);
    expect(sessionRow(userDataDir)).toBeNull();

    openedAtSignOut = await openedUrls(app);
    const bearerCallsAtSignOut = stub.requests.filter((request) => request.bearer !== null).length;

    await app.close();
    ({ app, page } = await launchApp({ userDataDir, sessionFile, accountFile, origin: stub.origin }));
    await openSettings(page);

    await expect(page.getByTestId('settings-premium-sign-in')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('settings-premium-sign-out')).toHaveCount(0);
    expect(sessionRow(userDataDir)).toBeNull();
    expect(stub.requests.filter((request) => request.bearer !== null)).toHaveLength(bearerCallsAtSignOut);
  });

  test('contacted nothing but the stand-in API, and opened only the URLs it supplied', async () => {
    expect(stub.unknown).toEqual([]);
    expect(stub.requests.every((request) => request.host === new URL(stub.origin).host)).toBe(true);
    expect(openedAtSignOut).toEqual([STUB_APPROVAL_URL, STUB_HAND_OFF_URL]);
    expect(await openedUrls(app)).toEqual([]);
  });
});
