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
const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');

/**
 * Main-thread stall check: the event-loop delay in the main process, idle and then while the
 * fixture worker runs a 10,000-row query and a 5,000-row batch through the db capability. The
 * numbers are printed; nothing here takes a screenshot, so it runs with hidden windows.
 */
function en(key) {
  const source = fs.readFileSync(EN_COPY_PATH, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*(?:\\n\\s*)?(['"])((?:(?!\\1)[^\\\\]|\\\\.)*)\\1`));
  if (!match) throw new Error(`premium-tracking-stall.spec.mjs: could not find copy key "${key}" in ${EN_COPY_PATH}`);
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

test.describe.serial('The main thread under tracking load', () => {
  let stub;
  let tempDir;
  let app;
  let page;

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    await stub?.close();
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('the main-process event-loop delay stays within budget while the worker queries and writes', async () => {
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

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-premium-tracking-stall-'));
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

    await page.locator('nav[aria-label="Main"]').getByRole('button', { name: en('premiumNavLabel'), exact: true }).click();
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


    const db = async (args) => {
      const answer = await page.evaluate((a) => window.bfc.invoke('premium:uiCall', 'premium.worker', { op: 'db', args: a }), args);
      // The call reaches the worker, which answers `{ ok, value }` with the db capability's answer.
      expect(answer, JSON.stringify(args).slice(0, 80)).toMatchObject({ ok: true, value: { ok: true } });
      return answer.value.value;
    };
    const INSERT = 'INSERT INTO t VALUES ($1)';
    const rowsOf = (count, tag) => Array.from({ length: count }, (_, i) => [`${tag}-${i}`]);

    // Fill the table to exactly the result cap before measuring: 1 existing row + 5,000 + 4,999.
    await db({ op: 'batch', sql: INSERT, rows: rowsOf(5_000, 'seed-a') });
    await db({ op: 'batch', sql: INSERT, rows: rowsOf(4_999, 'seed-b') });
    const counted = await db({ op: 'query', sql: 'SELECT count(*) AS n FROM t' });
    expect(Number(Array.isArray(counted.rows[0]) ? counted.rows[0][0] : counted.rows[0].n)).toBe(10_000);

    // Start the main-process monitor; one histogram, read and reset per window.
    await app.evaluate(() => {
      const perf = process.getBuiltinModule('node:perf_hooks');
      const histogram = perf.monitorEventLoopDelay({ resolution: 10 });
      histogram.enable();
      globalThis.__stallHistogram = histogram;
    });
    const readWindow = () =>
      app.evaluate(() => {
        const h = globalThis.__stallHistogram;
        const ms = (ns) => Math.round((ns / 1e6) * 100) / 100;
        const out = { samples: h.count, p50: ms(h.percentile(50)), p99: ms(h.percentile(99)), max: ms(h.max) };
        h.reset();
        return out;
      });

    await readWindow();
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    const idle = await readWindow();

    const started = Date.now();
    const timings = [];
    for (let round = 0; round < 6; round += 1) {
      const t0 = Date.now();
      await db({ op: 'batch', sql: INSERT, rows: rowsOf(5_000, `load-${round}`) });
      const t1 = Date.now();
      const read = await db({ op: 'query', sql: 'SELECT v FROM t LIMIT 10000' });
      expect(read.rows).toHaveLength(10_000);
      timings.push({ batchMs: t1 - t0, queryMs: Date.now() - t1 });
    }
    const load = await readWindow();
    const loadMs = Date.now() - started;

    console.log(`STALL idle ${JSON.stringify(idle)}`);
    console.log(`STALL load ${JSON.stringify(load)} windowMs=${loadMs} rounds=${JSON.stringify(timings)}`);
    expect(load.samples).toBeGreaterThan(10);
    // Each figure is the timer interval as observed, so it includes the 10 ms resolution.
    expect(load.p99).toBeLessThanOrEqual(50);
    expect(stub.unknown).toEqual([]);
  });
});
