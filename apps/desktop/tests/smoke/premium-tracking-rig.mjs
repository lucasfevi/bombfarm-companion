import { expect, expectCleanExit, electron, quitApp } from './smoke-test.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUNDLE_MARKER,
  LINKED_PAIR,
  PLAYER_NAME,
  stageBattleLogFolder,
  trackingBundle,
  writeTrackingCapture,
} from '../fixtures/premium/tracking-fixtures.mjs';
import { STUB_PATHS, activeStatusBody, startPremiumApiStub } from './premium-api-stub.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');
const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');
const TRACKING_DIR = 'premium-tracking';

/** An English copy string, read off the source of truth so a reword moves the assertion with it. */
const FAILURE_LOG_LINES = 120;

export function en(key) {
  const source = fs.readFileSync(EN_COPY_PATH, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*(?:\\n\\s*)?(['"])((?:(?!\\1)[^\\\\]|\\\\.)*)\\1`));
  if (!match) throw new Error(`premium-tracking-rig.mjs: could not find copy key "${key}" in ${EN_COPY_PATH}`);
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

function writeAtomically(file, contents) {
  const staging = `${file}.next`;
  fs.writeFileSync(staging, contents);
  fs.renameSync(staging, file);
}

/**
 * The app the tracking checks run in: a stub API holding the signed tracking fixture bundle, a
 * replayed capture, a staged battle-log folder, and one temp user-data folder that survives the
 * relaunches. Everything is read through IPC, the DOM, files on disk and the main log; nothing here
 * takes a screenshot, so it runs with hidden windows.
 */
export async function createTrackingRig({ tmpPrefix = 'bfc-premium-tracking-' } = {}) {
  const stub = await startPremiumApiStub({
    licence: {
      userId: 'stub-user-0001',
      playing: { accountId: LINKED_PAIR.accountId, steamId64: LINKED_PAIR.steamId64 },
    },
  });
  stub.state.visible = true;
  stub.state.status = activeStatusBody();
  stub.publishBundle(trackingBundle());

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), tmpPrefix));
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
  const capture = writeTrackingCapture(path.join(tempDir, 'capture.bfcc'));
  const gameDir = stageBattleLogFolder(path.join(tempDir, 'game'));

  const rig = {
    stub,
    tempDir,
    userDataDir,
    gameDir,
    app: undefined,
    page: undefined,

    async launch() {
      rig.app = await electron.launch({
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
          BFC_REPLAY_CAPTURE: capture,
          // Empty: the replay serves no duel or collection body beside the one in the capture.
          BFC_REPLAY_PVP_FIXTURE: '',
          BFC_REPLAY_COLLECTIONS_FIXTURE: '',
          BFC_BATTLE_LOG_DIR_OVERRIDE: gameDir,
        },
      });
      await rig.app.evaluate(({ shell, Notification }) => {
        shell.openExternal = () => Promise.resolve();
        Notification.isSupported = () => false;
      });
      rig.page = await rig.app.firstWindow();
      await rig.page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
      return rig.page;
    },

    async quit() {
      if (!rig.app) return;
      const code = await quitApp(rig.app);
      rig.app = undefined;
      expectCleanExit(code);
    },

    async acceptConsent() {
      const modal = rig.page.getByTestId('consent-modal');
      await expect(modal).toBeVisible({ timeout: 30_000 });
      await rig.page.getByTestId('consent-accept').click();
      await expect(modal).toBeHidden({ timeout: 15_000 });
    },

    async signIn() {
      const { page } = rig;
      const requestsBefore = stub.at(STUB_PATHS.signInRequest).length;
      const signInButton = page.getByTestId('settings-premium-sign-in');
      if (!(await signInButton.isVisible())) await page.getByTestId('shell-settings').click();
      await signInButton.click();
      await expect.poll(() => stub.at(STUB_PATHS.signInRequest).length).toBe(requestsBefore + 1);
      const signInBody = stub.at(STUB_PATHS.signInRequest)[requestsBefore].body;
      const callback = new URL(signInBody.redirectUri);
      callback.search = new URLSearchParams({ code: stub.state.code, state: signInBody.state }).toString();
      expect((await fetch(callback)).status).toBe(200);
      await expect(page.getByTestId('settings-premium-sign-out')).toBeVisible({ timeout: 20_000 });
    },

    async signOut() {
      const { page } = rig;
      const signOutButton = page.getByTestId('settings-premium-sign-out');
      if (!(await signOutButton.isVisible())) await page.getByTestId('shell-settings').click();
      await signOutButton.click();
      await expect(page.getByTestId('settings-premium-sign-in')).toBeVisible({ timeout: 20_000 });
    },

    premiumView: () => rig.page.evaluate(() => window.bfc.invoke('premium:get')),
    hostView: async () => (await rig.premiumView()).host,
    uiCall: (capability, args) =>
      rig.page.evaluate(([name, value]) => window.bfc.invoke('premium:uiCall', name, value), [capability, args]),

    /** The fixture worker's own round trip: `premium.worker` with a `{ op }` message. */
    worker: async (message) => {
      const reply = await rig.uiCall('premium.worker', message);
      expect(reply, JSON.stringify(message).slice(0, 80)).toMatchObject({ ok: true });
      return reply.value;
    },

    /** A `db` call made by the worker; returns the worker's answer, `{ ok: true, value }` or its refusal. */
    db: async (args) => {
      const answer = await rig.worker({ op: 'db', args });
      return answer;
    },

    waitForRunning: (sequence = 1) =>
      expect
        .poll(async () => (await rig.hostView())?.uiUrl ?? null, { timeout: 90_000 })
        .toBe(`app://bundle/_premium/${sequence}/ui/index.js`),

    /** Presses Refresh until `read` returns a value `done` accepts: the renewal it triggers carries news. */
    async refreshUntil(read, done, timeout = 120_000) {
      await expect
        .poll(
          async () => {
            try {
              await rig.page.evaluate(() => window.bfc.invoke('premium:refresh'));
              return done(await read());
            } catch {
              return false; // The page was reloading.
            }
          },
          { timeout, intervals: [1_000, 2_000, 5_000] },
        )
        .toBe(true);
    },

    premiumTab: () =>
      rig.page.locator('nav[aria-label="Main"]').getByRole('button', { name: en('premiumNavLabel'), exact: true }),

    async showPanel() {
      await expect(rig.premiumTab()).toBeVisible({ timeout: 20_000 });
      await rig.premiumTab().click();
      const mount = rig.page.getByTestId('premium-host-mount');
      await expect(mount).toContainText(BUNDLE_MARKER, { timeout: 20_000 });
      return mount;
    },

    /** The tracking folder's files with their sizes and times; `[]` while the folder does not exist. */
    trackingFiles() {
      const dir = path.join(userDataDir, TRACKING_DIR);
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .sort()
        .map((name) => {
          const stat = fs.statSync(path.join(dir, name));
          return { name, size: stat.size, mtimeMs: stat.mtimeMs };
        });
    },

    premiumFolders() {
      const dir = path.join(userDataDir, 'premium');
      return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
    },

    mainLog: () => fs.readFileSync(path.join(userDataDir, 'logs', 'main.log'), 'utf8'),

    /** Prints what a failed check can't otherwise tell: CI keeps neither the app's log nor its state. */
    async reportFailure(title) {
      const view = await rig.premiumView().catch((error) => `unreadable: ${error.message}`);
      const { session, licence, host } = typeof view === 'string' ? { session: view } : view;
      let log = 'unreadable';
      try {
        log = rig.mainLog().split(/\r?\n/).slice(-FAILURE_LOG_LINES).join('\n');
      } catch {
        // The log is only there once the app has started.
      }
      console.log([`--- failed: ${title}`, JSON.stringify({ session, licence, host }), log, '---'].join('\n'));
    },

    async dispose() {
      try {
        await rig.quit();
      } finally {
        await stub.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    },
  };
  return rig;
}
