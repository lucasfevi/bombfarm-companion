/**
 * The gold-rate window as a sparkline — an area under a line, the way the desktop's own trend
 * block draws it. `preserveAspectRatio="none"` lets it stretch to whatever width the card gets;
 * the shape is the reading, not the scale.
 */
export function TrendLine({ series }: { series: readonly number[] }) {
  if (series.length < 2) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const point = (value: number, index: number) => {
    const across = (index / (series.length - 1)) * 100;
    const down = 26 - ((value - min) / span) * 22;
    return `${String(Math.round(across * 100) / 100)},${String(Math.round(down * 100) / 100)}`;
  };

  const line = series.map(point).join(' ');

  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-9 w-full" aria-hidden="true">
      <polygon points={`0,28 ${line} 100,28`} fill="color-mix(in oklch, var(--gold) 18%, transparent)" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
