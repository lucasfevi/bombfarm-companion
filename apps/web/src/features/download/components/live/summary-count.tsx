export function SummaryCount({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="tracking-wider uppercase">{label}</span>
      <span className="font-semibold text-ink tabular-nums">{value}</span>
    </span>
  );
}
