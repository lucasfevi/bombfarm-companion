/**
 * The renderer swaps tabs by unmounting one and mounting the next, so a subscription owned by a
 * mount is dropped every time the player looks somewhere else. Rebuilt on return it starts from
 * its initial state — the spinner on every visit — and the whole interval away is a hole nothing
 * fills. Both primitives here exist to move that lifetime up to the WINDOW's.
 */

/**
 * Builds `make()` on first call and hands every later caller the same instance. Lazy because the
 * things it holds read `window.bfc`, and these modules are also evaluated during the static
 * export build, where there is no window.
 */
export function createLazySingleton<T>(make: () => T): () => T {
  let instance: T;
  let built = false;
  return () => {
    if (!built) {
      instance = make();
      built = true;
    }
    return instance;
  };
}

export interface SharedStore<S> {
  getState(): S;
  subscribe(listener: (state: S) => void): () => void;
  /** Idempotent, and has no counterpart: `connect` runs once and its subscriptions are never
   *  torn down, which is what keeps the state current while nothing is displaying it. */
  start(): void;
}

export interface SharedStoreDeps<S, A> {
  readonly initial: S;
  /** Pure, and returns the SAME reference for an arrival that changes nothing — which is what
   *  lets the notify below be skipped without a deep comparison. */
  readonly accept: (state: S, arrival: A) => S;
  /** Runs once, on the first `start()`. Wires the bridge reads and subscriptions that feed
   *  `dispatch`. */
  readonly connect: (dispatch: (arrival: A) => void) => void;
}

export function createSharedStore<S, A>(deps: SharedStoreDeps<S, A>): SharedStore<S> {
  let state = deps.initial;
  let started = false;
  const listeners = new Set<(state: S) => void>();

  function dispatch(arrival: A): void {
    const next = deps.accept(state, arrival);
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener(state);
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start: () => {
      if (started) return;
      started = true;
      deps.connect(dispatch);
    },
  };
}
