import type { ReactNode } from 'react';
import { abilityIconSrc } from '@bombfarm/domain/wiki-assets';

import { cn } from '@bombfarm/ui';
import {
  abilityIconRecipe,
  iconMetaGlyphRecipe,
  type AbilityIconRecipeSize,
  type IconMetaGlyphSize,
} from './game-art.recipe';
import { abilityPeekSpec, type AbilityIconPeek } from './peek/ability-peek';
import { usePeek } from './peek/use-peek';

/**
 * Where the level badge sits. `below-art` pads the sprite up to give the badge its own strip;
 * `over-art` prints it on the sprite with the item tiles' halo, so a strip that toggles its levels
 * never resizes its art.
 */
export type AbilityLevelPlacement = 'below-art' | 'over-art';

type Props = {
  code: string;
  size?: AbilityIconRecipeSize;
  className?: string;
  level?: number;
  max?: number;
  levelPlacement?: AbilityLevelPlacement;
  /** Drawn over the tile, unclipped by it, and lifted with it when the tile answers a hover. */
  adornment?: ReactNode;
  /** Open the ability's card on hover. Absent, the tile is bare art. */
  peek?: AbilityIconPeek | undefined;
};

export function AbilityIcon({ code, size = 'md', className, level, max, levelPlacement = 'below-art', adornment, peek }: Props) {
  const iconUrl = abilityIconSrc(code);
  const spec = peek === undefined || !iconUrl ? undefined : abilityPeekSpec(code, peek);
  const tile = iconUrl ? renderTile(iconUrl, { size, className, level, max, levelPlacement }) : null;
  // The hover lift moves the trigger's one child, so an adornment has to be inside that child to
  // move with the art rather than stay behind.
  const art =
    tile !== null && adornment !== undefined ? (
      <span className="relative inline-flex rounded-sm" data-slot="ability-adorned">
        {tile}
        {adornment}
      </span>
    ) : (
      tile
    );
  return usePeek(spec, art);
}

type TileOptions = {
  size: AbilityIconRecipeSize;
  className: string | undefined;
  level: number | undefined;
  max: number | undefined;
  levelPlacement: AbilityLevelPlacement;
};

function overArtGlyphSize(size: AbilityIconRecipeSize): IconMetaGlyphSize {
  if (size === 'xs') return 'tiny';
  return size === 'sm' ? 'compact' : 'roomy';
}

function renderTile(iconUrl: string, { size, className, level, max, levelPlacement }: TileOptions) {
  const showProgress = level != null && max != null && max > 0;
  const compact = size === 'xs' || size === 'sm';
  const overArt = levelPlacement === 'over-art';
  // The extra bottom padding is the badge's seat, so it is only taken when a badge sits in it —
  // an icon drawn without a level was reserving a strip of empty tile under the sprite.
  const pad = compact ? 'p-px' : 'p-0.5';
  const imgPad = showProgress && !overArt ? `${pad} ${compact ? 'pb-3.5' : 'pb-4'}` : pad;
  const glyphSize = overArt ? overArtGlyphSize(size) : compact ? 'compact' : 'roomy';

  return (
    <span className={cn(abilityIconRecipe({ size }), className)}>
      <img src={iconUrl} alt="" className={cn('size-full object-contain', imgPad)} draggable={false} />
      {showProgress ? (
        <span
          className={iconMetaGlyphRecipe({ size: glyphSize, place: 'bottom-center' })}
          aria-hidden="true"
          data-slot="ability-level"
        >
          {Math.max(0, Math.round(level))}/{Math.round(max)}
        </span>
      ) : null}
    </span>
  );
}
