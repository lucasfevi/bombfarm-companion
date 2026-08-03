import { cn } from '@bombfarm/ui';
import { artFrameRecipe, type ArtFrameRecipeSize } from '@/shared/game-art/game-art.recipe';

export type ArtFrameSize = ArtFrameRecipeSize;

type Props = {
  rarityIdx: number;
  size?: ArtFrameSize;
  className?: string;
  children: React.ReactNode;
};

const RARITY_VARIANT = [0, 1, 2, 3, 4, 5] as const;

/** Square rarity-tinted frame — border encodes rarity; no crystal overlay. */
export function ArtFrame({ rarityIdx, size = 'md', className, children }: Props) {
  const rarity = RARITY_VARIANT[Math.max(0, Math.min(5, Math.round(rarityIdx)))] ?? 2;
  return (
    <span className={cn(artFrameRecipe({ size, rarity }), className)}>
      {children}
    </span>
  );
}
