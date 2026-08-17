import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { slotChromeClassName, slotStatClassName } from '@/features/gear/components/slot-editor';
import { STRINGS } from '@/shared/i18n';
import type { EquippedItem } from '@bombfarm/domain/gear';

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

describe('slot changed chrome', () => {
  it('uses inset ring for changed without accent border utility', () => {
    const cls = slotChromeClassName(eq(4), true);
    expect(cls).toContain('shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--accent)_40%,transparent)]');
    expect(cls).not.toMatch(/border-accent(?!-)/);
  });
});
