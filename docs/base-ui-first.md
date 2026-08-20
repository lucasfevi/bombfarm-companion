# Base UI first

**Status:** reference (durable) · **Source:** `account-house-keystones` Switch polish (2026-07-22); reinforces [`design-system.md`](design-system.md)

Interactive controls should wrap [`@base-ui/react`](https://base-ui.com/react/components) when an equivalent exists, then dress with cva + planner tokens — not invent parallel Button/checkbox patterns.

## Rules

1. **Check Base UI first.** WHEN adding or redesigning an interactive control (toggle, select, dialog, menu, …) THEN open the Base UI component list and prefer an existing headless primitive before rolling a custom one.
2. **Wrap, don’t fork.** WHEN adopting a Base UI primitive THEN implement it under `packages/ui/src/` with a `*.recipe.ts` + `cn()`, export from the barrel, and document it in [`design-system.md`](design-system.md).
3. **Boolean flags → Switch.** WHEN the control is a clear on/off account or settings flag THEN use the `Switch` primitive (Base UI Switch + tokens). Do not reintroduce muted “terms” checkboxes or invent On/Off `Button` toggles unless Switch is demonstrably wrong for the interaction.
4. **Compose existing DS primitives next.** WHEN Base UI has no match THEN prefer composing shipped `design-system/` primitives (`Button`, `Select`, `Num`, `Chip`, …) over a one-off leaf control.
5. **DS-09 still holds.** NOTHING under `design-system/` may import planner feature/domain modules — Base UI wraps stay presentation-only.
