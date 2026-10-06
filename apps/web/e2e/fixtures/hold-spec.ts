import { test } from '@playwright/test';
import {
  expiryMessage,
  isInRegimeFor,
  type Mechanic,
} from '../../../../packages/domain/tests/helpers/capture-regime-core';

/**
 * The Playwright counterpart of `holdSuiteUntilInRegime`: call it inside a test whose subject is a
 * committed capture. The test is skipped, with the same message, while the registry deems the
 * capture out of regime for `mechanic`. `tools/held-suites.manifest.mjs` must list every spec that
 * holds this way.
 */
export function holdSpecUntilInRegime(capturePath: string, mechanic: Mechanic): void {
  const running = test.info();
  running.skip(!isInRegimeFor(capturePath, mechanic), expiryMessage(capturePath, mechanic));
}
