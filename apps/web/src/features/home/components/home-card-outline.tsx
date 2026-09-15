import { cn } from '@bombfarm/ui';
import type { HomeCardSection } from '../model/home-card-state';

const ROW = 'h-3 w-full';
const LABEL_VALUE = ['h-3 w-2/5', 'h-3 w-1/5'];
const FIGURE = 'h-7 w-1/2';

const OUTLINE_ROWS: Record<HomeCardSection, readonly (readonly string[])[]> = {
  heroes: [[ROW], [ROW], [ROW], [ROW], [ROW], [ROW]],
  farm: [['h-16 flex-1', 'h-5 w-12', 'h-16 flex-1']],
  optimizer: [['h-7 w-3/4'], [ROW], [ROW], [ROW]],
  inventory: [[FIGURE], LABEL_VALUE, LABEL_VALUE, LABEL_VALUE, LABEL_VALUE, LABEL_VALUE, LABEL_VALUE],
  account: [
    LABEL_VALUE,
    LABEL_VALUE,
    LABEL_VALUE,
    LABEL_VALUE,
    LABEL_VALUE,
    LABEL_VALUE,
    LABEL_VALUE,
    LABEL_VALUE,
    [FIGURE],
  ],
  download: [[ROW], ['h-3 w-5/6'], [ROW], [ROW], ['h-8 w-1/3']],
};

export function HomeCardOutline({ kind }: { kind: HomeCardSection }) {
  return (
    <div className="flex flex-col gap-2" data-testid="home-card-outline">
      {OUTLINE_ROWS[kind].map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-center justify-between gap-2">
          {row.map((bar, barIndex) => (
            <div key={barIndex} className={cn('rounded-sm bg-bg-2', bar)} />
          ))}
        </div>
      ))}
    </div>
  );
}
