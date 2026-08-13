---
"@bombfarm/web": minor
"@bombfarm/ui": minor
"@bombfarm/desktop": patch
---

**Every player-facing and internal surface that could still express the five removed keystones is
gone.** `@bombfarm/domain` stopped modelling Abisso, Glass Cannon and Tempo Dobrado (MP5 F2); this
change removes the last ways a player or a maintainer could still see, toggle, persist or key on
them.

**Removed controls (`@bombfarm/web`, rendered Account panel, both `pt` and `en`):**

- The three `Switch` toggles — **Abisso**, **Glass Cannon**, **Tempo Dobrado** — and their On/Off
  status readouts. The Skill Tree subsection is now six read-only `<output>` rows with no input,
  button or switch/checkbox role anywhere inside it.
- The three conditional import-preview rows in the account-import summary.
- The advice column's forwarding of the two keystone-only fields into the breakdown model.

**Removed i18n keys, EN and PT-BR (12 keys × 2 languages):** `treeGlassCannon`,
`treeGlassCannonHint`, `treeAbisso`, `treeAbissoHint`, `treeTempoDobrado`,
`treeTempoDobradoHint`, `keystoneOn`/`keystoneOff` (PT `Sim`/`Não`), `importKeystoneOn` (PT
`Ativo`), `bdNoteGlassCannon`, `bdNoteTempoDobrado`, `bdTermAbisso`. Surviving prose in both
languages (account hints, the damage formula's `× abisso` factor, and the planner's explain-section
text) no longer names any of the three mechanics.

**Removed `TreeState` fields (`@bombfarm/web`):** `glassCannon`, `tempoDobrado`, `abisso`,
`abissoBase`, `critDmgMult` — gone from the type, `DEFAULT_TREE`, every selector, the store's
setters (`setTreeGlassCannon`, `setTreeTempoDobrado`, `setTreeAbisso`) and the team-plan input
builder. A stored account written before this change still loads; the dead fields are discarded on
normalize, not fatal.

**Removed `@bombfarm/ui` exports:** `accountKeystoneControlClass` and
`accountKeystoneStatusClass` (`panel-field.recipe.ts`), plus the two `[&_label_[data-keystone-control]]`
arbitrary variants inside `stackFieldsClass`. The Storybook `switch.stories.tsx` stories keep their
ids and count (3 → 3), re-labelled and re-skinned onto a surviving row.

**`@bombfarm/desktop` (internal, no user-facing change):** `CHANGE_KEY_INPUTS` and
`sharedChangeKey` no longer key on the four dead tree paths, and `account-model.ts` no longer maps
the five fields into the shared account shape.
