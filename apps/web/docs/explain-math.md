# Explain-tab math sync

**Status:** hard truth  
**Sources:** advice-column IA wave copy drift (2026-07-23); player-facing `explainSections` in `src/shared/i18n`

The collapsible **How the math works** / **Como calculamos tudo** block (`ExplainSection` in `explain-section.tsx`, `src/features/planner/components/`) is the player-facing description of planner math. It must stay aligned with code and with the panels those formulas appear in.

## Rules

1. **WHEN** changing DPS / sheet / combat math in `@bombfarm/domain` (`packages/domain/src` — `model`, `gear`, `derive`, `advisor-pipeline`, `phases`, combat mults, point gains, fuse/walk/cycle, mitigation, HTK, ranking, …) **THEN** update **both** `STRINGS.en.explainSections` and `STRINGS.pt.explainSections` in the same change (or an immediately following commit in the same PR) so prose + `code` blocks match current truth.
2. **WHEN** renaming, moving, adding, or removing a panel or control that the explain text names (Account, House, Skill Tree, Team buffs, Points, Effective stats, Phases / farm phase, cycle/walk/mit/prop, …) **THEN** rewrite the explain (and guide steps that mirror it) to use the **current UI names** — do not leave retired panel names (e.g. Context, Gates, Math check) or removed columns (e.g. Need%).
3. **WHEN** a formula constant or pipeline step changes (point gains, fuse floor, IA efficiency, level power, forge, stamina, …) **THEN** update the matching explain `code` line and the surrounding sentence; do not leave a simplified wrong constant.
4. Prefer **current product vocabulary** over internal type names (`HeroContext`, `gateRows`, …) unless the UI still exposes that term.
5. Keep EN and PT **concept-aligned** (same section order and claims); follow [`i18n.md`](../../../docs/i18n.md) for PT chrome quality.
6. Add or extend a Vitest contract in `src/tests/storage-i18n.test.ts` (or a focused neighbor) when the change would otherwise regress explain wording that already bit us (retired panels, wrong share model, placeholder guide copy).

## Out of scope

- Deep dumps of every derive branch — explain stays a readable summary, not a second `model.ts`.
- Changing math “only in the explain tab” without code — explain follows code, never the reverse.
