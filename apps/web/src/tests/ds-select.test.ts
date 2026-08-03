import { describe, expect, it } from 'vitest';
import {
  selectAffixClass,
  selectFieldRecipe,
  selectItemClass,
  selectPopupClass,
  selectValueClass,
} from '@bombfarm/ui/select.recipe';

describe('selectFieldRecipe', () => {
  it('defaults to the default size shell', () => {
    expect(selectFieldRecipe()).toBe(selectFieldRecipe({ size: 'default' }));
    expect(selectFieldRecipe()).toContain('min-h-[34px]');
    expect(selectFieldRecipe()).toContain('border-line');
  });

  it('emits compact size for dense gear slots', () => {
    expect(selectFieldRecipe({ size: 'compact' })).toContain('min-h-[26px]');
    expect(selectFieldRecipe({ size: 'compact' })).toContain('text-[11px]');
  });
});

describe('select chrome constants', () => {
  it('keeps left affix + themed popup/item surfaces', () => {
    expect(selectAffixClass).toContain('bg-bg-2');
    expect(selectAffixClass).toContain('border-r');
    expect(selectValueClass).toContain('truncate');
    expect(selectPopupClass).toContain('bg-surface');
    expect(selectPopupClass).toContain('border-line');
    expect(selectItemClass).toContain('data-[highlighted]');
    expect(selectItemClass).toContain('text-ink');
  });
});
