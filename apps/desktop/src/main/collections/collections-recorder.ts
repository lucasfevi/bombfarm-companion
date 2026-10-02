import type { CollectionsView } from '@bombfarm/contracts';
import { isCollectionsStateBody, readCollectionsState } from '@bombfarm/game-api';
import type { ObservedCollectionsBody } from '../live-source/live-source.js';
import type { LogPort } from '../storage/index.js';
import type { CollectionsStore } from './collections-store.js';

export interface CollectionsRecorderDeps {
  readonly store: CollectionsStore;
  readonly emit: (view: CollectionsView) => void;
  readonly log?: LogPort;
}

/** `accountId` is the account a read was asked as; the tap sees no request, so a body it saw has
 *  none and is stored under whoever is bound as it passes. */
export interface CollectionsObservation extends ObservedCollectionsBody {
  readonly accountId?: string;
}

export interface CollectionsRecorder {
  observe(observation: CollectionsObservation): void;
}

const NOOP_LOG: LogPort = { info: () => undefined, warn: () => undefined, error: () => undefined };

/**
 * Keeps the Collections state, whichever way it arrived: the app's own read of the route, or the
 * body the client fetched when the player opened the panel in game. Like the PVP standing, a read
 * that repeats the held snapshot is still a read — it is re-dated and announced, so the date beside
 * the book means "last confirmed" and never "last changed".
 *
 * The strict identifier decides what the tap may hand over, but not what is kept: a body the app
 * asked the route for is known to be this body, so one carrying a key the game added, or an effect
 * on an axis the contract does not name, is read all the same and logged as drift, rather than
 * blanking the screen.
 *
 * A read for an account that is no longer the bound one is kept under that account and announced
 * to nobody: the renderer is showing the bound account's book, and this is not it.
 */
export function createCollectionsRecorder(deps: CollectionsRecorderDeps): CollectionsRecorder {
  const log = deps.log ?? NOOP_LOG;

  return {
    observe({ body, atMs, accountId }) {
      const read = readCollectionsState(body);
      if (read === null) {
        log.warn({ scope: 'collections', event: 'read.unreadable' });
        return;
      }
      const { snapshot, ignored } = read;
      if (ignored > 0 || !isCollectionsStateBody(body)) log.warn({ scope: 'collections', event: 'read.drift', ignored });
      const outcome = deps.store.record(snapshot, {
        capturedAt: new Date(atMs).toISOString(),
        ...(accountId !== undefined ? { accountId } : {}),
      });
      if (outcome === 'failed') return;
      log.info({ scope: 'collections', event: 'read.recorded', sets: snapshot.sets.length, announced: outcome === 'recorded' });
      if (outcome === 'recorded') deps.emit(deps.store.view());
    },
  };
}
