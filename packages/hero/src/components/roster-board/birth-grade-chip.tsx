import { heroRankBandClass, heroRankToneClass } from '@bombfarm/game-art';
import { cn } from '@bombfarm/ui';
import { sub, type ShowcaseCopy } from '../../copy';

const SIZE_CLASSES = {
  md: cn('h-6', 'min-w-6', 'text-sm'),
  sm: cn('h-5', 'min-w-5', 'text-xs'),
} as const;

/** A hero's birth grade as the game's letter on its band colour — the card's and the table's. */
export function BirthGradeChip({
  grade,
  copy,
  size = 'md',
  testId,
}: {
  grade: string;
  copy: ShowcaseCopy;
  size?: keyof typeof SIZE_CLASSES;
  testId: string;
}) {
  return (
    <span
      className={cn(
        'inline-grid',
        'place-items-center',
        'rounded-sm',
        'px-1',
        'font-black',
        SIZE_CLASSES[size],
        heroRankToneClass(grade),
        heroRankBandClass(grade, true),
      )}
      aria-label={sub(copy.cardBirthGrade, { grade })}
      data-testid={testId}
    >
      {grade}
    </span>
  );
}
