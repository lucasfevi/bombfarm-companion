---
"@bombfarm/web": minor
---

Write numbers in the language they are being read in.

Every number the planner printed used the English convention regardless of the language selected,
which is wrong in the language most readers use: `9,000` reads as nine in Portuguese, not nine
thousand. Prices made it visible rather than merely incorrect — a currency is formatted in the
reader's own locale, so a card footer showed `R$ 29,85` directly above a gold value written
`9,000`, two conventions in the same column of the same row.

`formatNumber` and `formatCompactNumber` now take the language, and take it as a required
argument rather than an optional one: a default is exactly what let the old behaviour survive
unnoticed across a hundred call sites, and making the compiler name every one of them is the only
way to know they were all considered. Components and label builders that receive an injected
formatter keep receiving one — `numberFormatterFor(lang)` binds the language at the single place
that knows it, so those files stay free of i18n entirely.

The abbreviated forms carry it too: `90,2k` and `1,7bi` in Portuguese, against `90.2k` and `1.7bi`
in English, with a zero fraction still dropped in both.
