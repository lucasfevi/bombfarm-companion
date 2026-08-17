# No layout shift (CLS)

**Status:** reference (durable) · **Source:** Math check / required-badge polish (2026-07-23)

Conditional chrome must not move siblings or change row height when it appears or disappears. The web metric is **Cumulative Layout Shift (CLS)**; here the rule is the same idea for planner panels.

## Rules

1. **Reserve space or disclose out of flow.** WHEN a badge, hint, error, or status string can toggle on a stable row (field label, panel header, table header) THEN either (a) keep that slot **always mounted** and toggle **visibility** (`invisible` / `opacity-0` + `aria-hidden`), or (b) keep a fixed micro-control (e.g. `HelpTip` `?`) and put long copy in a popover/dialog so siblings do not gain a new block. Do **not** mount/unmount an *extra* paragraph with `{cond && <…>}` if that pushes neighbors. (A narrow, reviewed exception for roster-scoped advice mounted above the tab stage — not inside a row — lives at rule 8.)
2. **Prefer `FieldRequired`.** WHEN showing the shared “required” chrome THEN use [`FieldRequired`](../packages/ui/src/field-required.tsx) (or the same always-mounted + `invisible` pattern) instead of a bare conditional `reqClass` span. Place it **to the right of the label/title**. Do **not** add warn outlines, orange input borders, or `Panel need` rings for required state — those patterns are retired.
3. **Same-line with title.** WHEN a required badge sits next to a field title in a stack label whose outer span is `flex-col` (for under-label hints) THEN wrap title + badge in an **inline** row (`inline-flex`) so the badge does not become a second flex-col line that grows the control row when it appears.
4. **Under-label hints use `data-field-hint`.** WHEN adding muted secondary lines under a stack label (phase wiki hint, Target HP / Hits, etc.) THEN mark them with `data-field-hint` so stack recipes style only those spans — not title wrappers or `FieldRequired`.
5. **Under-label hints are OK.** Secondary readouts under a label may wrap in the label column; they must not appear/disappear in a way that jumps the value column unless that jump is intentional product copy change.
6. **Long tips: don’t double-stack.** WHEN a panel already has a tip line THEN do not add a second reserved mismatch paragraph. Prefer row chrome + progressive disclosure (`HelpTip` / `Tooltip`) for warning copy.
7. **Stable data tables.** WHEN a table’s cell values change during editing THEN use `table-fixed` + `<colgroup>` widths sized for real content so columns do not reflow.
8. **Tab status out of flow — for the active hero's own trust/setup state.** WHEN explaining tab trust issues for the hero currently loaded THEN use a tab dot + DS `Tooltip` (hover/focus) — never an in-panel banner that changes height and shifts siblings.
   **Permitted exception:** roster-scoped advice about heroes *other than the active one* has no per-tab home — a single DS `Banner` above the tab stage is allowed for that case. See [`animation.md`](animation.md) rule 8 for the full scoping, the accepted-cost rationale, and the concrete instance (`ResetAdviceRosterBanner`). This does not extend to per-tab/in-panel banners for the active hero.
9. **Verify.** WHEN finishing UI that toggles chrome THEN check that enabling/clearing the state does not change row height or shift the control column (spot-check or Playwright box metrics).
10. **Animated preview siblings must not co-occupy layout with the content they preview.** WHEN a UI shows a compact preview in place of full content while closed THEN do not give that preview its own exit animation on the direction where the full content is simultaneously animating in — both would be present for the length of the animation (layout jump or paint overlap). Prefer tabs / single-surface disclosure, or unmount the preview synchronously; see [`docs/animation.md`](animation.md).

## Anti-patterns

| Avoid | Prefer |
| --- | --- |
| `{missing && <span className={reqClass}>…</span>}` | `<FieldRequired show={missing}>…</FieldRequired>` |
| Required as a bare second child under a `flex-col` label span | Title + `FieldRequired` inside `inline-flex items-baseline` |
| Growing panel headers only when warn is on | Always-mounted header badge slot |
| Styling every nested label `span` as a muted hint | `data-field-hint` only |
| `{mismatch && <p className={warnTextClass}>…</p>}` (extra slot) | Row highlight + `HelpTip` (`?`) with the explanation |
| Empty always-`invisible` paragraph for long tips | Help popover / overlay / toast over idle whitespace |
| Auto-sized table columns that jump when values change | `table-fixed` + `<colgroup>` widths sized for real content |
