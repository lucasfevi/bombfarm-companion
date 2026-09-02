/**
 * @bombfarm/account public root.
 * Prefer the named subpaths: `@bombfarm/account/panels`, `@bombfarm/account/holdings`.
 *
 * Every view here is presentational and prop-driven. Nothing in this package reads a store, a
 * locale context or an IPC bridge — the desktop shell and the web planner each own a connector
 * that supplies the values and every string, which is what lets one drawing serve both.
 */
export * from './panels/index';
export * from './holdings/index';
