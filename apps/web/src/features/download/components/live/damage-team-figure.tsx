export function DamageTeamFigure({ caption, value }: { caption: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] tracking-wide text-muted uppercase whitespace-nowrap">{caption}</span>
      <span className="text-[20px] leading-none font-bold text-ink tabular-nums">{value}</span>
    </div>
  );
}
