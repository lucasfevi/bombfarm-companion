---
"@bombfarm/domain": minor
---

**All modelled keystone mechanics are deleted from `@bombfarm/domain`.** The 2026-08-13 patch
removed all five keystones and wiped every account; `skills.totals` no longer emits `keystones`,
`abisso_base` or `crit_dmg_mult`. The domain package stopped modelling Abisso's damage multiplier,
Glass Cannon's crit ×2 / energy ×0.5, and Tempo Dobrado's speed ×1.33333 / drain ×2 — this is pure
deletion of dead mechanics, not a behaviour change: every removed term was already an identity
element (`× 1`, `+ 0`) on every keystone-free input the post-patch game can produce, proven by a
committed pre-deletion characterization baseline compared bit-exactly (`Object.is`) against the
post-deletion output.

**No number changes for any keystone-free input.** The one non-numeric exception is
`formulaDmg.substituted`, whose rendered string drops the `× 1.000` Abisso factor while the
underlying `value` is unchanged.

**Removed public API:**

- `effectiveTreeSheetForAbisso` (`birth-sheet.ts`, re-exported from `model/index.ts`)
- `detectGlassCannon`, `detectTempoDobrado`, `normalizeKeystones` (`save-units.ts`)
- `unmodelledTreeFindings`, `UnmodelledTreeInput` (`tree-guards.ts`, deleted outright, re-exported
  from `model/index.ts`)
- `TreeSheetTotals.critDmgMult`, `.glassCannon`, `.tempoDobrado` (six surviving members remain:
  `danoStatic`, `energyPct`, `speedPct`, `critChancePct`, `critDmgPct`, `luckFlatPct`)
- `AdvisorPipelineInput.treeGlassCannon`, `.treeCritDmgMult`, `.treeTempoDobrado`, `.treeAbisso`,
  `.treeAbissoBase`
- `AdvisorPipelineResult.abissoMult`
- `CombatMults.abissoMult`
- `ComputeCombatMultsInput.treeAbisso`, `.treeAbissoBase`
- `FarmContextForHeroInput.treeTempoDobrado`
- `TreeState.glassCannon`, `.tempoDobrado`, `.abisso`, `.abissoBase`, `.critDmgMult`
  (`shims/storage.ts` — the type the MP5 milestone calls `AccountTree`)
- `PipelineFacts.abissoMult`, `.critDmgMult` keystone-derived members
- `TeamPlanAccount`'s `treeAbisso` / `treeAbissoBase` / `treeTempoDobrado` members
- `LedgerNote`'s `'glassCannon'` and `'tempoDobrado'` union members

**Kept, deliberately:** `CombatMults.critDmgMult` / `DeriveInput.critDmgMult` — a dead
combat-layer pass-through hardcoded to `1` since the keystone correction, with no keystone content
of its own. Removing it would be an unrelated public-signature change to `derive()`.
