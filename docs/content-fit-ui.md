# Content-fit UI

**Status:** reference (durable) · **Source:** `account-house-keystones` polish (2026-07-22)

Controls and labels must be sized and laid out from **real content**, not from a default slot that happens to look fine for short English placeholders.

## Rules

1. **Size from content.** WHEN designing a Select, Chip, button label, or stack control slot THEN size it against the **longest real string** that will appear (check **both** `Lang=en` and `Lang=pt` game/chrome labels).
2. **No accidental truncation.** WHEN a label, Select value, or status string is clipped, ellipsized, or overflow-hidden THEN that truncation MUST be intentional — and the full text MUST still be available (e.g. `title` / tooltip / open list). Default stack slots that silently cut house names (or similar) are a bug.
3. **Sibling alignment.** WHEN related controls share one stack column (e.g. House type `Select` + House level `Num`) THEN they SHALL use the **same control width** so the value column lines up.
4. **Verify in UI.** WHEN finishing a UI change THEN spot-check the running panel (or Playwright) for clipped words, misaligned columns, and overflow — do not trust recipe defaults alone.
5. **Prefer widen over abbreviate.** WHEN a full official game name or chrome string does not fit THEN widen the control (or allow wrap in the label column) before inventing shortened aliases — unless an existing i18n hard truth already defines an abbreviation key.
6. **When a `table-fixed` table's real content exceeds the panel, scroll the table — do not shrink columns into truncation.** WHEN a stable data table (see [`no-layout-shift.md`](no-layout-shift.md) rule 7: `table-fixed` + `<colgroup>` sized for real content) has genuinely too many columns to fit the panel width at readable sizes THEN keep `table-fixed` + `<colgroup>`, give the `<table>` a `min-w-[…]` sized for its real content, and wrap it in its own `overflow-x-auto` scroll container so the table scrolls independently of the page. Do **not** compress columns below a readable width to force a fit — that reproduces rule 2's truncation bug on every column at once. The Stats table's birth→Total breakdown (`src/features/planner/components/sheet-table.tsx`, `table-fixed min-w-[56rem]` inside a `DataTable.Root scrollable className="overflow-x-auto"`) is the sanctioned instance: its nine columns (Stat + Birth + six Δs + Total) cannot fit the Points panel width without either truncating or scrolling, and scrolling was chosen.
