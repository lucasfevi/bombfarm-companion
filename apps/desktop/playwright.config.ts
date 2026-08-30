import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  // Each spec here launches a real Electron GUI process. Two specs launching concurrently
  // contend for the same machine resources and produce spurious failures/timeouts that have
  // nothing to do with the feature under test — force strictly sequential smoke runs.
  workers: 1,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'electron-smoke',
      testMatch: [
        'app-boot.spec.mjs',
        'account-restart.spec.mjs',
        'consent-modal.spec.mjs',
        'auto-recompute.spec.mjs',
        'i18n.spec.mjs',
        'inventory.spec.mjs',
        'live-earnings-no-layout-shift.spec.mjs',
        'live-layout-and-scrollbars.spec.mjs',
      ],
    },
    {
      // A separate project so it can be run (or excluded) independently of `electron-smoke` —
      // `ci-desktop.yml` and the `test:smoke`/`test:render-count` scripts all pass an explicit
      // `--project` so a bare `playwright test` here never silently runs both. This one is an
      // advisory render-profiling instrument, not part of the required smoke gate.
      name: 'render-count-instrument',
      testDir: './tests/render-count',
      testMatch: ['render-count.spec.mjs'],
    },
  ],
});
