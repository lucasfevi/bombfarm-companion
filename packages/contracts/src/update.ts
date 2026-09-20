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

/** How long an app left open can sit on a version that has already shipped — main's own check
 *  clock, and the cycle the renderer's feed meter fills against. The release feed is an
 *  unauthenticated CDN read of a few kilobytes, so the cost of asking is not what sets this —
 *  what does is that nothing downstream is automatic: the player still chooses to download and
 *  still chooses to restart. Minutes of notice are therefore worth having and seconds are not. */
export const UPDATE_CHECK_INTERVAL_MS = 20 * 60 * 1000;

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

/** A build that can update but has not looked yet. */
export function idleUpdateStatus(currentVersion: string, channel: UpdateChannel | null): UpdateStatus {
  return {
    phase: 'idle',
    currentVersion,
    channel,
    availableVersion: null,
    percent: null,
    error: null,
    lastCheckedAt: null,
  };
}

/**
 * The one expression of "does this build update itself", so the answer main gives before its
 * update service exists cannot disagree with the one the service gives once it does.
 *
 * `disabled` is a claim about the build, not about readiness: the Updates section greys out its
 * own check button on that phase, so a wrong `disabled` is one a player cannot correct.
 */
export function initialUpdateStatus(input: {
  currentVersion: string;
  channel: UpdateChannel | null;
  isPackaged: boolean;
}): UpdateStatus {
  return input.isPackaged && input.channel !== null
    ? idleUpdateStatus(input.currentVersion, input.channel)
    : disabledUpdateStatus(input.currentVersion);
}
