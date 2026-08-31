export function MeasuredFigure({
  label,
  value,
  note,
  valueClass,
}: {
  label: string;
  value: string;
  note?: string;
  valueClass: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] tracking-wide text-muted uppercase">{label}</span>
      <span className={`text-[15px] leading-none font-bold tabular-nums ${valueClass}`}>{value}</span>
      {note === undefined ? null : (
        <span className="text-[9.5px] leading-tight text-muted">{note}</span>
      )}
    </div>
  );
}
