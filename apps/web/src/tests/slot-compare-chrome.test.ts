import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { slotChromeClassName, slotStatClassName } from '@/features/gear/components/slot-editor';
import { STRINGS, sub } from '@/shared/i18n';
import { setsForLevel, type EquippedItem } from '@bombfarm/domain/gear';
import { setName } from '@bombfarm/domain/game-labels';

const eq = (rarityIdx: number): EquippedItem => ({
  defId: 'crimson_arma',
  rarityIdx,
  level: 40,
  upgrade: 0,
});

describe('slotChromeClassName', () => {
  it('uses neutral solid border when equipped; changed adds inset ring only', () => {
    const changed5 = slotChromeClassName(eq(5), true);
    expect(changed5).not.toMatch(/border-rar-/);
    expect(changed5).toContain('border-line');
    expect(changed5).toContain('border-solid');
    expect(changed5).toContain('shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--accent)_40%,transparent)]');

    const filled3 = slotChromeClassName(eq(3), false);
    expect(filled3).toContain('border-line');
    expect(filled3).toContain('border-solid');
    expect(filled3).not.toContain('shadow-[inset');
  });

  it('omits solid border when empty', () => {
    const emptyChanged = slotChromeClassName(null, true);
    expect(emptyChanged).not.toMatch(/border-rar-/);
    expect(emptyChanged).toContain('shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--accent)_40%,transparent)]');

    const empty = slotChromeClassName(undefined);
    expect(empty).not.toMatch(/border-rar-/);
    expect(empty).not.toContain('shadow-[inset');
    expect(empty).toContain('border-dashed');
  });
});

describe('slotStatClassName', () => {
  it('uses neutral solid border when equipped', () => {
    const rare = slotStatClassName(eq(2));
    expect(rare).not.toMatch(/border-rar-/);
    expect(rare).toContain('border-line');
    expect(rare).toContain('border-solid');
    expect(rare).not.toContain('border-transparent');
  });

  it('keeps transparent dashed border when empty', () => {
    for (const empty of [slotStatClassName(null), slotStatClassName(undefined)]) {
      expect(empty).toContain('border-transparent');
      expect(empty).toContain('border-dashed');
      expect(empty).not.toMatch(/border-rar-/);
      expect(empty).not.toContain('border-solid');
    }
  });
});

describe('gear compare chrome copy', () => {
  it('drops the Was/Era "changed from" label from EN and PT strings', () => {
    for (const lang of ['en', 'pt'] as const) {
      expect(STRINGS[lang]).not.toHaveProperty('changedFrom');
    }
  });

  it('does not render a Was/changed-from line in SlotEditor', () => {
    const src = readFileSync(resolve(__dirname, '../features/gear/components/slot-editor.tsx'), 'utf8');
    expect(src).not.toMatch(/changedFrom/);
    expect(src).not.toMatch(/Was:/);
    expect(src).not.toMatch(/current\?:/);
  });
});

/**
 * #106 — one level means one set (`setsByLevel` is a bijection, guarded in `@bombfarm/domain`),
 * so the set select could only ever offer a single option. It is gone, and the set name rides in
 * the level option's label instead. The composed label is asserted through the REAL catalog and
 * `setName`, not a hand-written string, so a re-key that renames a set is visible here too.
 */
describe('gear slot set select removal', () => {
  const src = readFileSync(resolve(__dirname, '../features/gear/components/slot-editor.tsx'), 'utf8');

  it('renders three selects per slot — level, rarity, forge', () => {
    expect(src.match(/<Select\b/g) ?? []).toHaveLength(3);
    expect(src).toContain('aria-label={t.itemLevel}');
    expect(src).toContain('aria-label={t.itemRarity}');
    expect(src).toContain('aria-label={t.forgeLevel}');
  });

  it('has no set control, and no string left over for one', () => {
    expect(src).not.toContain('itemSet');
    for (const lang of ['en', 'pt'] as const) {
      expect(STRINGS[lang]).not.toHaveProperty('itemSet');
    }
  });

  it('still derives the set from the level, in the label and on change', () => {
    expect(src).toContain('setName(setsForLevel(levelOption)[0]');
    expect(src).toContain('setsForLevel(next)[0]');
  });

  it('composes "Level 300 - Void" / "Nível 300 - Vazio" from the catalog', () => {
    const composed = (lang: 'en' | 'pt', level: number) =>
      sub(STRINGS[lang].itemLevelOpt, { n: level, set: setName(setsForLevel(level)[0] ?? '', lang) });
    expect(composed('en', 300)).toBe('Level 300 - Void');
    expect(composed('pt', 300)).toBe('Nível 300 - Vazio');
    // The lowest level too, so the assertion is not resting on one lucky row.
    expect(composed('en', 10)).toBe(`Level 10 - ${setName('ember', 'en')}`);
    expect(composed('pt', 10)).toBe(`Nível 10 - ${setName('ember', 'pt')}`);
  });
});

describe('slot changed chrome', () => {
  it('uses inset ring for changed without accent border utility', () => {
    const cls = slotChromeClassName(eq(4), true);
    expect(cls).toContain('shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--accent)_40%,transparent)]');
    expect(cls).not.toMatch(/border-accent(?!-)/);
  });
});
