import { test as base, expect, _electron } from '@playwright/test';
import { createViolationLog, guardEachTest, guardWorkerEnd } from './csp-guard.mjs';

const violations = createViolationLog();

export const electron = { launch: (options) => violations.launchWatched((launchOptions) => _electron.launch(launchOptions), options) };

export const test = base.extend({
  /** Violations a spec expects to provoke take them out here; whatever is left fails the test. */
  csp: [async ({}, use) => guardEachTest(use, violations), { auto: true }],
  cspAtWorkerEnd: [async ({}, use) => guardWorkerEnd(use, violations), { scope: 'worker', auto: true }],
});

export { expect };
