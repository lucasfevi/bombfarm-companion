import fs from 'node:fs';
import path from 'node:path';
import type { AccountFidelity, AccountPayload, GameSnapshotPayload } from '@bombfarm/contracts';

const SNAPSHOT_FILE = 'last-snapshot.json';

/** Injectable so the read never depends on the real filesystem in a unit test. */
export interface FsPort {
  existsSync(filePath: string): boolean;
  readFileSync(filePath: string): string;
}

const defaultFsPort: FsPort = {
  existsSync: (filePath) => fs.existsSync(filePath),
  readFileSync: (filePath) => fs.readFileSync(filePath, 'utf8'),
};

export interface LegacyImport {
  payload: AccountPayload & { readonly fidelity: AccountFidelity };
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

/**
 * Reads and maps a pre-MP2 `last-snapshot.json` (`GameSnapshotPayload`) into a resolved-only
 * `AccountPayload`, suitable for feeding straight to `AccountStore.persist()` (design.md §7).
 * `raw.state` -> `account`, `raw.inventory.items` -> `items`; `heroes`/`skills`/`casa` have no
 * legacy source and are left `missing`, never fabricated. Every imported section is stamped
 * from `mapped.takenAt ?? status.updatedAt`; if neither parses as ISO-8601, the file is
 * skipped entirely rather than importing with a synthesised time. Never throws.
 */
export function readLegacySnapshotPayload(userDataDir: string, fsPort: FsPort = defaultFsPort): LegacyImport | null {
  const filePath = path.join(userDataDir, SNAPSHOT_FILE);
  if (!fsPort.existsSync(filePath)) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fsPort.readFileSync(filePath));
  } catch {
    return null;
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const snapshot = raw as Partial<GameSnapshotPayload>;

  const takenAt = snapshot.mapped?.takenAt;
  const updatedAt = snapshot.status?.updatedAt;
  const capturedAt = isIsoTimestamp(takenAt) ? takenAt : isIsoTimestamp(updatedAt) ? updatedAt : null;
  if (!capturedAt) {
    return null;
  }

  const state = snapshot.raw?.state;
  const items = snapshot.raw?.inventory?.items;

  const payload: { account?: unknown; items?: unknown } = {};
  let accountFidelity: AccountFidelity['account'] = { status: 'missing' };
  let itemsFidelity: AccountFidelity['items'] = { status: 'missing' };

  let importedAnything = false;
  if (state && typeof state === 'object' && !Array.isArray(state)) {
    payload.account = state;
    accountFidelity = { status: 'resolved', capturedAt };
    importedAnything = true;
  }
  if (Array.isArray(items)) {
    payload.items = items;
    itemsFidelity = { status: 'resolved', capturedAt };
    importedAnything = true;
  }

  if (!importedAnything) {
    return null;
  }

  const fidelity: AccountFidelity = {
    account: accountFidelity,
    heroes: { status: 'missing' },
    skills: { status: 'missing' },
    casa: { status: 'missing' },
    items: itemsFidelity,
  };

  return { payload: { ...payload, fidelity } as AccountPayload & { readonly fidelity: AccountFidelity } };
}
