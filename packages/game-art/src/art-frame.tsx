import { cn } from '@bombfarm/ui';
import { artFrameRecipe, type ArtFrameRecipeSize } from './game-art.recipe';

export type ArtFrameSize = ArtFrameRecipeSize;
export type ArtFrameShape = 'square' | 'portrait';
export type ArtFrameFill = 'neutral' | 'rarity' | 'plate';

type Props = {
  rarityIdx: number;
  size?: ArtFrameSize;
  shape?: ArtFrameShape;
  fill?: ArtFrameFill;
  className?: string | undefined;
  children: React.ReactNode;
};

const RARITY_VARIANT = [0, 1, 2, 3, 4, 5] as const;

/** Rarity-tinted frame — border encodes rarity; item fill is optional rarity wash. */
export function ArtFrame({
  rarityIdx,
  size = 'md',
  shape = 'square',
  fill = 'neutral',
  className,
  children,
}: Props) {
  const rarity = RARITY_VARIANT[Math.max(0, Math.min(5, Math.round(rarityIdx)))] ?? 2;
  return (
    <span className={cn(artFrameRecipe({ size, shape, fill, rarity }), className)}>
      {children}
    </span>
  );
}
