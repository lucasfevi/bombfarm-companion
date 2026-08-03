import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;
const prebuilt = process.env.E2E_PREBUILT === '1';
const blobReporter = process.env.PLAYWRIGHT_BLOB === '1';
/**
 * Perf harness captureMode. W1's spike locked `dev-strict` because production builds
 * minified component names; RES-05 solved that (`PERF_PROFILE=1 next build --profile`
 * with minification disabled), so `prod-profile` is now available and is the mode any
 * claim about production behavior must use. `dev-strict` is retained unchanged — the
 * W1/W8 baselines are expressed in it and must stay comparable.
 */
const perfMode = process.env.PERF === '1';
const perfProfile = process.env.PERF_PROFILE === '1';

const chromiumUse = {
  ...devices['Desktop Chrome'],
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  colorScheme: 'dark' as const,
};

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: blobReporter
    ? [['list'], ['blob']]
    : [['list'], ['html', { open: 'never' }]],
  snapshotPathTemplate: 'e2e/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0,
    },
  },
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    // Playwright 1.61: reducedMotion lives on contextOptions (not top-level use).
    contextOptions: {
      reducedMotion: 'reduce',
    },
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'smoke',
      testIgnore: ['**/visual.spec.ts', '**/perf/**'],
      use: chromiumUse,
    },
    {
      // Name kept as `chromium` so existing baselines stay `*-chromium.png`.
      name: 'chromium',
      testMatch: '**/visual.spec.ts',
      use: chromiumUse,
    },
    ...(perfMode
      ? [
          {
            name: 'perf',
            testMatch: '**/perf/*.spec.ts',
            fullyParallel: false,
            workers: 1,
            retries: 0,
            use: chromiumUse,
          },
        ]
      : []),
  ],
  // Perf: `dev-strict` runs next:dev (webpack); `prod-profile` serves the static export
  // from `pnpm perf:build:profile`. Smoke/visual keep the static-export server.
  webServer: perfMode
    ? perfProfile
      ? {
          command: 'node e2e/scripts/serve-static.mjs',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        }
      : {
          command: 'pnpm exec next dev --port 4321',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        }
    : {
        command: prebuilt
          ? 'node e2e/scripts/serve-static.mjs'
          : 'pnpm build:e2e && node e2e/scripts/serve-static.mjs',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: prebuilt ? 30_000 : 120_000,
      },
});
