import { devtools } from 'zustand/middleware';
import type { StateCreator } from 'zustand';

/** A store creator already wrapped by `subscribeWithSelector` (always the outer middleware). */
export type SubscribeCreator<T> = StateCreator<T, [['zustand/subscribeWithSelector', never]], [], T>;

/**
 * Applies zustand's `devtools` middleware outside production.
 *
 * **This module never reaches the production bundle.** `next.config.ts` aliases it to
 * `devtools-middleware-noop.ts` for the production webpack build, because the runtime
 * `NODE_ENV` guard alone is not enough: webpack marks a statically-imported binding as
 * used at module-graph time, so `zustand/middleware` ships whole even when the branch
 * that uses it is provably dead. Measured cost of that leak: **1,517 B gzip**
 * (3,563 B raw). See `RES-02`.
 *
 * The `NODE_ENV` check below is kept as defence in depth — if the alias is ever removed
 * or silently stops matching, behavior stays correct and only the bytes come back.
 * `src/tests/devtools-not-in-production-bundle.test.ts` fails if that happens.
 */
export function withOptionalDevtools<T>(creator: SubscribeCreator<T>): SubscribeCreator<T> {
  if (process.env.NODE_ENV === 'production') return creator;
  // Narrow cast — zustand's conditional middleware mutator tuples do not unify without
  // an assertion; `subscribeWithSelector` stays outer in both branches.
  return devtools(creator, { name: 'planner-store' }) as SubscribeCreator<T>;
}
