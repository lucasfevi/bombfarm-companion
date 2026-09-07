import type { AccountPayload, SectionFidelity } from '@bombfarm/contracts';

export interface ForgeAccountPatch {
  readonly itemId: string;
  /** The item as the server returned it from the last call — every key it carries is fresher
   *  than the row's own, so it wins key by key over the last read. */
  readonly item: Readonly<Record<string, unknown>>;
  /** The wallet after the last call, when the server reported one. */
  readonly gold: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The bag and the wallet as the server left them, laid over the last committed payload. Only the
 * two sections the run touched are re-stamped: the returned item and the gold are a fresh read of
 * exactly those values, so they are served as resolved rather than waiting a cycle behind a
 * stale row.
 */
export function patchAccountAfterForge(payload: AccountPayload, patch: ForgeAccountPatch, now: string): AccountPayload {
  const resolved: SectionFidelity = { status: 'resolved', capturedAt: now };
  const items =
    payload.items === undefined
      ? undefined
      : payload.items.map((row) => (isRecord(row) && row.id === patch.itemId ? { ...row, ...patch.item } : row));
  const account =
    patch.gold === null ? payload.account : { ...(payload.account ?? {}), gold: patch.gold };
  const fidelity = payload.fidelity
    ? {
        ...payload.fidelity,
        ...(items === undefined ? {} : { items: resolved }),
        ...(patch.gold === null ? {} : { account: resolved }),
      }
    : undefined;
  return { ...payload, items, account, fidelity };
}
