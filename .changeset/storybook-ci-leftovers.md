---
"@bombfarm/ui": patch
"@bombfarm/web": patch
---

Housekeeping after the Storybook move, no runtime behaviour change. `apps/web`'s
TypeScript config no longer includes the deleted local `.storybook/` directory, and
root ESLint now lints `packages/ui` story files (with type checking off, since they
sit outside the package tsconfig) so the raw `react-icons` / `*.svg` import ban that
guards the `Icon` seam applies to stories too, not just to product code.
