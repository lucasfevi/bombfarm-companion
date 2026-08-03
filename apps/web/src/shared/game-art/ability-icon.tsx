import { abilityIconSrc } from '@bombfarm/domain/wiki-assets';

import { cn } from '@bombfarm/ui';
import {
  abilityIconRecipe,
  type AbilityIconRecipeSize,
} from '@/shared/game-art/game-art.recipe';

type Props = {
  code: string;
  size?: AbilityIconRecipeSize;
  className?: string;
};

export function AbilityIcon({ code, size = 'xs', className }: Props) {
  const iconUrl = abilityIconSrc(code);
  if (!iconUrl) return null;

  const imgPad = size === 'lg' || size === 'md' ? 'p-0.5' : 'p-px';

  return (
    <span className={cn(abilityIconRecipe({ size }), className)}>
      <img src={iconUrl} alt="" className={cn('size-full object-contain', imgPad)} draggable={false} />
    </span>
  );
}
