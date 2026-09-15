import type { AccountPayload, SectionFidelity } from '@bombfarm/contracts';

export interface ForgeAccountPatch {
  readonly itemId: string;
  /** The item as the server returned it from the last call — every key it carries is fresher
   *  than the row's own, so it wins key by key over the last read, bar the keys a forge cannot
   *  have changed. */
  readonly item: Readonly<Record<string, unknown>>;
  /** The wallet after the last call, when the server reported one. */
  readonly gold: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A forge changes the piece, never where it sits: the row keeps its own identity and placement
 * whatever the reply carries under those keys. Letting the reply's `equipped_on` win took a worn
 * piece out of every hero-filtered bag until the next full read put its wearer back.
 */
const KEYS_A_FORGE_CANNOT_CHANGE = ['id', 'equipped_on', 'equip_slot', 'in_stash'] as const;

function forgedRow(row: Record<string, unknown>, item: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...row, ...item };
  for (const key of KEYS_A_FORGE_CANNOT_CHANGE) {
    if (key in row) merged[key] = row[key];
  }
  return merged;
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
      : payload.items.map((row) => (isRecord(row) && row.id === patch.itemId ? forgedRow(row, patch.item) : row));
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
