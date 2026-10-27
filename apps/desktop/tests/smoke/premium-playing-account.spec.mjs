import { test, expect, electron } from './smoke-test.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUB_PATHS, activeStatusBody, startPremiumApiStub } from './premium-api-stub.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');
const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');

const LINKED_PAIR = { accountId: '424242', steamId64: '76561198000000001', token: 'fixture-game-token-linked-0001' };
const OTHER_PAIR = { accountId: '515151', steamId64: '76561198000000002', token: 'fixture-game-token-other-0002' };
const PLAYER_NAME = 'Smoke Fixture Player';

/**
 * Premium runs only while the game account playing is the signed-in user's linked one.
 *
 * Signed in against a local stand-in for the API with Premium active, the spec swaps the game's
 * session file (and the account the fixture reader serves) from the linked account to another
 * one and back. In the main process, every outbound request and every message to a window is
 * appended to one ordered record, so the spec can show the state left `linked` before the report
 * for the new account went out. Copy is read from `en.ts`.
 *
 * Run hidden only (`pnpm test:smoke:hidden`); no screenshots.
 */
function en(key) {
  const source = fs.readFileSync(EN_COPY_PATH, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*(?:\\n\\s*)?(['"])((?:(?!\\1)[^\\\\]|\\\\.)*)\\1`));
  if (!match) throw new Error(`premium-playing-account.spec.mjs: could not find copy key "${key}" in ${EN_COPY_PATH}`);
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

function writeSession(file, pair) {
  writeAtomically(
    file,
    `[auth]\ntoken="${pair.token}"\naccount_id="${pair.accountId}"\nsteam_id64="${pair.steamId64}"\n`,
  );
}

function writeAccount(file, pair) {
  const fixture = JSON.parse(fs.readFileSync(ACCOUNT_FIXTURE, 'utf8'));
  fixture.account = { ...fixture.account, account_id: Number(pair.accountId), player_name: PLAYER_NAME };
  writeAtomically(file, JSON.stringify(fixture));
}

/** Points the app at the other pair: session file first, then the account the reader commits. */
function playAs(files, pair) {
  writeSession(files.session, pair);
  writeAccount(files.account, pair);
}

function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(full));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

const premiumTab = (page) =>
  page.locator('nav[aria-label="Main"]').getByRole('button', { name: en('premiumNavLabel'), exact: true });

const recorded = (app) => app.evaluate(() => globalThis.__bfcOrder ?? []);

test.describe.serial('Premium pauses when the game is played with another account', () => {
  let stub;
  let tempDir;
  let userDataDir;
  let files;
  let app;
  let page;

  test.beforeAll(async () => {
    stub = await startPremiumApiStub();
    stub.state.visible = true;
    stub.state.status = activeStatusBody();
    stub.state.reportReplies[OTHER_PAIR.steamId64] = { status: 409, body: { reason: 'steam_mismatch' } };

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-premium-account-'));
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
      },
    });
    await app.evaluate(({ shell }) => {
      shell.openExternal = () => Promise.resolve();
    });
    page = await app.firstWindow();
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });

    // One ordered record of what main sends out: requests (through `net.fetch`) and messages to
    // every window (through `webContents.send`).
    await app.evaluate(({ net, BrowserWindow }) => {
      globalThis.__bfcOrder = [];
      const realFetch = net.fetch.bind(net);
      net.fetch = (input, init) => {
        globalThis.__bfcOrder.push({ kind: 'fetch', url: String(input instanceof Request ? input.url : input) });
        return realFetch(input, init);
      };
      for (const win of BrowserWindow.getAllWindows()) {
        const contents = win.webContents;
        const realSend = contents.send.bind(contents);
        contents.send = (channel, ...args) => {
          globalThis.__bfcOrder.push({ kind: 'send', channel, payload: JSON.stringify(args) });
          return realSend(channel, ...args);
        };
      }
    });

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

  test('with the linked account playing, the gate is open and the tab shows no paused banner', async () => {
    await expect
      .poll(async () => (await page.evaluate(() => window.bfc.invoke('premium:get'))).playingAccount, { timeout: 20_000 })
      .toEqual({ state: 'linked', reason: null });

    await expect(premiumTab(page)).toBeVisible({ timeout: 20_000 });
    await premiumTab(page).click();
    await expect(page.getByTestId('premium-headline')).toHaveText(en('premiumActive'), { timeout: 20_000 });
    await expect(page.locator('[data-testid^="premium-banner-paused-"]')).toHaveCount(0);
    expect(stub.at(STUB_PATHS.report).map((request) => request.body.steam_id64)).toEqual([LINKED_PAIR.steamId64]);

    const order = await recorded(app);
    expect(order.some((entry) => entry.kind === 'fetch' && entry.url.endsWith(STUB_PATHS.status))).toBe(true);
    expect(order.some((entry) => entry.kind === 'send' && entry.channel.endsWith('premium:changed'))).toBe(true);
  });

  test('switching to another account closes the gate before the report for it goes out', async () => {
    const from = (await recorded(app)).length;

    playAs(files, OTHER_PAIR);

    await expect.poll(() => stub.at(STUB_PATHS.report).length, { timeout: 20_000 }).toBe(2);
    expect(stub.at(STUB_PATHS.report)[1].body).toMatchObject({
      account_id: OTHER_PAIR.accountId,
      steam_id64: OTHER_PAIR.steamId64,
    });

    const order = (await recorded(app)).slice(from);
    const dropped = order.findIndex(
      (entry) =>
        entry.kind === 'send' &&
        entry.channel.endsWith('premium:changed') &&
        JSON.parse(entry.payload)[0].playingAccount.state !== 'linked',
    );
    const reported = order.findIndex((entry) => entry.kind === 'fetch' && entry.url.endsWith(STUB_PATHS.report));
    expect(dropped).toBeGreaterThanOrEqual(0);
    expect(reported).toBeGreaterThan(dropped);
    expect(JSON.parse(order[dropped].payload)[0].playingAccount).toEqual({ state: 'unknown', reason: 'checking' });
    const firstStubRequest = order.findIndex((entry) => entry.kind === 'fetch' && entry.url.startsWith(stub.origin));
    expect(firstStubRequest).toBeGreaterThan(dropped);

    const banner = page.getByTestId('premium-banner-paused-other_account');
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await expect(banner).toContainText(en('premiumPausedOtherAccount'));
    expect((await page.evaluate(() => window.bfc.invoke('premium:get'))).playingAccount).toEqual({
      state: 'other',
      reason: 'other_account',
    });
  });

  test('switching back to the linked account reopens the gate at once, with no request', async () => {
    const from = (await recorded(app)).length;

    playAs(files, LINKED_PAIR);

    await expect(page.getByTestId('premium-banner-paused-other_account')).toHaveCount(0, { timeout: 20_000 });
    expect((await page.evaluate(() => window.bfc.invoke('premium:get'))).playingAccount).toEqual({
      state: 'linked',
      reason: null,
    });
    expect(stub.at(STUB_PATHS.report)).toHaveLength(2);
    const order = (await recorded(app)).slice(from);
    expect(order.filter((entry) => entry.kind === 'fetch' && entry.url.endsWith(STUB_PATHS.report))).toEqual([]);
    const changes = order
      .filter((entry) => entry.kind === 'send' && entry.channel.endsWith('premium:changed'))
      .map((entry) => JSON.parse(entry.payload)[0].playingAccount);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every((state) => state.state === 'linked' && state.reason === null)).toBe(true);
  });

  test('no SteamID reaches a message to a window, the Premium view, the page or a log file', async () => {
    const steamIds = [LINKED_PAIR.steamId64, OTHER_PAIR.steamId64];

    const sends = (await recorded(app)).filter((entry) => entry.kind === 'send');
    expect(sends.length).toBeGreaterThan(0);
    const sent = JSON.stringify(sends);
    const view = JSON.stringify(await page.evaluate(() => window.bfc.invoke('premium:get')));
    const html = await page.evaluate(() => document.documentElement.outerHTML);

    const logDirs = [
      ...new Set([await app.evaluate(({ app: electronApp }) => electronApp.getPath('logs')), path.join(userDataDir, 'logs')]),
    ];
    const logs = logDirs
      .flatMap((dir) => filesUnder(dir))
      .filter((file) => file.endsWith('.log'))
      .map((file) => fs.readFileSync(file, 'utf8'));
    expect(logs.join('\n')).toContain('account_state');

    for (const steamId of steamIds) {
      expect(sent, `a window message holds ${steamId}`).not.toContain(steamId);
      expect(view, `the Premium view holds ${steamId}`).not.toContain(steamId);
      expect(html, `the page holds ${steamId}`).not.toContain(steamId);
      for (const log of logs) expect(log, `a log file holds ${steamId}`).not.toContain(steamId);
    }
    for (const steamId of steamIds) {
      expect(stub.requests.some((request) => request.text.includes(steamId))).toBe(true);
    }
  });
});
