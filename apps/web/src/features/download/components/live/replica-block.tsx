export function ReplicaBlock({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] tracking-wide text-muted uppercase">{label}</span>
      <span className={`text-lg leading-none font-bold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
