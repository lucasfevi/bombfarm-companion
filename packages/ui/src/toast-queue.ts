/**
 * Toast queue — pure reducer (no React, no timers, no `Date.now()`).
 *
 * This module owns every policy decision DESIGN_SYSTEM.md §11 specifies for
 * the toast system: key-based coalescing, the 3-visible/"+N more" overflow
 * split, severity-dependent auto-dismiss, and threshold-gated progress
 * announcements. `packages/ui`'s Vitest runs in `environment: 'node'` with no
 * jsdom, so this logic is written as a pure function of `(state, action)` —
 * every time-dependent decision takes an explicit `now` rather than reading
 * the clock — so it is fully testable without a DOM or fake timers. The React
 * provider (`toast-system.tsx`) is a thin shell: it holds this state, derives
 * the next deadline from it, and owns exactly one `setTimeout` that dispatches
 * `{ type: 'expire', now: Date.now() }`.
 */

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'progress';

/** §11 — "max 3 visible at once... collapse into a '+N more' affordance". */
export const MAX_VISIBLE_TOASTS = 3;

/** §11 NTF-2 — NotificationCenter ring buffer, "last ~50". */
export const NOTIFICATION_BUFFER_LIMIT = 50;

/** §11 — "an optional single action button... never more than one". */
export type ToastActionButton = {
  label: string;
  onAction: () => void;
};

export type ToastInput = {
  /** Coalescing identity — a new push with a matching `key` replaces the live toast in place (§11 dedup/coalesce). */
  key: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  /** 0–100. Only meaningful for `variant: 'progress'`; drives `aria-valuenow` and threshold announcements. */
  progress?: number;
  action?: ToastActionButton;
  /**
   * Explicit auto-dismiss override in ms (or `null` to force manual dismiss).
   * Honoured only for `success`/`info` — `warning`/`error`/`progress` never
   * auto-expire on a timer regardless of this value (§11, TST-06). Wiring
   * this to a user preference is M5 SET-1; here it is just a prop.
   */
  autoDismissMs?: number | null;
};

export type ToastEntry = ToastInput & {
  id: string;
  /** Preserved across coalescing replaces (TST-02). */
  createdAt: number;
  updatedAt: number;
  /** Epoch ms deadline, or `null` if this toast never auto-expires. */
  expiresAt: number | null;
};

/** A toast's buffered history snapshot — same shape, kept for NotificationCenter's ring buffer. */
export type NotificationEntry = ToastEntry;

export type ToastQueueState = {
  /** Full live order, newest-first — `visible`/`overflow` are derived slices of this. */
  all: ToastEntry[];
  visible: ToastEntry[];
  overflow: ToastEntry[];
  overflowCount: number;
  /** Capped notification ring, newest-first. Independent of `all` — dismissing/expiring a live toast never removes it from history. */
  buffer: NotificationEntry[];
  /**
   * Transient: true only when this dispatch was a progress toast crossing a
   * 0/50/100% announcement threshold (TST-08). Always false after
   * dismiss/expire/clear. Consumers read it once per dispatch; it is not
   * "sticky" state to clear manually.
   */
  announce: boolean;
  /** Monotonic id source — keeps id generation pure (no `crypto`/`Math.random`). */
  seq: number;
};

export type ToastQueueAction =
  | { type: 'push'; toast: ToastInput; now: number }
  | { type: 'dismiss'; id: string }
  | { type: 'expire'; now: number }
  | { type: 'clear' };

export const initialToastQueueState: ToastQueueState = {
  all: [],
  visible: [],
  overflow: [],
  overflowCount: 0,
  buffer: [],
  announce: false,
  seq: 0,
};

/** §11 — info/success default 4s; warning/error manual; progress dismisses only on completion (a coalesced replace). */
const VARIANT_DEFAULT_AUTO_DISMISS_MS: Record<ToastVariant, number | null> = {
  success: 4000,
  info: 4000,
  warning: null,
  error: null,
  progress: null,
};

/** Variants that never auto-expire on a timer, no matter what `autoDismissMs` a caller passes (TST-06). */
const NEVER_AUTO_EXPIRES: ReadonlySet<ToastVariant> = new Set(['warning', 'error', 'progress']);

function computeExpiresAt(variant: ToastVariant, now: number, autoDismissMs: number | null | undefined): number | null {
  if (NEVER_AUTO_EXPIRES.has(variant)) return null;
  const ms = autoDismissMs === undefined ? VARIANT_DEFAULT_AUTO_DISMISS_MS[variant] : autoDismissMs;
  if (ms === null || ms === undefined) return null;
  return now + ms;
}

const PROGRESS_ANNOUNCE_THRESHOLDS = [0, 50, 100] as const;

/** True when `nextProgress` crosses a 0/50/100 threshold that `prevProgress` hadn't reached yet (TST-08). */
function crossesAnnounceThreshold(prevProgress: number | undefined, nextProgress: number | undefined): boolean {
  if (nextProgress === undefined) return false;
  const prev = prevProgress ?? -1;
  return PROGRESS_ANNOUNCE_THRESHOLDS.some((threshold) => prev < threshold && nextProgress >= threshold);
}

function splitVisible(all: ToastEntry[]): { visible: ToastEntry[]; overflow: ToastEntry[] } {
  return { visible: all.slice(0, MAX_VISIBLE_TOASTS), overflow: all.slice(MAX_VISIBLE_TOASTS) };
}

function upsertBuffer(
  buffer: NotificationEntry[],
  entry: NotificationEntry,
  isCoalesce: boolean,
): NotificationEntry[] {
  if (isCoalesce) {
    const index = buffer.findIndex((item) => item.id === entry.id);
    if (index === -1) {
      // The original entry already aged out of the capped buffer — treat this as a fresh arrival.
      return [entry, ...buffer].slice(0, NOTIFICATION_BUFFER_LIMIT);
    }
    const next = buffer.slice();
    next[index] = entry;
    return next;
  }
  return [entry, ...buffer].slice(0, NOTIFICATION_BUFFER_LIMIT);
}

function applyPush(state: ToastQueueState, input: ToastInput, now: number): ToastQueueState {
  const existingIndex = state.all.findIndex((entry) => entry.key === input.key);
  const isCoalesce = existingIndex >= 0;

  let entry: ToastEntry;
  let nextAll: ToastEntry[];
  let seq = state.seq;

  if (isCoalesce) {
    const prev = state.all[existingIndex];
    entry = {
      ...input,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: now,
      expiresAt: computeExpiresAt(input.variant, now, input.autoDismissMs),
    };
    nextAll = state.all.slice();
    nextAll[existingIndex] = entry;
  } else {
    seq += 1;
    entry = {
      ...input,
      id: `toast-${seq}`,
      createdAt: now,
      updatedAt: now,
      expiresAt: computeExpiresAt(input.variant, now, input.autoDismissMs),
    };
    nextAll = [entry, ...state.all];
  }

  const { visible, overflow } = splitVisible(nextAll);
  const prevProgress = isCoalesce ? state.all[existingIndex].progress : undefined;

  return {
    ...state,
    all: nextAll,
    visible,
    overflow,
    overflowCount: overflow.length,
    buffer: upsertBuffer(state.buffer, entry, isCoalesce),
    announce: crossesAnnounceThreshold(prevProgress, input.progress),
    seq,
  };
}

function applyDismiss(state: ToastQueueState, id: string): ToastQueueState {
  const nextAll = state.all.filter((entry) => entry.id !== id);
  if (nextAll.length === state.all.length) return { ...state, announce: false };
  const { visible, overflow } = splitVisible(nextAll);
  return { ...state, all: nextAll, visible, overflow, overflowCount: overflow.length, announce: false };
}

function applyExpire(state: ToastQueueState, now: number): ToastQueueState {
  const nextAll = state.all.filter((entry) => entry.expiresAt === null || entry.expiresAt > now);
  if (nextAll.length === state.all.length) return { ...state, announce: false };
  const { visible, overflow } = splitVisible(nextAll);
  return { ...state, all: nextAll, visible, overflow, overflowCount: overflow.length, announce: false };
}

function applyClear(state: ToastQueueState): ToastQueueState {
  return { ...state, all: [], visible: [], overflow: [], overflowCount: 0, announce: false };
}

/**
 * Pure toast queue reducer. `push`/`dismiss`/`expire` take an explicit `now`
 * (or none at all, for `dismiss`/`clear`) — never reads the clock itself.
 */
export function toastQueueReducer(state: ToastQueueState, action: ToastQueueAction): ToastQueueState {
  switch (action.type) {
    case 'push':
      return applyPush(state, action.toast, action.now);
    case 'dismiss':
      return applyDismiss(state, action.id);
    case 'expire':
      return applyExpire(state, action.now);
    case 'clear':
      return applyClear(state);
    default:
      return state;
  }
}

/** Earliest `expiresAt` across live toasts, or `null` if none auto-expire — what the provider schedules its single timer against. */
export function nextExpiryDeadline(state: ToastQueueState): number | null {
  let deadline: number | null = null;
  for (const entry of state.all) {
    if (entry.expiresAt === null) continue;
    if (deadline === null || entry.expiresAt < deadline) deadline = entry.expiresAt;
  }
  return deadline;
}
