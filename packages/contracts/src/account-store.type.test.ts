/**
 * Type-level assertions for the "stored is never resolved" invariant. Vitest transpiles this file with esbuild, which strips types and never
 * typechecks — so every `@ts-expect-error` below is only enforced by `pnpm --filter
 * @bombfarm/contracts typecheck`, which runs `tsc -p tsconfig.typecheck.json --noEmit` (the only
 * tsconfig for this package that includes `src/**\/*.test.ts`). An unused
 * `@ts-expect-error` directive is itself a `tsc` error, so a widened type here fails the build
 * rather than passing silently.
 */
import { describe, expect, it } from 'vitest';
import type { AccountPayload } from './account-payload.js';
import type {
  AccountStoreReason,
  AccountView,
  RestoredAccount,
  StoredAccountFidelity,
  StoredSectionFidelity,
} from './account-store.js';

const STALE: StoredSectionFidelity = { status: 'stale', capturedAt: '2026-08-12T00:00:00.000Z' };
const MISSING: StoredSectionFidelity = { status: 'missing' };

function fullStoredFidelity(): StoredAccountFidelity {
  return { account: STALE, heroes: STALE, skills: MISSING, casa: MISSING, items: STALE };
}

describe('stored-account serving types — runtime shape assertions', () => {
  it('accepts a stale stored section with its capturedAt', () => {
    expect(STALE).toEqual({ status: 'stale', capturedAt: '2026-08-12T00:00:00.000Z' });
  });

  it('accepts a missing stored section with no capturedAt', () => {
    expect(MISSING).toEqual({ status: 'missing' });
    expect((MISSING as { capturedAt?: string }).capturedAt).toBeUndefined();
  });

  it('builds a full RestoredAccount with gameRunning literally false and only stale/missing sections', () => {
    const restored: RestoredAccount = {
      status: 'ok',
      reason: null,
      gameRunning: false,
      payload: { fidelity: fullStoredFidelity() },
    };
    expect(restored.gameRunning).toBe(false);
    for (const section of Object.values(restored.payload.fidelity)) {
      expect(['stale', 'missing']).toContain(section.status);
    }
  });

  it('serves an AccountView whose payload is a plain AccountPayload', () => {
    const view: AccountView = {
      payload: {},
      gameRunning: false,
      store: { status: 'unavailable', reason: 'empty', binding: null },
    };
    expect(view.store.reason).toBe('empty');
    expect(view.gameRunning).toBe(false);
  });

  it('lists every AccountStoreReason literal without throwing', () => {
    const reasons: AccountStoreReason[] = [
      'empty',
      'schema_too_new',
      'corrupt_rebuilt',
      'not_writable',
      'no_sqlite_binding',
      'account_mismatch',
    ];
    expect(reasons).toHaveLength(6);
  });
});

// --- Compile-time-only assertions below: no runtime behaviour, enforced by `tsc` only. ---

// 1. `{status:'resolved', capturedAt}` is not assignable to StoredSectionFidelity — `resolved`
//    is not a member of the narrowed union (the core invariant here).
// @ts-expect-error - StoredSectionFidelity has no `resolved` member
const _resolvedNotStorable: StoredSectionFidelity = { status: 'resolved', capturedAt: '2026-08-12T00:00:00.000Z' };

// 2. `{status:'stale'}` without `capturedAt` is not assignable — stale requires its timestamp.
// @ts-expect-error - a stale stored section requires capturedAt
const _staleWithoutCapturedAt: StoredSectionFidelity = { status: 'stale' };

// 3. `capturedAt` is not a member of the `missing` branch.
// @ts-expect-error - a missing stored section carries no capturedAt
const _capturedAtOnMissing: StoredSectionFidelity = { status: 'missing', capturedAt: '2026-08-12T00:00:00.000Z' };

// 4. RestoredAccount.gameRunning is the literal `false`, not `boolean`.
// @ts-expect-error - gameRunning is literally false; a restore is never live
const _gameRunningTrue: RestoredAccount = { status: 'ok', reason: null, gameRunning: true, payload: { fidelity: fullStoredFidelity() } };

// 5. A sixth section key is rejected by the mapped-type's excess-property check.
// @ts-expect-error - "extra" is not one of the five AccountSection keys
const _sixthSectionKey: StoredAccountFidelity = { ...fullStoredFidelity(), extra: STALE };

// 6. A missing section key fails the mapped type's completeness requirement.
// @ts-expect-error - "items" is missing from this StoredAccountFidelity block
const _missingSectionKey: StoredAccountFidelity = {
  account: STALE,
  heroes: STALE,
  skills: MISSING,
  casa: MISSING,
};

// 7. An unknown AccountStoreReason literal is rejected.
// @ts-expect-error - "unknown_reason" is not one of the AccountStoreReason literals
const _unknownReason: AccountStoreReason = 'unknown_reason';

// 8. Even nested inside a full RestoredAccount, a section claiming `resolved` is rejected —
//    the narrowing holds through structural typing, not only for a bare standalone variable.
const _nestedRestored: RestoredAccount = {
  status: 'ok',
  reason: null,
  gameRunning: false,
  payload: {
    fidelity: {
      ...fullStoredFidelity(),
      // @ts-expect-error - a section nested in RestoredAccount.payload.fidelity still cannot be `resolved`
      account: { status: 'resolved', capturedAt: '2026-08-12T00:00:00.000Z' },
    },
  },
};
void _nestedRestored;

// 9. The headline claim: comparing a restored section's status to 'resolved' is a compile
//    error (TS2367 "no overlap"), not a passing-but-always-false comparison. Wrapped in a
//    never-called function so the type-only `restored` parameter has nothing to evaluate
//    at module load (a top-level `declare const` reference would throw at runtime once
//    esbuild strips the ambient declaration).
function _assertNeverResolvedComparisonIsATypeError(restored: RestoredAccount): void {
  // @ts-expect-error - TS2367: 'StoredSectionFidelity["status"]' ("stale" | "missing") and
  // '"resolved"' have no overlap, so this comparison can never be true
  const neverResolved = restored.payload.fidelity.heroes.status === 'resolved';
  void neverResolved;
}
void _assertNeverResolvedComparisonIsATypeError;

// 10. Positive assertion: RestoredAccount['payload'] IS assignable to AccountPayload with no
//     cast, so MP3/F4 can feed a restored payload straight into `parseAccountPayload`. Same
//     never-called-function wrapping to avoid evaluating a type-only value at runtime.
function _assertRestoredPayloadIsAnAccountPayload(restoredPayload: RestoredAccount['payload']): void {
  const asAccountPayload: AccountPayload = restoredPayload;
  void asAccountPayload;
}
void _assertRestoredPayloadIsAnAccountPayload;
