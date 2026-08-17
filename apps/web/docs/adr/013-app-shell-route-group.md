# ADR-013: Shared app shell (route group)

**Status:** accepted (Wave 1)  
**Date:** 2026-07-27

## Context

`/`` and `/phases` each mounted their own header, footer, lang state, and client mount gate. Client navigation tore down the full tree on every tab click.

## Decision

Introduce `src/app/(app)/` route group with:

- `layout.tsx` → `ClientAppShell` (single mount gate, lang, header, footer, import dialog)
- `@planner/default.tsx` → keep-alive `HeroPlanner` parallel slot
- `page.tsx` → `null` (planner visible via slot on `/`)
- `phases/page.tsx` → route main content (`PhasesExplorer`)

`HeroPlanner` owns workspace + explain footer only — no page chrome.

## Consequences

- Chrome mounts once per session.
- Lang lives in the planner store session slice; `useAppLang()` (`app-lang.tsx`) is a store-backed compat hook (W4).
- Import/guide dialog lifted to shell; roster + active hero come from Zustand selectors (no imperative planner bridge).
- Phases feature branch rebased onto this layout; `/phases` renders `PhasesExplorer`.

## Follow-ups

- ADR-014: parallel slot visibility (`hidden` + `inert` on `/phases`)
- ~~Wave 2: Zustand replaces bridge + direct `localStorage` reads~~ **done (W5)** — `AppShellBridgeProvider` removed; import dialog + phases use store selectors.