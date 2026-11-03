import { test, expect } from './smoke-test.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { LINKED_PAIR, OTHER_ACCOUNT_ID, OTHER_SECTION_MARKER, PLAYER_NAME, TOKEN_MARKER } from '../fixtures/premium/tracking-fixtures.mjs';
import { STUB_PATHS } from './premium-api-stub.mjs';
import { createTrackingRig, en } from './premium-tracking-rig.mjs';

const SHORT_LEASE_SECONDS = 20;
const LONG_LEASE_SECONDS = 3600;
const LONG_TEST_MS = 240_000;
const FIRST_SUBJECT = 'stub-user-0001';
const SECOND_SUBJECT = 'stub-user-0002';

/** Every key and string value anywhere inside `value`, so a planted token is found wherever it hides. */
function walk(value, keys = [], strings = []) {
  if (typeof value === 'string') strings.push(value);
  else if (Array.isArray(value)) for (const item of value) walk(item, keys, strings);
  else if (value !== null && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      keys.push(key);
      walk(inner, keys, strings);
    }
  }
  return { keys, strings };
}

const rowsOf = (answer) => answer.value.rows.map((row) => (Array.isArray(row) ? row[0] : Object.values(row)[0]));

/**
 * The tracking host, end to end, with the tracking fixture bundle: the eight checks, the worker round
 * trip and the transaction rollback. It asserts through IPC, DOM reads, files on disk and the main
 * log, never a screenshot, so it runs with hidden windows (`pnpm test:smoke:hidden`).
 */
test.describe.serial('The tracking host, end to end', () => {
  let rig;
  let firstFile;

  test.beforeAll(async () => {
    rig = await createTrackingRig();
  });

  test.afterAll(async () => {
    await rig?.dispose();
  });

  const mountedPanel = async () => {
    await rig.showPanel();
    return rig.page.getByTestId('premium-host-mount');
  };

  test('boot: the panel reaches running, the worker answers, and one table holds its first row', async () => {
    test.setTimeout(LONG_TEST_MS);
    await rig.launch();
    await rig.acceptConsent();
    await rig.signIn();
    await rig.waitForRunning(1);
    expect((await rig.hostView()).slots).toEqual(['premium.tab', 'live.section']);

    const mount = await mountedPanel();
    await expect(mount.getByTestId('tracking-slot')).toHaveText('slot: premium.tab');
    await expect(mount.getByTestId('tracking-worker')).toHaveText('worker: ok ping-premium.tab', { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-db')).toHaveText('db: ready 1', { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-row')).toHaveText('row: first-run', { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-starts')).toHaveText('starts: 1');
    await expect(mount.getByTestId('tracking-subscribed')).toHaveText('subscribed: tap=true battleLog=true', { timeout: 30_000 });
    await expect.poll(() => rig.mainLog().match(/tracking\.ready/g)?.length ?? 0, { timeout: 15_000 }).toBe(1);

    // One file for the one subject, a real database on disk.
    const files = rig.trackingFiles();
    expect(files.filter((file) => file.name.endsWith('.duckdb'))).toHaveLength(1);
    firstFile = files.find((file) => file.name.endsWith('.duckdb'));
    expect(firstFile.size).toBeGreaterThan(0);
    expect(rig.stub.unknown).toEqual([]);
  });

  test('the premium.worker round trip: the panel asks the worker and gets its answer back', async () => {
    const echoed = await rig.worker({ op: 'echo', value: 'round-trip-0001' });
    expect(echoed).toEqual({ ok: true, echo: 'round-trip-0001', sequence: 1 });
    // The worker's own state, as the host handed it over: it started once, with the capabilities it asked for.
    const recorded = await rig.worker({ op: 'state' });
    expect(recorded.state).toMatchObject({ starts: 1, sequence: 1, cleared: 0, paused: 0 });
    expect(recorded.state.granted).toEqual(
      expect.arrayContaining(['premium.status', 'store', 'db', 'raw.tap', 'raw.battleLog', 'premium.worker']),
    );
  });

  test('the db tx step that fails takes the step before it back out, and a good one commits both', async () => {
    const rolledBack = await rig.db({
      op: 'tx',
      steps: [
        { sql: 'INSERT INTO t VALUES ($1)', params: ['tx-rolled-back'] },
        { sql: 'INSERT INTO t VALUES (CAST(CAST($1 AS INTEGER) AS VARCHAR))', params: ['not-a-number'] },
      ],
    });
    expect(rolledBack, JSON.stringify(rolledBack)).toMatchObject({ ok: false, code: 'failed', reason: 'conversion' });
    const afterRollback = await rig.db({ op: 'query', sql: "SELECT v FROM t WHERE v = 'tx-rolled-back'" });
    expect(afterRollback.ok).toBe(true);
    expect(rowsOf(afterRollback), 'the first step of the failed transaction is absent').toEqual([]);

    // The same two steps with a valid second one commit, so the absence above is the rollback and not a broken insert.
    const committed = await rig.db({
      op: 'tx',
      steps: [
        { sql: 'INSERT INTO t VALUES ($1)', params: ['subject-one-only'] },
        { sql: 'INSERT INTO t VALUES ($1)', params: ['tx-committed'] },
      ],
    });
    expect(committed).toMatchObject({ ok: true, value: { changes: [1, 1] } });
    const all = await rig.db({ op: 'query', sql: 'SELECT v FROM t ORDER BY v' });
    expect(rowsOf(all)).toEqual(['first-run', 'subject-one-only', 'tx-committed']);
  });

  test('check two: a denylisted statement and a read of a marker file are refused, and the marker is untouched', async () => {
    const marker = path.join(rig.tempDir, 'marker.csv');
    fs.writeFileSync(marker, 'v\nmarker-before\n');
    const before = fs.statSync(marker);
    const sqlPath = marker.replaceAll('\\', '/');

    const refused = [
      await rig.db({ op: 'exec', sql: `ATTACH '${sqlPath}' AS stolen` }),
      await rig.db({ op: 'query', sql: `SELECT * FROM read_csv('${sqlPath}')` }),
      await rig.db({ op: 'exec', sql: `COPY t TO '${sqlPath}'` }),
      await rig.db({ op: 'exec', sql: 'PRAGMA database_list' }),
    ];
    for (const answer of refused) expect(answer, JSON.stringify(answer)).toMatchObject({ ok: false, code: 'bad_args' });

    const after = fs.statSync(marker);
    expect(after.mtimeMs).toBe(before.mtimeMs);
    expect(after.size).toBe(before.size);
    expect(fs.readFileSync(marker, 'utf8')).toBe('v\nmarker-before\n');
    // Nothing the refusals could have started changed the table.
    const all = await rig.db({ op: 'query', sql: 'SELECT count(*) AS n FROM t' });
    expect(Number(all.value.rows[0][0] ?? all.value.rows[0].n)).toBe(3);
  });

  test('check five: the tap items carry no token anywhere, and the token key is gone', async () => {
    const recorded = await rig.worker({ op: 'state' });
    expect(recorded.tap.length, 'the replayed frame and body reached the worker').toBeGreaterThan(0);
    const { keys, strings } = walk(recorded.tap);
    expect(JSON.stringify(recorded.tap)).not.toContain(TOKEN_MARKER);
    expect(strings.some((value) => value.includes('SMOKE_TOKEN_MARKER'))).toBe(false);
    expect(keys, 'the credential key was dropped').not.toContain('token');
    // The rest of the capture arrived, so the absence above is the redaction and not an empty tap.
    expect(new Set(recorded.tap.map((item) => item.kind))).toEqual(new Set(['frame', 'body']));
    expect(JSON.stringify(recorded.tap)).toContain(PLAYER_NAME);
    expect(keys, 'the string that carried the token inside its text is gone with it').not.toContain('note');
  });

  test('check six: only the playing account\'s battle-log section arrives, first with baseline true', async () => {
    const recorded = await rig.worker({ op: 'state' });
    expect(recorded.battle.length).toBeGreaterThan(0);
    for (const item of recorded.battle) {
      expect(item.section).toBe(`acc_${LINKED_PAIR.accountId}`);
      expect(item.accountKey).toBe(LINKED_PAIR.accountId);
    }
    expect(recorded.battle[0]).toMatchObject({ baseline: true, gameLanguage: 'en' });
    const wire = JSON.stringify(recorded.battle);
    expect(wire).not.toContain(OTHER_SECTION_MARKER);
    expect(wire).not.toContain(`acc_${OTHER_ACCOUNT_ID}`);
  });

  test('check one: the row reads back after a relaunch', async () => {
    test.setTimeout(LONG_TEST_MS);
    const before = rig.trackingFiles().find((file) => file.name === firstFile.name);
    expect(before, 'the tracking file is on disk before the restart').toBeDefined();

    await rig.quit();
    await rig.launch();
    await rig.waitForRunning(1);
    const mount = await mountedPanel();
    await expect(mount.getByTestId('tracking-starts')).toHaveText('starts: 2', { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-db')).toHaveText('db: ready 3', { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-row')).toHaveText('row: first-run', { timeout: 30_000 });
    const all = await rig.db({ op: 'query', sql: 'SELECT v FROM t ORDER BY v' });
    expect(rowsOf(all)).toEqual(['first-run', 'subject-one-only', 'tx-committed']);
    await expect.poll(() => rig.mainLog().match(/tracking\.ready/g)?.length ?? 0, { timeout: 15_000 }).toBe(2);
    expect(rig.trackingFiles().filter((file) => file.name.endsWith('.duckdb'))).toHaveLength(1);
  });

  test('check seven: the Live tab shows the section in its own slot, and a forced pause unmounts it', async () => {
    test.setTimeout(LONG_TEST_MS);
    const { page } = rig;
    const live = page.locator('nav[aria-label="Main"]').getByRole('button').first();
    await live.click();
    const section = page.getByTestId('premium-live-section');
    await expect(section).toBeVisible({ timeout: 60_000 });
    await expect(section.getByTestId('tracking-slot')).toHaveText('slot: live.section', { timeout: 30_000 });
    await expect(section.getByTestId('tracking-worker')).toHaveText('worker: ok ping-live.section', { timeout: 30_000 });
    // The Premium tab's own mount is not on screen: this panel is the one the Live tab gave its slot to.
    await expect(page.getByTestId('premium-host-mount')).toHaveCount(0);

    // A forced pause (a short Lease, then renewals that fail) takes the section away and reserves no space.
    rig.stub.state.leaseSeconds = SHORT_LEASE_SECONDS;
    const renewalsBefore = rig.stub.at(STUB_PATHS.lease).length;
    await rig.refreshUntil(
      () => rig.stub.at(STUB_PATHS.lease).length,
      (count) => count > renewalsBefore,
    );
    rig.stub.state.renewalStatus = 503;
    await expect
      .poll(async () => (await rig.hostView())?.paused ?? null, { timeout: 60_000, intervals: [1_000] })
      .toEqual({ reason: 'unconfirmed' });
    await expect(page.getByTestId('premium-live-section')).toHaveCount(0);
    await expect(page.getByTestId('live-view')).toBeVisible();

    rig.stub.state.renewalStatus = null;
    rig.stub.state.leaseSeconds = LONG_LEASE_SECONDS;
    await rig.refreshUntil(rig.hostView, (host) => host?.phase === 'running' && !host.paused);
    await expect(page.getByTestId('premium-live-section').getByTestId('tracking-slot')).toHaveText('slot: live.section', { timeout: 30_000 });
    // The worker heard both edges.
    const recorded = await rig.worker({ op: 'state' });
    expect(recorded.state).toMatchObject({ paused: 1, resumed: 1 });
  });

  test('check three: when the licence ends the code goes and the tracking file stays; when it holds again the row reads back', async () => {
    test.setTimeout(LONG_TEST_MS);
    const before = rig.trackingFiles().find((file) => file.name === firstFile.name);
    expect(before).toBeDefined();

    rig.stub.state.leaseState = 'ended';
    const cleanupsBefore = rig.stub.at(STUB_PATHS.licenceCleanup).length;
    await rig.refreshUntil(
      () => rig.stub.at(STUB_PATHS.licenceCleanup).length,
      (count) => count === cleanupsBefore + 1,
    );
    await expect.poll(async () => (await rig.hostView())?.phase, { timeout: 30_000 }).toBe('none');
    expect(rig.premiumFolders(), 'the bundle code and its store are gone').toEqual([]);
    const kept = rig.trackingFiles().find((file) => file.name === firstFile.name);
    expect(kept, 'the tracking file is still on disk').toBeDefined();
    expect(kept.size).toBeGreaterThan(0);

    rig.stub.state.leaseState = 'active';
    await rig.quit();
    await rig.launch();
    await rig.waitForRunning(1);
    const mount = await mountedPanel();
    // The store went with the code, so the start count is back at one; the row survived in its own file.
    await expect(mount.getByTestId('tracking-starts')).toHaveText('starts: 1', { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-row')).toHaveText('row: first-run', { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-db')).toHaveText('db: ready 3', { timeout: 30_000 });
  });

  test('check four: a second subject sees none of the first one\'s rows, the first file stays, and the first subject gets its row back', async () => {
    test.setTimeout(LONG_TEST_MS);
    const first = rig.trackingFiles().find((file) => file.name === firstFile.name);
    expect(first).toBeDefined();

    await rig.signOut();
    rig.stub.state.userId = SECOND_SUBJECT;
    await rig.signIn();
    await rig.waitForRunning(1);
    const mount = await mountedPanel();
    await expect(mount.getByTestId('tracking-worker')).toHaveText('worker: ok ping-premium.tab', { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-db')).toHaveText('db: ready 1', { timeout: 30_000 });
    const secondRows = await rig.db({ op: 'query', sql: 'SELECT v FROM t ORDER BY v' });
    expect(rowsOf(secondRows), 'the first subject\'s rows are not readable').toEqual(['first-run']);

    const duringSecond = rig.trackingFiles().filter((file) => file.name.endsWith('.duckdb'));
    expect(duringSecond, 'a file for each subject').toHaveLength(2);
    expect(duringSecond.find((file) => file.name === firstFile.name), 'the first file is still on disk').toBeDefined();

    await rig.signOut();
    rig.stub.state.userId = FIRST_SUBJECT;
    await rig.signIn();
    await rig.waitForRunning(1);
    const back = await mountedPanel();
    await expect(back.getByTestId('tracking-db')).toHaveText('db: ready 3', { timeout: 30_000 });
    await expect(back.getByTestId('tracking-row')).toHaveText('row: first-run', { timeout: 30_000 });
    const firstRows = await rig.db({ op: 'query', sql: 'SELECT v FROM t ORDER BY v' });
    expect(rowsOf(firstRows)).toEqual(['first-run', 'subject-one-only', 'tx-committed']);
    expect(rig.stub.unknown).toEqual([]);
  });

  test('check eight: Settings clear deletes the file and the key, the row reads none, and the worker hears one db.cleared', async () => {
    test.setTimeout(LONG_TEST_MS);
    const { page } = rig;
    const second = rig.trackingFiles().find((file) => file.name !== firstFile.name && file.name.endsWith('.duckdb'));
    expect(second, 'the other subject\'s file exists before the clear').toBeDefined();
    expect(rig.mainLog().match(/db\.cleared/g) ?? []).toHaveLength(0);

    // Settings has no bundle mounted, so nothing reopens the file between the clear and the checks.
    await page.getByTestId('shell-settings').click();
    const clear = page.getByTestId('settings-premium-tracking-clear');
    await expect(clear).toBeVisible({ timeout: 20_000 });
    await clear.click();
    await page.getByRole('dialog').getByRole('button', { name: en('premiumTrackingConfirmAction'), exact: true }).click();
    // The store answers `cleared` only once the file, its log and the key row are all deleted.
    await expect(page.getByText(en('premiumTrackingCleared'))).toBeVisible({ timeout: 30_000 });

    expect(rig.trackingFiles().find((file) => file.name === firstFile.name), 'the file is gone').toBeUndefined();
    expect(rig.trackingFiles().find((file) => file.name.startsWith(firstFile.name)), 'no log of it is left').toBeUndefined();
    expect(rig.trackingFiles().find((file) => file.name === second.name), 'the other subject\'s file is untouched').toBeDefined();
    expect(await page.evaluate(() => window.bfc.invoke('premium:trackingHistory'))).toEqual({ state: 'none' });

    const recorded = await rig.worker({ op: 'state' });
    expect(recorded.state.cleared).toBe(1);
    await expect.poll(() => rig.mainLog().match(/db\.cleared/g)?.length ?? 0, { timeout: 15_000 }).toBe(1);

    // The next call opens an empty file with a new key: the table is gone and the row reads none.
    const mount = await mountedPanel();
    await expect(mount.getByTestId('tracking-row')).toHaveText('row: none', { timeout: 30_000 });
    await expect(mount.getByTestId('tracking-row-detail')).toHaveText('rowdetail: no_table');
    await expect(mount.getByTestId('tracking-cleared')).toHaveText('cleared: 1');
  });
});
