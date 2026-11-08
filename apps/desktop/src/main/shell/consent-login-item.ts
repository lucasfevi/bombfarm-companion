import { createConsentApplier, type ConsentApplierDeps } from '../game-api/consent-applier.js';

/**
 * The consent applier with the login-item reconcile as its last post-write step, so a grant
 * registers and a revoke removes the entry without the settings value being touched. The step
 * lives here, not in the caller's hook list, so it cannot be dropped from the wiring unnoticed.
 */
export function createLoginItemConsentApplier(
  deps: ConsentApplierDeps & { readonly reconcileLoginItem: () => unknown },
) {
  const { reconcileLoginItem, afterApplied, ...rest } = deps;
  return createConsentApplier({
    ...rest,
    afterApplied: [
      ...afterApplied,
      () => {
        reconcileLoginItem();
      },
    ],
  });
}
