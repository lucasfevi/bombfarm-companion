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
        'planning-advice.spec.mjs',
        'auto-recompute.spec.mjs',
        'i18n.spec.mjs',
      ],
    },
  ],
});
