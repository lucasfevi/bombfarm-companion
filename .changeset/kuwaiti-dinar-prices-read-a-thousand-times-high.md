---
"@bombfarm/pricing": patch
"@bombfarm/desktop": patch
---

Market prices quoted in Kuwaiti Dinar are no longer read a thousand times too high. Steam returns
a price only as a formatted string, and the parser decided which of `.` and `,` was the decimal
point by counting digits: exactly three after the last separator meant thousands grouping. That is
right for the two-decimal currencies, but the Dinar has three decimal places, so `1.234 KD` — one
and a bit — was read as 1234, and an inventory valued in it came out roughly 1000x its real worth.
Each currency now carries its own number of decimal places and that is what decides the parse, so
a three-decimal amount reads as a fraction, a thousands-grouped one still groups, and a currency
with no decimal places at all — Yen, Won, Dong, Chilean Peso — can never pick up a fraction by
accident. Kuwaiti Dinar is the only three-decimal currency Steam quotes, and it is the only one
whose prices move.
