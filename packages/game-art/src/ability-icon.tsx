import { abilityIconSrc } from '@bombfarm/domain/wiki-assets';

import { cn } from '@bombfarm/ui';
import {
  abilityIconRecipe,
  iconMetaGlyphRecipe,
  type AbilityIconRecipeSize,
} from './game-art.recipe';

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

  const showProgress = level != null && max != null && max > 0;
  const compact = size === 'xs' || size === 'sm';
  // The extra bottom padding is the badge's seat, so it is only taken when a badge sits in it —
  // an icon drawn without a level was reserving a strip of empty tile under the sprite.
  const pad = compact ? 'p-px' : 'p-0.5';
  const imgPad = showProgress ? `${pad} ${compact ? 'pb-3.5' : 'pb-4'}` : pad;
  const glyphSize = compact ? 'compact' : 'roomy';

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
