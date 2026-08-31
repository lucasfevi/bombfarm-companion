export function ReplicaReading({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] tracking-wide text-muted uppercase">{label}</span>
      <span className="font-mono text-[11px] text-ink tabular-nums">{value}</span>
    </div>
  );
}
