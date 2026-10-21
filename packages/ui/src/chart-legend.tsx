import { cn } from './cn';

export type ChartLegendItem = {
  label: string;
  color: string;
};

export type ChartLegendProps = {
  items: readonly ChartLegendItem[];
  className?: string;
};

export function ChartLegend({ items, className }: ChartLegendProps) {
  return (
    <ul className={cn('m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-muted', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className="block h-[3px] w-3.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
