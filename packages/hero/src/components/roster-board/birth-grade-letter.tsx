import { heroRankToneClass } from '@bombfarm/game-art';
import { cn } from '@bombfarm/ui';
import { sub, type ShowcaseCopy } from '../../copy';

const SIZE_CLASSES = {
  md: 'text-sm',
  sm: 'text-xs',
} as const;

/** A hero's birth grade as the bare letter in the game's colour for it, as the hero identity
 *  prints it — no chip behind it. */
export function BirthGradeLetter({
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
      className={cn('font-black', 'leading-none', 'tracking-tight', SIZE_CLASSES[size], heroRankToneClass(grade))}
      aria-label={sub(copy.cardBirthGrade, { grade })}
      data-testid={testId}
    >
      {grade}
    </span>
  );
}
