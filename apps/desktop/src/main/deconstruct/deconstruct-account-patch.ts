import type { AccountPayload, SectionFidelity } from '@bombfarm/contracts';

export interface DeconstructAccountPatch {
  readonly itemIds: readonly string[];
  /** The Forge Essence balance the server reported after the burn. */
  readonly essence: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The bag and the balance as the burn left them, laid over the last committed payload. Only the
 * two sections the run touched are re-stamped. The account section's own item count is left for
 * the re-read that follows every run rather than adjusted by a guess.
 */
export function patchAccountAfterDeconstruct(
  payload: AccountPayload,
  patch: DeconstructAccountPatch,
  now: string,
): AccountPayload {
  const resolved: SectionFidelity = { status: 'resolved', capturedAt: now };
  const burned = new Set(patch.itemIds);
  const items =
    payload.items === undefined
      ? undefined
      : payload.items.filter((row) => !(isRecord(row) && typeof row.id === 'string' && burned.has(row.id)));
  const account = { ...(payload.account ?? {}), essence: patch.essence };
  const fidelity = payload.fidelity
    ? {
        ...payload.fidelity,
        ...(items === undefined ? {} : { items: resolved }),
        account: resolved,
      }
    : undefined;
  return { ...payload, items, account, fidelity };
}
