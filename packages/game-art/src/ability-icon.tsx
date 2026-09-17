import { abilityIconSrc } from '@bombfarm/domain/wiki-assets';

import { cn } from '@bombfarm/ui';
import {
  abilityIconRecipe,
  iconMetaGlyphRecipe,
  type AbilityIconRecipeSize,
} from './game-art.recipe';
import { abilityPeekSpec, type AbilityIconPeek } from './peek/ability-peek';
import { usePeek } from './peek/use-peek';

type Props = {
  code: string;
  size?: AbilityIconRecipeSize;
  className?: string;
  level?: number;
  max?: number;
  /** Open the ability's card on hover. Absent, the tile is bare art. */
  peek?: AbilityIconPeek | undefined;
};

export function AbilityIcon({ code, size = 'md', className, level, max, peek }: Props) {
  const iconUrl = abilityIconSrc(code);
  const spec = peek === undefined || !iconUrl ? undefined : abilityPeekSpec(code, peek);
  const art = iconUrl ? renderTile(iconUrl, size, className, level, max) : null;
  return usePeek(spec, art);
}

function renderTile(iconUrl: string, size: AbilityIconRecipeSize, className: string | undefined, level?: number, max?: number) {
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
