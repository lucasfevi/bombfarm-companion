import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { en } from '../../lib/copy/en';
import { equipConfirmCopy, forgeConfirmCopy, pointsConfirmCopy, type ApplyPointsConfirmHero } from './apply-confirms';

const gold = (amount: number) => String(amount);

function descriptionHtml(node: React.ReactNode): string {
  return renderToStaticMarkup(createElement('div', null, node));
}

describe('equipConfirmCopy', () => {
  it('names the cost on the primary label, with the cancel label "Not now"', () => {
    const copy = equipConfirmCopy(4, false, en);
    expect(copy.title).toBe(en.applyConfirmEquipTitle);
    expect(copy.confirmLabel).toBe('Equip 4 items — no gold');
    expect(copy.cancelLabel).toBe(en.applyConfirmCancel);
  });

  it('carries the queue-pauses sentence only when the queue is running', () => {
    expect(descriptionHtml(equipConfirmCopy(1, false, en).description)).not.toContain(en.applyConfirmQueuePauses);
    expect(descriptionHtml(equipConfirmCopy(1, true, en).description)).toContain(en.applyConfirmQueuePauses);
  });
});

const RESPEC_HERO: ApplyPointsConfirmHero = { index: 0, name: 'Bram', level: 90, needsRespec: true, points: 12, gold: 500, skipReason: null };
const PLACE_HERO: ApplyPointsConfirmHero = { index: 1, name: 'Orin', level: 60, needsRespec: false, points: 4, gold: 0, skipReason: null };
const SKIPPED_HERO: ApplyPointsConfirmHero = { index: 2, name: 'Vex', level: 40, needsRespec: true, points: 0, gold: 0, skipReason: 'heroMissing' };

describe('pointsConfirmCopy', () => {
  it('spends the sum of every pending respec on the primary label', () => {
    const copy = pointsConfirmCopy([RESPEC_HERO, PLACE_HERO], false, en, gold);
    expect(copy.confirmLabel).toBe('Reset points — spends 500');
  });

  it('lists a respec hero, a place-only hero and a skipped hero as their own lines, respec first per the full-charge sentence', () => {
    const html = descriptionHtml(pointsConfirmCopy([RESPEC_HERO, PLACE_HERO, SKIPPED_HERO], false, en, gold).description);
    expect(html.indexOf(en.applyConfirmPointsBody)).toBeLessThan(html.indexOf('Bram'));
    expect(html).toContain('Bram · level 90 · respec, then place 12 points · 500');
    expect(html).toContain('Orin · level 60 · place 4 unspent points · free');
    expect(html).toContain(`Vex · skipped — ${en.applySkipHeroMissing}`);
  });

  it('carries the queue-pauses sentence only when the queue is running', () => {
    expect(descriptionHtml(pointsConfirmCopy([RESPEC_HERO], false, en, gold).description)).not.toContain(en.applyConfirmQueuePauses);
    expect(descriptionHtml(pointsConfirmCopy([RESPEC_HERO], true, en, gold).description)).toContain(en.applyConfirmQueuePauses);
  });
});

describe('forgeConfirmCopy', () => {
  it('adds to the queue with no gold suffix, and never carries the queue-pauses sentence', () => {
    const copy = forgeConfirmCopy(3, en);
    expect(copy.confirmLabel).toBe('Add 3 to queue');
    expect(copy.title).toBe(en.applyConfirmForgeTitle);
    expect(descriptionHtml(copy.description)).not.toContain(en.applyConfirmQueuePauses);
  });
});
