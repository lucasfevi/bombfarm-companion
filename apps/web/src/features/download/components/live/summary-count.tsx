/**
 * Mirrors the desktop state-summary badge, slot and all. These counts sit content-sized in a row,
 * so the width of any one of them is the row's geometry: a count crossing nine widens its badge
 * and shoves the ones after it sideways. The face holds the digits to one width; only a reserved
 * slot holds their number. A minimum rather than a fixed width, so a third digit grows the badge
 * once instead of clipping the count.
 *
 * A plain `2ch` is exactly two digits here, where the desktop's badge needs a margin on top of
 * it: this row is set in the mono face with no letter-spacing, and `ch` measures a glyph's
 * advance alone. The two slots differ because their type does, not because either is arbitrary.
 */
export function SummaryCount({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="tracking-wider uppercase">{label}</span>
      <span className="inline-block min-w-[2ch] text-right font-semibold text-ink tabular-nums">{value}</span>
    </span>
  );
}
