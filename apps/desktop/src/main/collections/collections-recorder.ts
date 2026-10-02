import type { CollectionsView } from '@bombfarm/contracts';
import { isCollectionsStateBody, parseCollectionsState } from '@bombfarm/game-api';
import type { ObservedCollectionsBody } from '../live-source/live-source.js';
import type { LogPort } from '../storage/index.js';
import type { CollectionsStore } from './collections-store.js';

export interface CollectionsRecorderDeps {
  readonly store: CollectionsStore;
  readonly emit: (view: CollectionsView) => void;
  readonly log?: LogPort;
}

export interface CollectionsRecorder {
  observe(observation: ObservedCollectionsBody): void;
}

const NOOP_LOG: LogPort = { info: () => undefined, warn: () => undefined, error: () => undefined };

/**
 * Keeps the Collections state, whichever way it arrived: the app's own read of the route, or the
 * body the client fetched when the player opened the panel in game. Like the PVP standing, a read
 * that repeats the held snapshot is still a read — it is re-dated and announced, so the date beside
 * the book means "last confirmed" and never "last changed".
 *
 * The strict identifier decides what the tap may hand over, but not what is kept: a body the app
 * asked the route for is known to be this body, so one carrying a key the game added is read all
 * the same and logged as drift, rather than blanking the screen.
 */
export function createCollectionsRecorder(deps: CollectionsRecorderDeps): CollectionsRecorder {
  const log = deps.log ?? NOOP_LOG;

  return {
    observe({ body, atMs }) {
      const snapshot = parseCollectionsState(body);
      if (snapshot === null) {
        log.warn({ scope: 'collections', event: 'read.unreadable' });
        return;
      }
      if (!isCollectionsStateBody(body)) log.warn({ scope: 'collections', event: 'read.drift' });
      if (!deps.store.record(snapshot, { capturedAt: new Date(atMs).toISOString() })) return;
      log.info({ scope: 'collections', event: 'read.recorded', sets: snapshot.sets.length });
      deps.emit(deps.store.view());
    },
  };
}
