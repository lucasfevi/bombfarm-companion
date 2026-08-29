import type { UpdateChannel } from './flavors.js';

export type UpdatePhase =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'ready'
  | 'error';

/**
 * A closed reason set rather than the updater's own message. `electron-updater` reports failures
 * as English prose assembled from HTTP status text and Node error codes, which cannot be
 * translated and changes shape between versions; the renderer maps these tokens through the copy
 * seam exactly as it does `SettingsWriteReason`.
 */
export type UpdateErrorReason = 'offline' | 'rate-limited' | 'no-release' | 'unknown';

export interface UpdateStatus {
  phase: UpdatePhase;
  currentVersion: string;
  /** `null` for the `dev` flavor, which declares no channel and never contacts a feed. */
  channel: UpdateChannel | null;
  availableVersion: string | null;
  /** Whole percent, `downloading` only. */
  percent: number | null;
  error: UpdateErrorReason | null;
  lastCheckedAt: string | null;
}

export function disabledUpdateStatus(currentVersion: string): UpdateStatus {
  return {
    phase: 'disabled',
    currentVersion,
    channel: null,
    availableVersion: null,
    percent: null,
    error: null,
    lastCheckedAt: null,
  };
}
