import type { StateCreator } from 'zustand';

/** A store creator already wrapped by `subscribeWithSelector` (always the outer middleware). */
export type SubscribeCreator<T> = StateCreator<T, [['zustand/subscribeWithSelector', never]], [], T>;

/**
 * Production stand-in for `devtools-middleware.ts`, swapped in by `next.config.ts`'s
 * webpack `resolve.alias`. Importing nothing from `zustand/middleware` is the entire
 * point: it keeps the devtools implementation out of the production module graph, which
 * a runtime `NODE_ENV` guard cannot do on its own.
 *
 * Must keep the same exported signature as the module it replaces. See `RES-02`.
 */
export function withOptionalDevtools<T>(creator: SubscribeCreator<T>): SubscribeCreator<T> {
  return creator;
}
