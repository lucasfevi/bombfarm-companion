import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');
const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');
const PT_BR_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'pt-BR.ts');

/** The committed capture is 60 records at one record per 100 ms: a pass is six seconds, so the
 *  window below spans several wraps of it. */
const REPLAY_PASS_SECONDS = 6;
const OBSERVE_PASSES = 4;
const SAMPLE_INTERVAL_MS = 40;

function readCopyValue(filePath, key) {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) throw new Error(`could not find copy key "${key}" in ${filePath}`);
  return match[1];
}

const en = (key) => readCopyValue(EN_COPY_PATH, key);
const pt = (key) => readCopyValue(PT_BR_COPY_PATH, key);

/** The panels whose boxes must not move, and the Damage panel's own parts. */
const BOX_TEST_IDS = [
  'live-earnings',
  'live-map',
  'live-heroes',
  'live-damage',
  'live-damage-team',
  'live-damage-scroller',
  'live-damage-unattributed',
];

/** The heroes panel is as tall as its list, and the list fills in as the roster arrives, so only
 *  where it starts and how wide it is can be held to account for the Damage panel above it. */
const HEIGHT_FREE_TEST_IDS = new Set(['live-heroes']);

function navButton(page, index) {
  return page.locator('nav[aria-label="Main"] button').nth(index);
}

/**
 * Launches against the replayed fixture account with the consent dialog still up, so the caller
 * can start measuring before the first frame is allowed in. `capture` points the replay at another
 * file; a path that does not exist leaves the stream attached to nothing, which is the state
 * before any damage has ever arrived.
 */
async function launchWithConsentPending(tmpPrefix, capture) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), tmpPrefix));
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
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_FULL_FIXTURE,
      BFC_LIVE_SOURCE: 'replay',
      ...(capture === undefined ? {} : { BFC_REPLAY_CAPTURE: capture }),
      BFC_USER_DATA_DIR: userDataDir,
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      ELECTRON_ENABLE_LOGGING: '1',
    },
  });

  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  const consentModal = page.getByTestId('consent-modal');
  await expect(consentModal).toBeVisible({ timeout: 30_000 });

  const acceptConsent = async () => {
    await page.getByTestId('consent-accept').click();
    await expect(consentModal).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId('live-damage')).toBeVisible({ timeout: 30_000 });
  };

  return { app, page, userDataDir, acceptConsent };
}

async function closeApp(app, userDataDir) {
  await app.close().catch(() => undefined);
  fs.rmSync(userDataDir, { recursive: true, force: true });
}

/** Samples the boxes and the panel's own state in the page itself, on a timer, because a hidden
 *  window runs no animation frames and a measurement taken from here would only see the moments
 *  Playwright happened to ask. */
function startRecording(page) {
  return page.evaluate(
    ({ boxIds, intervalMs }) => {
      const box = (id) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (el === null) return null;
        const rect = el.getBoundingClientRect();
        return [rect.left, rect.top, rect.width, rect.height].map((value) => Math.round(value * 100) / 100);
      };
      window.__damageSamples = [];
      window.__damageRecorder = setInterval(() => {
        const rows = document.querySelectorAll('tr[data-testid^="live-damage-row-"]').length;
        const session = document.querySelector('[data-testid="live-damage-team-dps-session"]');
        const unattributed = document.querySelector('[data-testid="live-damage-unattributed"]');
        window.__damageSamples.push({
          boxes: Object.fromEntries(boxIds.map((id) => [id, box(id)])),
          rows,
          session: session === null ? null : session.textContent,
          unattributed: unattributed === null ? null : unattributed.textContent,
        });
      }, intervalMs);
    },
    { boxIds: BOX_TEST_IDS, intervalMs: SAMPLE_INTERVAL_MS },
  );
}

async function stopRecording(page) {
  return page.evaluate(() => {
    clearInterval(window.__damageRecorder);
    return window.__damageSamples;
  });
}

/** Sizes, plus where each box sits relative to the earnings panel — the one thing a banner above
 *  the screen (a gap line, say) cannot change, so launches in different stream states compare. */
function shapeOf(boxes) {
  const origin = boxes['live-earnings'];
  return Object.fromEntries(
    Object.entries(boxes).map(([id, box]) => [
      id,
      box === null || origin === null
        ? null
        : {
            width: box[2],
            ...(HEIGHT_FREE_TEST_IDS.has(id) ? {} : { height: box[3] }),
            left: box[0] - origin[0],
            top: box[1] - origin[1],
          },
    ]),
  );
}

async function measureShape(page) {
  const boxes = await page.evaluate((ids) => {
    return Object.fromEntries(
      ids.map((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (el === null) return [id, null];
        const rect = el.getBoundingClientRect();
        return [id, [rect.left, rect.top, rect.width, rect.height].map((value) => Math.round(value * 100) / 100)];
      }),
    );
  }, BOX_TEST_IDS);
  return shapeOf(boxes);
}

test.describe('live damage panel: no layout shift smoke', () => {
  test('renders under replay with its title, and nothing outside it moves across first paint, first damage, rows appearing and replay wraps', async () => {
    test.setTimeout(180_000);
    const { app, page, userDataDir, acceptConsent } = await launchWithConsentPending('bfc-damage-layout-');

    try {
      await startRecording(page);
      await acceptConsent();
      await expect(page.getByTestId('live-damage').locator('h2')).toHaveText(en('liveDamageTitle'));

      await page.waitForTimeout(REPLAY_PASS_SECONDS * OBSERVE_PASSES * 1000);
      const samples = await stopRecording(page);

      const withPanel = samples.filter((sample) => sample.boxes['live-damage'] !== null);
      expect(withPanel.length, 'the recorder saw the panel for most of the window').toBeGreaterThan(
        (REPLAY_PASS_SECONDS * OBSERVE_PASSES * 1000) / SAMPLE_INTERVAL_MS / 2,
      );

      const sawDamage = withPanel.filter((sample) => sample.session !== null && sample.session !== '—');
      expect(sawDamage.length, 'Team DPS printed a figure once frames arrived').toBeGreaterThan(0);

      const moved = [];
      for (const id of BOX_TEST_IDS) {
        const distinct = new Set(
          withPanel.map((sample) => JSON.stringify(HEIGHT_FREE_TEST_IDS.has(id) ? sample.boxes[id]?.slice(0, 3) : sample.boxes[id])),
        );
        if (distinct.size > 1) moved.push({ id, boxes: [...distinct] });
      }
      expect(moved, `boxes that changed between samples:\n${JSON.stringify(moved, null, 2)}`).toEqual([]);

      expect(Math.max(...withPanel.map((sample) => sample.rows)), 'hero rows appeared in the table').toBeGreaterThan(0);
    } finally {
      await closeApp(app, userDataDir);
    }
  });

  test('the panel and its siblings have the same shape before any damage has arrived as while it is flowing', async () => {
    test.setTimeout(180_000);
    const idle = await launchWithConsentPending('bfc-damage-idle-', path.join(os.tmpdir(), 'bfc-no-such-capture.bfcc'));
    let idleShape;
    try {
      await idle.acceptConsent();
      await expect(idle.page.getByTestId('live-damage-team-dps-session')).toHaveText('—');
      idleShape = await measureShape(idle.page);
    } finally {
      await closeApp(idle.app, idle.userDataDir);
    }

    const flowing = await launchWithConsentPending('bfc-damage-flowing-');
    try {
      await flowing.acceptConsent();
      await expect(flowing.page.getByTestId('live-damage-team-dps-session')).not.toHaveText('—', { timeout: 30_000 });
      await flowing.page.waitForTimeout(REPLAY_PASS_SECONDS * 1000);
      const flowingShape = await measureShape(flowing.page);

      for (const id of BOX_TEST_IDS) {
        expect(idleShape[id], `${id} exists with no damage`).not.toBeNull();
        expect(flowingShape[id], `${id} changed shape once damage arrived`).toEqual(idleShape[id]);
      }
    } finally {
      await closeApp(flowing.app, flowing.userDataDir);
    }
  });

  test('the Unattributed row keeps the table columns once it has figures, and the table never scrolls sideways', async () => {
    test.setTimeout(180_000);
    const { app, page, userDataDir, acceptConsent } = await launchWithConsentPending('bfc-damage-columns-');

    try {
      await acceptConsent();
      await expect(page.getByTestId('live-damage-unattributed').locator('td').nth(0)).toHaveText(en('liveDamageUnattributedLabel'), {
        timeout: 30_000,
      });

      const lefts = await page.evaluate(() => {
        const edges = (selector) => [...document.querySelectorAll(selector)].map((el) => Math.round(el.getBoundingClientRect().left * 10) / 10);
        const scroller = document.querySelector('[data-testid="live-damage-scroller"]');
        return {
          head: edges('[data-testid="live-damage-scroller"] thead th'),
          unattributed: edges('[data-testid="live-damage-unattributed"] td'),
          scrollWidth: scroller.scrollWidth,
          clientWidth: scroller.clientWidth,
        };
      });

      expect(lefts.head).toHaveLength(4);
      expect(lefts.unattributed).toEqual(lefts.head);
      expect(lefts.scrollWidth).toBeLessThanOrEqual(lefts.clientWidth);
    } finally {
      await closeApp(app, userDataDir);
    }
  });

  test('titles the panel in Portuguese once the language is switched', async () => {
    test.setTimeout(180_000);
    const { app, page, userDataDir, acceptConsent } = await launchWithConsentPending('bfc-damage-pt-');

    try {
      await acceptConsent();
      await navButton(page, 10).click();
      const select = page.getByRole('combobox', { name: en('settingsLanguageLabel') });
      await select.waitFor({ state: 'visible', timeout: 10_000 });
      await select.click();
      await page.getByRole('option', { name: en('settingsLanguageOptionPortuguese') }).click();
      await navButton(page, 0).click();

      await expect(page.getByTestId('live-damage').locator('h2')).toHaveText(pt('liveDamageTitle'), { timeout: 15_000 });
    } finally {
      await closeApp(app, userDataDir);
    }
  });
});
