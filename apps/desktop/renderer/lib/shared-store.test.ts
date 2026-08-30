import { describe, expect, it, vi } from 'vitest';
import { createLazySingleton, createSharedStore } from './shared-store';

describe('createLazySingleton', () => {
  it('builds once and hands every later caller the same instance', () => {
    const make = vi.fn(() => ({ id: 'only' }));
    const get = createLazySingleton(make);

    const first = get();
    const second = get();
    const third = get();

    expect(make).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('does not build until first asked', () => {
    const make = vi.fn(() => ({}));

    createLazySingleton(make);

    expect(make).not.toHaveBeenCalled();
  });

  it('memoizes a falsy instance rather than rebuilding it on every call', () => {
    const make = vi.fn(() => 0);
    const get = createLazySingleton(make);

    get();
    get();

    expect(make).toHaveBeenCalledTimes(1);
  });
});

type Arrival = { readonly kind: 'set'; readonly value: number } | { readonly kind: 'noop' };

function counterStore(connect: (dispatch: (arrival: Arrival) => void) => void = () => {}) {
  return createSharedStore<number, Arrival>({
    initial: 0,
    // Returns the SAME state for a no-op, the contract the notify skip below relies on.
    accept: (state, arrival) => (arrival.kind === 'noop' ? state : arrival.value),
    connect,
  });
}

describe('createSharedStore', () => {
  it('connects on the first start and never again, however many callers start it', () => {
    const connect = vi.fn();
    const store = counterStore(connect);

    store.start();
    store.start();
    store.start();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('does not connect until started — construction alone touches no bridge', () => {
    const connect = vi.fn();

    counterStore(connect);

    expect(connect).not.toHaveBeenCalled();
  });

  it('keeps folding arrivals with no subscribers, and hands the result to one that subscribes later', () => {
    let dispatch = (_: Arrival) => {};
    const store = counterStore((d) => {
      dispatch = d;
    });
    store.start();

    // The whole point: this is the interval during which the tab reading the store is unmounted.
    dispatch({ kind: 'set', value: 7 });
    dispatch({ kind: 'set', value: 9 });

    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.getState()).toBe(9);
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies every subscriber on a state change', () => {
    let dispatch = (_: Arrival) => {};
    const store = counterStore((d) => {
      dispatch = d;
    });
    store.start();
    const first = vi.fn();
    const second = vi.fn();
    store.subscribe(first);
    store.subscribe(second);

    dispatch({ kind: 'set', value: 3 });

    expect(first).toHaveBeenCalledWith(3);
    expect(second).toHaveBeenCalledWith(3);
  });

  it('does not notify when accept returns the same state', () => {
    let dispatch = (_: Arrival) => {};
    const store = counterStore((d) => {
      dispatch = d;
    });
    store.start();
    const listener = vi.fn();
    store.subscribe(listener);

    dispatch({ kind: 'noop' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying an unsubscribed listener but keeps the store running for the rest', () => {
    let dispatch = (_: Arrival) => {};
    const store = counterStore((d) => {
      dispatch = d;
    });
    store.start();
    const unmounted = vi.fn();
    const staying = vi.fn();
    const unsubscribe = store.subscribe(unmounted);
    store.subscribe(staying);

    unsubscribe();
    dispatch({ kind: 'set', value: 5 });

    expect(unmounted).not.toHaveBeenCalled();
    expect(staying).toHaveBeenCalledWith(5);
    expect(store.getState()).toBe(5);
  });

  it('re-subscribing after every listener left does not re-connect — no second bridge read', () => {
    const connect = vi.fn();
    const store = counterStore(connect);
    store.start();

    store.subscribe(vi.fn())();
    store.subscribe(vi.fn());
    store.start();

    expect(connect).toHaveBeenCalledTimes(1);
  });
});
