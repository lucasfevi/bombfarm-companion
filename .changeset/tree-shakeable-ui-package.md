---
"@bombfarm/ui": patch
---

Make the design-system package safe to import from React Server Components and tree-shakeable: client modules declare `'use client'`, only CSS is marked as a side effect, every module has an export path that carries its file extension, and the nav loads its tooltip only when an item needs one.
