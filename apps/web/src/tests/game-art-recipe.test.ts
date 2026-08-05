import { describe, expect, it } from 'vitest';
import { artFrameRecipe, abilityIconRecipe, forgeUpgradeBadgeClass, rosterIconTooltipTriggerClass } from '@/shared/game-art/game-art.recipe';

describe('game-art.recipe', () => {
  it('artFrameRecipe encodes rarity border and radius', () => {
    expect(artFrameRecipe({ size: 'md', rarity: 3 })).toContain('border-rar-3');
    expect(artFrameRecipe({ size: 'xl', rarity: 0 })).toContain('rounded-sm');
    expect(artFrameRecipe({ size: 'xs', rarity: 0 })).toContain('size-7');
  });

  it('forge badge halos glyphs without a box border', () => {
    expect(forgeUpgradeBadgeClass).toContain('text-shadow');
    expect(forgeUpgradeBadgeClass).not.toContain('border-line');
    expect(forgeUpgradeBadgeClass).toContain('bg-transparent');
  });

  it('abilityIconRecipe uses neutral border and shared radius', () => {
    expect(abilityIconRecipe({ size: 'xs' })).toContain('border-line');
    expect(abilityIconRecipe({ size: 'lg' })).toContain('rounded-sm');
    expect(abilityIconRecipe({ size: 'lg' })).toContain('size-11');
  });

  it('rosterIconTooltipTriggerClass is borderless chrome for icon tooltips', () => {
    expect(rosterIconTooltipTriggerClass).toContain('bg-transparent');
    expect(rosterIconTooltipTriggerClass).toContain('border-0');
  });
});
