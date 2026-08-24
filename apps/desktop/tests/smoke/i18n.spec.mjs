import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');

/**
 * MP3 F4 (`AD-057`) — the language end to end on a real Electron app, in one run: OS-detected
 * default, live switch, persisted choice, zero recompute, and the only real pixel measurement
 * available in this repo. Launcher shape reused verbatim from `planning-advice.spec.mjs` (its
 * `BFC_TOKEN_PATH_OVERRIDE`, its `BFC_GAME_PROCESS` pin, its `acceptConsent()` helper and the
 * reasoning below — read, not edited) and `account-restart.spec.mjs`'s `mkdtempSync` +
 * `BFC_USER_DATA_DIR` relaunch pattern.
 *
 * **FIRST-ITEM PROBE, stated up front (`AD-057`'s own risk, tasks.md T7's first bullet):** this
 * spec's MIN-06 assertions ARE the probe for whether Chromium's `--lang` switch actually moves
 * `app.getLocale()` on the runner. Design could not verify this without executing Electron, and
 * the implementer running this task could not either (Electron may not be launched locally — the
 * repo's own hard constraint). If this spec's `--lang=pt-BR` launch fails specifically on the
 * "renders in PT-BR" / `documentElement.lang === 'pt-BR'` assertions below, that IS the answer:
 * `--lang` proved inert on this runner. The correct response is NOT a `BFC_OS_LOCALE` production
 * env var — it is to rely on `resolveStartupLocale`'s exhaustive unit table
 * (`packages/contracts/src/locale.test.ts`, already exhaustive) and record the smoke limitation
 * in `validation.md`. Do not "fix" this spec by loosening its own assertions.
 *
 * Every Portuguese string asserted below is read from `STRINGS['pt-BR'][key]` — via a small,
 * source-scoped regex extraction (`readCopyValue`, this file's own — a `.mjs` smoke cannot import
 * a `.ts` module without a build step) — never hardcoded, so a reword moves both sides at once
 * while a missing translation still fails.
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

const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');
const PT_BR_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'pt-BR.ts');
const copyFileCache = new Map();

function readCopyValue(filePath, key) {
  let source = copyFileCache.get(filePath);
  if (source === undefined) {
    source = fs.readFileSync(filePath, 'utf8');
    copyFileCache.set(filePath, source);
  }
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) {
    throw new Error(`i18n.spec.mjs: could not find copy key "${key}" in ${filePath}`);
  }
  return match[1];
}

const en = (key) => readCopyValue(EN_COPY_PATH, key);
const pt = (key) => readCopyValue(PT_BR_COPY_PATH, key);

async function launchApp(env, extraArgs = []) {
  const app = await electron.launch({
    executablePath: electronExecutable(),
    args: [desktopRoot, ...extraArgs],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      ELECTRON_ENABLE_LOGGING: '1',
      // Never let a real BombFarm process on the runner machine make "game running" true for
      // reasons unrelated to this feature (planning-advice.spec.mjs's own reasoning).
      BFC_GAME_PROCESS: 'bfc-smoke-no-such-process.exe',
      // SAFETY (T-fix-4, reproduced from planning-advice.spec.mjs because this spec launches
      // independently): redirects session-token-file.ts's sessionCfgPath() away from the real
      // %APPDATA%/Godot/app_userdata/BombFarm/session.cfg. acceptConsent() below grants, so this
      // is load-bearing: without it the next account-refresh cycle would open whichever real
      // session.cfg exists on the machine running this suite and issue a live, authenticated
      // request using
      // the real player's token, purely as a side effect of a test run. Pointed at a path that
      // deliberately does not exist: readSessionToken degrades that to token_unavailable (no
      // network call at all).
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      ...env,
    },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  return { app, page };
}

async function acceptConsent(page) {
  // Accept: the app shows a permission gate instead of its content until consent is granted, so
  // nothing below is reachable otherwise. Accepting is safe for a fixture-backed suite now that a
  // refresh cycle which resolves no section commits nothing — it can no longer overwrite the
  // fixture reader's resolved sections with a token_unavailable placeholder.
  const modal = page.getByTestId('consent-modal');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(modal).toBeHidden({ timeout: 15_000 });
}

/** The Planning/Diagnostics/Settings nav buttons live in AppShell's persistent sidebar
 *  (`packages/ui/src/AppShell.tsx`), which stays mounted across every `activeNavId` — unlike the
 *  content area, which conditionally mounts/unmounts per tab (`page.tsx`). `packages/ui` ships no
 *  `data-testid` on these buttons (DS-09 — it must not change), so they are located by role +
 *  position: Planning is always the first nav button, matching `AppShellNavItem[]`'s declared
 *  order in `page.tsx`. */
function navButton(page, index) {
  return page.locator('nav[aria-label="Main"] button').nth(index);
}

test.describe('language smoke (MP3 F4) — detected, switched in place, and remembered', () => {
  test('OS-detected PT-BR, live switch to English with no reload, zero account:changed, no layout shift, and English survives a restart', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-i18n-'));
    try {
      // --- Launch 1: --lang=pt-BR, no stored override --------------------------------------
      const { app: app1, page: page1 } = await launchApp(
        {
          BFC_GAME_READER: 'fixture',
          BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_FULL_FIXTURE,
          BFC_USER_DATA_DIR: userDataDir,
        },
        ['--lang=pt-BR'],
      );
      try {
        await acceptConsent(page1);

        // --- MIN-06: the app opened in PT-BR, detected from the OS locale -----------------
        await expect(page1.locator('html')).toHaveAttribute('lang', 'pt-BR');
        await expect(navButton(page1, 0)).toHaveText(pt('shellPlanningNavLabel'));
        await expect(navButton(page1, 1)).toHaveText(pt('shellDiagnosticsNavLabel'));
        await expect(navButton(page1, 2)).toHaveText(pt('settingsNavLabel'));

        // --- Navigate to Planning; MIN-17's "before" measurement + MIN-10's sentinel ------
        await navButton(page1, 0).click();
        await page1.waitForSelector('[data-testid="planning-view"]', { timeout: 15_000 });
        await page1.waitForSelector('[data-testid="roster-list"]', { timeout: 20_000 });

        // Installed FROM THE TEST — zero production probe surface (F3's AD-048 idiom).
        await page1.evaluate(() => {
          window.__bfcAccountChanged = 0;
          window.bfc.on('account:changed', () => {
            window.__bfcAccountChanged += 1;
          });
          window.__bfcI18nSentinel = 1;
        });

        const planningBoxBefore = await page1.getByTestId('planning-view').boundingBox();
        const rosterBoxBefore = await page1.getByTestId('roster-list').boundingBox();
        expect(planningBoxBefore).not.toBeNull();
        expect(rosterBoxBefore).not.toBeNull();

        // --- MIN-08/MIN-16: navigate to Settings, drive the shipped Select to English -----
        await navButton(page1, 2).click();
        const select = page1.getByRole('combobox', { name: pt('settingsLanguageLabel') });
        await expect(select).toBeVisible({ timeout: 10_000 });
        await select.click();
        await page1.getByRole('option', { name: pt('settingsLanguageOptionEnglish') }).click();

        // The SAME persistent nav node changed in place — Planejamento -> Planning.
        await expect(navButton(page1, 0)).toHaveText(en('shellPlanningNavLabel'), { timeout: 10_000 });
        await expect(navButton(page1, 1)).toHaveText(en('shellDiagnosticsNavLabel'));
        await expect(navButton(page1, 2)).toHaveText(en('settingsNavLabel'));

        // No reload occurred — the sentinel stamped before the switch survived it.
        const sentinelAfter = await page1.evaluate(() => window.__bfcI18nSentinel);
        expect(sentinelAfter).toBe(1);

        await expect(page1.locator('html')).toHaveAttribute('lang', 'en');

        // --- MIN-10 (e2e half): the switch fired zero account:changed events --------------
        const accountChangedCount = await page1.evaluate(() => window.__bfcAccountChanged);
        expect(accountChangedCount).toBe(0);

        // --- MIN-17: "after" measurement, back on Planning (settings unmounted the content
        //     area, so this is a fresh mount of planning-view — the width comparison is what
        //     matters, not node identity) --------------------------------------------------
        await navButton(page1, 0).click();
        await page1.waitForSelector('[data-testid="planning-view"]', { timeout: 15_000 });
        await page1.waitForSelector('[data-testid="roster-list"]', { timeout: 15_000 });
        const planningBoxAfter = await page1.getByTestId('planning-view').boundingBox();
        const rosterBoxAfter = await page1.getByTestId('roster-list').boundingBox();
        expect(planningBoxAfter).not.toBeNull();
        expect(rosterBoxAfter).not.toBeNull();

        expect(planningBoxAfter.width).toBe(planningBoxBefore.width);
        expect(rosterBoxAfter.width).toBe(rosterBoxBefore.width);
      } finally {
        await app1.close().catch(() => undefined);
      }

      // --- Launch 2: SAME BFC_USER_DATA_DIR, --lang=pt-BR STILL SET -------------------------
      // The still-set --lang is what makes this assertion mean "the stored override (English)
      // won" rather than "OS detection happened to run and agree" — MIN-09's only real proof.
      // Do NOT "tidy" this away; it is the one thing that separates the two explanations.
      const { app: app2, page: page2 } = await launchApp(
        { BFC_GAME_READER: 'fixture', BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_FULL_FIXTURE, BFC_USER_DATA_DIR: userDataDir },
        ['--lang=pt-BR'],
      );
      try {
        // Launch 1 granted consent, and that decision persisted to the SAME account.db row
        // (`consent-store.ts`'s disclosure-version-keyed `account_meta` row) this launch reads on
        // boot, so no modal is expected here. Asserting its absence turns that into positive proof
        // the decision survived the restart — the same fact the language assertion below relies on.
        await expect(page2.getByTestId('consent-modal')).toHaveCount(0);

        // --- MIN-09: English persists, read from settings, not from the (still pt-BR) OS ---
        await expect(page2.locator('html')).toHaveAttribute('lang', 'en');
        await expect(navButton(page2, 0)).toHaveText(en('shellPlanningNavLabel'));
        await expect(navButton(page2, 1)).toHaveText(en('shellDiagnosticsNavLabel'));
      } finally {
        await app2.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
