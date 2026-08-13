/**
 * Every player-facing string in the desktop renderer, flat and typed (`AD-040`). Read only
 * through `useCopy()` (`./index.ts`) — never `import { en }` directly at a call site. That is
 * what keeps F4's PT-BR swap a body replacement instead of an N-file edit.
 *
 * Grouped by the web's own i18n namespace prefixes (`apps/web/src/shared/i18n/namespaces/*`) so
 * a future merge into `STRINGS` (`apps/web/src/shared/i18n/strings.ts`) is mechanical: `shell*`,
 * `planning*`, `fidelity*`, `advice*`, `empty*`, `error*`.
 *
 * Every value here must satisfy `docs/i18n.md`'s player-facing plain-language rules — no
 * formulas, no camelCase identifiers, no field paths, no type names (`copy/en.test.ts` scans
 * this object and fails, naming the key, on any of the four).
 */
export const en = {
  // shell* — AppShell navigation
  shellPlanningNavLabel: 'Planning',
  shellDiagnosticsNavLabel: 'Diagnostics',

  // empty* — placeholder states shown before real data has arrived (page.tsx's Diagnostics tab)
  emptyBridgeUnavailableTitle: 'Preload bridge unavailable',
  emptyNoSnapshotTitle: 'No snapshot yet',
  emptyNoSnapshotDescription: 'Waiting on the first read from the game.',

  // Account section names, in player language — never the raw section key (MPV-07, MPV-18)
  sectionNameAccount: 'your farm phase',
  sectionNameHeroes: 'your heroes',
  sectionNameSkills: 'your skill tree',
  sectionNameCasa: 'your house',
  sectionNameItems: 'your gear',
} as const;
