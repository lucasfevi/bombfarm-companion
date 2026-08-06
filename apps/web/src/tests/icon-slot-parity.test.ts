import { describe, expect, it } from 'vitest';
import { SLOTS } from '@bombfarm/domain/gear';
import { iconSources, type IconName } from '@bombfarm/ui';

function slotGlyphIds(): string[] {
  return (Object.keys(iconSources) as IconName[])
    .filter((name) => iconSources[name] === 'game' && name.startsWith('slot-'))
    .map((name) => name.slice('slot-'.length));
}

describe('slot glyph ids mirror domain SLOTS (ICO-18)', () => {
  it('has exactly eight slot-* game glyph names', () => {
    const slotIds = slotGlyphIds();
    expect(slotIds).toHaveLength(8);
    for (const id of slotIds) {
      expect(id).not.toContain('-');
    }
  });

  it('matches the domain Slot key set exactly', () => {
    const glyphSlots = new Set(slotGlyphIds());
    const domainSlots = new Set(SLOTS);

    for (const slot of domainSlots) {
      if (!glyphSlots.has(slot)) {
        expect.fail(`domain slot "${slot}" has no slot-${slot} glyph id`);
      }
    }

    for (const id of glyphSlots) {
      if (!domainSlots.has(id as (typeof SLOTS)[number])) {
        expect.fail(`glyph id "slot-${id}" is not a domain Slot key`);
      }
    }

    expect(glyphSlots.size).toBe(domainSlots.size);
  });
});
