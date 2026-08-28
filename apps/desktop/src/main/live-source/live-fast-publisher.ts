import { LIVE_DISPLAY_REFRESH_MS, type FieldCountdown, type LiveEvent, type LiveView, type RecoveryCountdown, type RotationSnapshot } from '@bombfarm/contracts';

export interface LiveFastPublisherScheduler {
  readonly schedule: (callback: () => void, intervalMs: number) => () => void;
}

export interface LiveFastPublisherDeps {
  readonly getView: () => Pick<LiveView, 'field' | 'recovery' | 'onFieldHeroIds' | 'rotation'>;
  readonly emit: (event: LiveEvent) => void;
  readonly scheduler: LiveFastPublisherScheduler;
  readonly intervalMs?: number;
  /** Called on every poll where the live tap's on-field set disagrees with what the rotation
   *  snapshot itself claims — the signal that the snapshot is stale, not a rate-limited trigger in
   *  its own right. Pace it on the caller's side (see `triggered-refresh.ts`). */
  readonly onFieldMembershipDiverged?: () => void;
}

export interface LiveFastPublisher {
  start(): void;
  stop(): void;
}

interface FastSnapshot {
  readonly field: readonly FieldCountdown[];
  readonly recovery: readonly RecoveryCountdown[];
  readonly onFieldHeroIds: readonly string[];
}

function sameFieldCountdowns(a: readonly FieldCountdown[], b: readonly FieldCountdown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      entry.heroId === other.heroId &&
      entry.secondsRemaining === other.secondsRemaining &&
      entry.drainPerSecond === other.drainPerSecond &&
      entry.basis === other.basis
    );
  });
}

function sameRecoveryCountdowns(a: readonly RecoveryCountdown[], b: readonly RecoveryCountdown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      entry.heroId === other.heroId &&
      entry.secondsRemaining === other.secondsRemaining &&
      entry.advancing === other.advancing
    );
  });
}

export function sameIdList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

function sameFastSnapshot(a: FastSnapshot, b: FastSnapshot): boolean {
  return (
    sameFieldCountdowns(a.field, b.field) &&
    sameRecoveryCountdowns(a.recovery, b.recovery) &&
    sameIdList(a.onFieldHeroIds, b.onFieldHeroIds)
  );
}

/** The rotation snapshot's own idea of who is on the field — `activity: 'inField'` or the
 *  standalone `onField` flag, whichever the normalizer populated. */
function rotationOnFieldIds(rotation: RotationSnapshot | null): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const hero of rotation?.heroes ?? []) {
    if (hero.activity === 'inField' || hero.onField === true) ids.add(hero.id);
  }
  return ids;
}

/** True the moment the live tap's on-field set disagrees with what the rotation snapshot itself
 *  claims — the signal the snapshot is stale, not merely that nothing has changed lately. Never
 *  true with no rotation read yet: there is nothing to diverge from.
 *
 *  `snapshotOnFieldIdsFor` defaults to a fresh, unmemoized derivation so this stays directly
 *  testable against arbitrary views; {@link createLiveFastPublisher} passes its own
 *  identity-memoized cache instead, so a poll against an unchanged rotation does not rebuild the
 *  set every time. */
export function hasFieldMembershipDiverged(
  view: Pick<LiveView, 'onFieldHeroIds' | 'rotation'>,
  snapshotOnFieldIdsFor: (rotation: RotationSnapshot | null) => ReadonlySet<string> = rotationOnFieldIds,
): boolean {
  if (view.rotation === null) return false;
  const snapshotIds = snapshotOnFieldIdsFor(view.rotation);
  const liveIds = view.onFieldHeroIds;
  if (snapshotIds.size !== liveIds.length) return true;
  return liveIds.some((id) => !snapshotIds.has(id));
}

/** Memoizes {@link rotationOnFieldIds} on the rotation snapshot's reference identity — the same
 *  memo-on-identity pattern `packages/domain/src/live/field-countdown.ts` uses for its own
 *  rotation-derived values, applied here so a poll against an unchanged rotation (the common case,
 *  since the rotation only moves on the slow authenticated cycle) does not rebuild a 60-entry set
 *  four times a second. */
export function createRotationOnFieldIdsCache(): (rotation: RotationSnapshot | null) => ReadonlySet<string> {
  let hasComputed = false;
  let lastRotation: RotationSnapshot | null = null;
  let lastIds: ReadonlySet<string> = new Set();
  return (rotation) => {
    if (hasComputed && rotation === lastRotation) return lastIds;
    hasComputed = true;
    lastRotation = rotation;
    lastIds = rotationOnFieldIds(rotation);
    return lastIds;
  };
}

/**
 * Polls the already-folded {@link LiveView} on a fixed schedule and republishes the fast channel
 * (`field`, `recovery`, `onFieldHeroIds`) only when its content actually changed since the last
 * publish — the throttle the main process owes the renderer per the fast/slow split, so an idle
 * account with nothing changing publishes nothing at all rather than one identical event every
 * tick. `getView()` itself is cheap: it returns state the live source already maintains — its
 * sorted on-field id list included — never recomputing anything on this poll's account. The
 * divergence check below carries the same property via its own memo cache, so a poll against an
 * unchanged rotation rebuilds nothing either.
 */
export function createLiveFastPublisher(deps: LiveFastPublisherDeps): LiveFastPublisher {
  const intervalMs = deps.intervalMs ?? LIVE_DISPLAY_REFRESH_MS;
  let lastPublished: FastSnapshot | null = null;
  let cancel: (() => void) | null = null;
  const rotationOnFieldIdsCache = createRotationOnFieldIdsCache();

  function poll(): void {
    const view = deps.getView();
    if (deps.onFieldMembershipDiverged && hasFieldMembershipDiverged(view, rotationOnFieldIdsCache)) {
      deps.onFieldMembershipDiverged();
    }

    const next: FastSnapshot = { field: view.field, recovery: view.recovery, onFieldHeroIds: view.onFieldHeroIds };
    if (lastPublished && sameFastSnapshot(lastPublished, next)) return;
    lastPublished = next;
    deps.emit({ type: 'fastUpdate', field: next.field, recovery: next.recovery, onFieldHeroIds: next.onFieldHeroIds });
  }

  return {
    start(): void {
      if (cancel) return;
      cancel = deps.scheduler.schedule(poll, intervalMs);
    },
    stop(): void {
      cancel?.();
      cancel = null;
    },
  };
}
