import { isAppFlavor } from '@bombfarm/contracts';
import { loadDevTrust } from './host/dev-loader.js';
import { leaseKeysFor } from './licence/lease-verify.js';
import type { LeaseKeyTable } from './licence/lease-verify.js';

/**
 * The Lease keys this run trusts: the shipped ones, plus the test key only in a dev build running
 * as the dev flavour. A missing or unknown flavour is treated as prod, so it adds nothing.
 */
export function runtimeLeaseKeys(flavor: string | undefined, vars: Readonly<Record<string, string | undefined>>): LeaseKeyTable {
  return leaseKeysFor(loadDevTrust({ flavor: isAppFlavor(flavor) ? flavor : 'prod', vars }));
}
