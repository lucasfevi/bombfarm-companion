import { abilityIconSrc } from '@bombfarm/domain/wiki-assets';

import { cn } from '@bombfarm/ui';
import {
  abilityIconRecipe,
  iconMetaGlyphRecipe,
  type AbilityIconRecipeSize,
} from '@/shared/game-art/game-art.recipe';

type Props = {
  code: string;
  size?: AbilityIconRecipeSize;
  className?: string;
  level?: number;
  max?: number;
};

export function AbilityIcon({ code, size = 'md', className, level, max }: Props) {
  const iconUrl = abilityIconSrc(code);
  if (!iconUrl) return null;

  const imgPad = size === 'xs' || size === 'sm' ? 'p-px pb-3.5' : 'p-0.5 pb-4';
  const showProgress = level != null && max != null && max > 0;
  const glyphSize = size === 'xs' || size === 'sm' ? 'compact' : 'roomy';

  return (
    <span className={cn(abilityIconRecipe({ size }), className)}>
      <img src={iconUrl} alt="" className={cn('size-full object-contain', imgPad)} draggable={false} />
      {showProgress ? (
        <span className={iconMetaGlyphRecipe({ size: glyphSize, place: 'bottom-center' })} aria-hidden="true">
          {Math.max(0, Math.round(level))}/{Math.round(max)}
        </span>
      ) : null}
    </span>
  );
}
