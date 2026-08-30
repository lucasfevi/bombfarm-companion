import type { FieldCountdown, LiveEarnings, LiveEvent, LiveMap, LiveView, RecoveryCountdown, RotationSnapshot } from '@bombfarm/contracts';
import {
  BRIDGE_UNAVAILABLE_LIVE_FRESHNESS,
  EMPTY_LIVE_FAST_MODEL,
  LOADING_LIVE_FRESHNESS,
  buildLiveFastModel,
  buildLiveFreshness,
  buildLiveSlowModel,
  type LiveFastModel,
  type LiveFreshness,
  type LiveModel,
  type LiveSlowModel,
} from './live-model';

export type LiveBridge = Pick<NonNullable<Window['bfc']>, 'invoke' | 'on'>;

export interface LiveStoreDeps {
  readonly bridge: LiveBridge | undefined;
}

export interface LiveInternalState {
  readonly freshness: LiveFreshness;
  readonly rotation: RotationSnapshot | null;
  readonly field: readonly FieldCountdown[];
  readonly recovery: readonly RecoveryCountdown[];
  /** The live tap's on-field id set (or its REST-derived stand-in) — main-computed, like `field`
   *  and `recovery`, and fed straight to `classifyRotation` when the slow model is built. */
  readonly onFieldHeroIds: readonly string[];
  /** Straight from the same arrival as `field`/`recovery` — never folded or defaulted here. */
  readonly earnings: LiveEarnings | null;
  /** Same rule as `earnings`: carried through from the arrival, never derived here. */
  readonly map: LiveMap | null;
  /** Set once any real data — the first `live:get` bootstrap or a `live:event` — has been
   *  applied. Guards only the FIRST bootstrap: subscription happens before that read resolves,
   *  so an event can legitimately arrive first, and the bootstrap resolving afterward must not
   *  clobber it. Every later `live:get` (triggered by `account:changed`) is a deliberate re-fetch,
   *  not a race, and always wins outright — see `hasBootstrapped` below. */
  readonly hasAppliedArrival: boolean;
  /** Set once the first `live:get` has been applied, and never unset. Distinguishes the initial
   *  bootstrap (which may lose the race above) from every subsequent re-fetch (which may not: the
   *  main process is the authority on currency/field/recovery in every mode, including with no
   *  tap attached at all, where a rotation re-read is the only source those values will ever
   *  have). */
  readonly hasBootstrapped: boolean;
  /** Bumped by every arrival that changes what the store would publish, and only by those — the
   *  publish step compares this against the revision it last published from, which is what
   *  "notify only when the model differs" costs, without a deep-equality check on the built model. */
  readonly revision: number;
}

export const initialLiveInternalState: LiveInternalState = {
  freshness: LOADING_LIVE_FRESHNESS,
  rotation: null,
  field: [],
  recovery: [],
  onFieldHeroIds: [],
  earnings: null,
  map: null,
  hasAppliedArrival: false,
  hasBootstrapped: false,
  revision: 0,
};

export type LiveArrival =
  | { readonly kind: 'bridge-missing' }
  | { readonly kind: 'bootstrap'; readonly view: LiveView }
  | { readonly kind: 'event'; readonly event: LiveEvent };

function sameFreshness(a: LiveFreshness, b: LiveFreshness): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind !== 'gap' || b.kind !== 'gap') return true;
  return a.reason === b.reason && a.actionable === b.actionable && a.likelyQuarantine === b.likelyQuarantine;
}

function sameIdList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
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
    return other !== undefined && entry.heroId === other.heroId && entry.secondsRemaining === other.secondsRemaining && entry.advancing === other.advancing;
  });
}

function sameMap(a: LiveMap | null, b: LiveMap | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return (
    a.phase === b.phase &&
    a.healthFraction === b.healthFraction &&
    a.propsAlive === b.propsAlive &&
    a.propsTotal === b.propsTotal
  );
}

function sameEarnings(a: LiveEarnings | null, b: LiveEarnings | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return (
    a.goldBalance === b.goldBalance &&
    a.gold10 === b.gold10 &&
    a.goldSession === b.goldSession &&
    a.xp10 === b.xp10 &&
    a.xpSession === b.xpSession &&
    a.coverageSeconds === b.coverageSeconds &&
    a.sessionSeconds === b.sessionSeconds
  );
}

export function applyLiveArrival(state: LiveInternalState, arrival: LiveArrival): LiveInternalState {
  switch (arrival.kind) {
    case 'bridge-missing': {
      if (state.freshness.kind === 'bridge-unavailable') return state;
      return { ...state, freshness: BRIDGE_UNAVAILABLE_LIVE_FRESHNESS, hasAppliedArrival: true, revision: state.revision + 1 };
    }

    case 'bootstrap': {
      const { view } = arrival;
      // The rotation snapshot always applies — this is its only source. Every OTHER field also
      // applies unconditionally once this is a re-fetch (`hasBootstrapped`): the main process is
      // the authority on currency/field/recovery/onFieldHeroIds in every mode, including with no
      // tap attached, where a rotation re-read is the only source those values will ever have.
      // Only the very first bootstrap can lose a genuine race against an event that already
      // landed first.
      const applyRest = state.hasBootstrapped || !state.hasAppliedArrival;
      const nextFreshness = applyRest ? buildLiveFreshness(view.currency) : state.freshness;
      const nextField = applyRest ? view.field : state.field;
      const nextRecovery = applyRest ? view.recovery : state.recovery;
      const nextOnFieldHeroIds = applyRest ? view.onFieldHeroIds : state.onFieldHeroIds;
      const nextEarnings = applyRest ? view.earnings : state.earnings;
      const nextMap = applyRest ? view.map : state.map;
      const unchanged =
        state.hasBootstrapped &&
        view.rotation === state.rotation &&
        sameFreshness(nextFreshness, state.freshness) &&
        nextField === state.field &&
        nextRecovery === state.recovery &&
        sameIdList(nextOnFieldHeroIds, state.onFieldHeroIds) &&
        sameEarnings(nextEarnings, state.earnings) &&
        sameMap(nextMap, state.map);
      if (unchanged) return state;
      return {
        ...state,
        freshness: nextFreshness,
        rotation: view.rotation,
        field: nextField,
        recovery: nextRecovery,
        onFieldHeroIds: nextOnFieldHeroIds,
        earnings: nextEarnings,
        map: nextMap,
        hasAppliedArrival: true,
        hasBootstrapped: true,
        revision: state.revision + 1,
      };
    }

    case 'event': {
      const { event } = arrival;
      if (event.type === 'currency') {
        const nextFreshness = buildLiveFreshness(event.currency);
        if (state.hasAppliedArrival && sameFreshness(nextFreshness, state.freshness)) return state;
        return { ...state, freshness: nextFreshness, hasAppliedArrival: true, revision: state.revision + 1 };
      }
      if (event.type === 'fastUpdate') {
        const unchanged =
          state.hasAppliedArrival &&
          sameFieldCountdowns(state.field, event.field) &&
          sameRecoveryCountdowns(state.recovery, event.recovery) &&
          sameIdList(state.onFieldHeroIds, event.onFieldHeroIds) &&
          sameEarnings(state.earnings, event.earnings) &&
          sameMap(state.map, event.map);
        if (unchanged) return state;
        return {
          ...state,
          field: event.field,
          recovery: event.recovery,
          onFieldHeroIds: event.onFieldHeroIds,
          earnings: event.earnings,
          map: event.map,
          hasAppliedArrival: true,
          revision: state.revision + 1,
        };
      }
      // The main process never forwards a raw `frame` event over this channel — see index.ts —
      // so this is unreachable in production. Kept as an explicit no-op, not a thrown error, so a
      // future consumer that DOES start forwarding it fails by doing nothing rather than crashing
      // the store.
      return state;
    }
  }
}

/** Memoizes {@link buildLiveSlowModel} on the rotation snapshot's reference identity AND the
 *  live on-field id set's content — either input changing the classified lists means the slow
 *  part must stay the SAME object across every fast-channel update that changes neither (the IPC
 *  boundary structurally clones on every read, so identity never mutates in place). */
export function createSlowModelCache(): (
  rotation: RotationSnapshot | null,
  onFieldHeroIds: readonly string[],
) => LiveSlowModel | null {
  let hasComputed = false;
  let lastRotation: RotationSnapshot | null = null;
  let lastOnFieldHeroIds: readonly string[] = [];
  let lastResult: LiveSlowModel | null = null;
  return (rotation, onFieldHeroIds) => {
    if (hasComputed && rotation === lastRotation && sameIdList(onFieldHeroIds, lastOnFieldHeroIds)) return lastResult;
    hasComputed = true;
    lastOnFieldHeroIds = onFieldHeroIds;
    lastRotation = rotation;
    lastResult = rotation === null ? null : buildLiveSlowModel({ snapshot: rotation, drops: [] }, onFieldHeroIds);
    return lastResult;
  };
}

/** No freeze step here: `state.recovery` already carries the correct `advancing` flag — the main
 *  process applies the same freeze against its own currency state before this ever crosses IPC
 *  (see `LiveSource.getView()`), so the renderer only ever displays what it was sent. */
function deriveFastModel(state: LiveInternalState): LiveFastModel {
  if (!state.hasAppliedArrival) return EMPTY_LIVE_FAST_MODEL;
  return buildLiveFastModel(state.field, state.recovery);
}

export function deriveLiveModel(
  state: LiveInternalState,
  slowModelCache: (rotation: RotationSnapshot | null, onFieldHeroIds: readonly string[]) => LiveSlowModel | null,
): LiveModel {
  return {
    freshness: state.freshness,
    slow: slowModelCache(state.rotation, state.onFieldHeroIds),
    fast: deriveFastModel(state),
    earnings: state.earnings,
    map: state.map,
  };
}

export interface LiveStore {
  getModel(): LiveModel;
  subscribe(listener: (model: LiveModel) => void): () => void;
  start(): void;
  stop(): void;
}

/**
 * Applies every arrival as it lands and publishes right away — no display clock of its own. The
 * channel this reads is already throttled and de-duplicated in the main process (see
 * `live-fast-publisher.ts`), so there is nothing left here for a second clock to coalesce; adding
 * one only adds latency on top of an already-paced stream. `publishIfChanged` still does real
 * work: `applyLiveArrival` returns the SAME state object when an arrival changes nothing, so the
 * revision check below is what keeps a byte-identical update from notifying at all.
 */
export function createLiveStore(deps: LiveStoreDeps): LiveStore {
  let state = initialLiveInternalState;
  const slowModelCache = createSlowModelCache();
  const listeners = new Set<(model: LiveModel) => void>();
  let lastPublishedRevision = -1;
  let lastPublishedModel = deriveLiveModel(state, slowModelCache);
  let started = false;
  let unsubscribeLiveEvent: (() => void) | null = null;
  let unsubscribeAccountChanged: (() => void) | null = null;

  function publishIfChanged(): void {
    if (state.revision === lastPublishedRevision) return;
    lastPublishedRevision = state.revision;
    lastPublishedModel = deriveLiveModel(state, slowModelCache);
    for (const listener of listeners) listener(lastPublishedModel);
  }

  function apply(arrival: LiveArrival): void {
    state = applyLiveArrival(state, arrival);
    publishIfChanged();
  }

  function fetchRotation(bridge: LiveBridge): void {
    bridge
      .invoke('live:get')
      .then((view) => {
        apply({ kind: 'bootstrap', view });
      })
      .catch(() => {
        // Never throw — the store simply stays wherever events (or `loading`) already left it,
        // the same posture the bridge-unavailable and account-view seams take on a failed read.
      });
  }

  function start(): void {
    if (started) return;
    started = true;
    const bridge = deps.bridge;
    if (!bridge) {
      apply({ kind: 'bridge-missing' });
    } else {
      unsubscribeLiveEvent = bridge.on('live:event', (event) => {
        apply({ kind: 'event', event });
      });
      // `account:changed` is the slow channel: main re-reads the rotation on the same
      // authenticated cycle that produces it, and publishes no other signal when it does. The
      // event itself never touches the model directly — it only tells this store a fresh
      // `live:get` result exists.
      unsubscribeAccountChanged = bridge.on('account:changed', () => {
        fetchRotation(bridge);
      });
      fetchRotation(bridge);
    }
  }

  function stop(): void {
    started = false;
    unsubscribeLiveEvent?.();
    unsubscribeLiveEvent = null;
    unsubscribeAccountChanged?.();
    unsubscribeAccountChanged = null;
  }

  return {
    getModel: () => lastPublishedModel,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    stop,
  };
}
