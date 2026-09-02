import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Copy } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import type { LiveFastModel, LiveSlowModel } from '../../lib/live/live-model';
import { EMPTY_LIVE_FAST_MODEL } from '../../lib/live/live-model';
import { MiniHeroes } from './mini-heroes';

type LocaleView = ReturnType<typeof import('../../lib/copy').useLocale>;

const copy: { value: Copy } = { value: en };
const locale: { value: LocaleView } = { value: { locale: 'en', lang: 'en', bcp47: 'en-US' } };

vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return {
    ...actual,
    useCopy: () => copy.value,
    useLocale: () => locale.value,
  };
});

const SLOW: LiveSlowModel = {
  onField: [{ id: 'hero-a', name: 'Astra', grade: 'S', level: 61, rarity: 4, energyFraction: 0.42 }],
  recovering: [{ id: 'hero-b', name: 'Blaze', grade: 'A', level: 55, rarity: 3, energyFraction: 0.8 }],
  queued: [{ id: 'hero-c', name: 'Cinder', grade: 'B', level: 40, rarity: 2 }],
  benched: [{ id: 'hero-d', name: 'Dusk', grade: 'C', level: 12, rarity: 1 }],
  unclassifiedCount: 0,
  fieldExitPendingCount: 0,
  occupancy: { occupied: 1, fieldSize: 3 },
  house: { slots: 2, slotsMax: 4 },
};

const FAST: LiveFastModel = {
  field: { 'hero-a': { heroId: 'hero-a', secondsRemaining: 120, basis: 'observed' } },
  recovery: { 'hero-b': { heroId: 'hero-b', secondsRemaining: 45, advancing: true } },
  energy: { 'hero-a': 0.42, 'hero-b': 0.8 },
};

function html(slow: LiveSlowModel | null, fast: LiveFastModel = EMPTY_LIVE_FAST_MODEL): string {
  return renderToStaticMarkup(createElement(MiniHeroes, { slow, fast }));
}

function inPortuguese(render: () => string): string {
  copy.value = ptBR;
  locale.value = { locale: 'pt-BR', lang: 'pt', bcp47: 'pt-BR' };
  try {
    return render();
  } finally {
    copy.value = en;
    locale.value = { locale: 'en', lang: 'en', bcp47: 'en-US' };
  }
}

describe('MiniHeroes', () => {
  it('renders an energy bar per row', () => {
    const out = html(SLOW, FAST);
    expect(out).toContain('data-testid="live-hero-row-hero-a-energy-bar"');
    expect(out).toContain('data-testid="live-hero-row-hero-b-energy-bar"');
  });

  it('keeps the heroes section scrollable and filling the leftover height', () => {
    const out = html(SLOW, FAST);
    expect(out).toMatch(/data-testid="mini-heroes"[^>]*overflow-auto/);
    expect(out).toMatch(/data-testid="mini-heroes"[^>]*flex-1/);
  });

  it('prints the hero name, which the collapsed name column used to render as nothing', () => {
    const out = html(SLOW, FAST);
    expect(out).toContain('data-testid="live-hero-row-hero-a-name"');
    expect(out).toContain('Astra');
    expect(out).toContain('Cinder');
  });

  it('prints rank and level beside the name', () => {
    const out = html(SLOW, FAST);
    expect(out).toContain('>S<');
    expect(out).toContain('Lv 61');
    expect(out).toContain('Lv 40');
  });

  it('uses the Portuguese level prefix under a Portuguese UI', () => {
    const out = inPortuguese(() => html(SLOW, FAST));
    expect(out).toContain('Nv 61');
    expect(out).not.toContain('Lv 61');
  });

  it('withholds a rank when the roster join has not named the hero', () => {
    const out = html({ ...SLOW, onField: [{ id: 'hero-x', grade: 'S', level: 9 }], recovering: [] });
    expect(out).not.toContain('>S<');
  });

  it('marks every rotation state with a shape and a screen-reader word, never colour alone', () => {
    const out = html(SLOW, FAST);
    const marks: readonly (readonly [string, string])[] = [
      ['bg-up', en.liveListOnFieldTitle],
      ['border-info', en.liveListRecoveringTitle],
      ['bg-warn', en.liveListQueuedTitle],
      ['bg-muted', en.liveListBenchedTitle],
    ];
    for (const [shape, label] of marks) {
      expect(out, shape).toContain(shape);
      expect(out, label).toContain(`class="sr-only">${label}<`);
    }
  });

  it('puts the energy reading at the head of the bar it describes, not at the row edge', () => {
    const out = html(SLOW, FAST);
    const level = out.indexOf('Lv 61');
    const reading = out.indexOf('live-hero-row-hero-a-energy"', level);
    const bar = out.indexOf('live-hero-row-hero-a-energy-bar', level);
    expect(level).toBeGreaterThan(-1);
    expect(reading).toBeGreaterThan(level);
    expect(bar).toBeGreaterThan(reading);
  });

  it('holds the reading in a slot wide enough for a three-digit percentage', () => {
    const out = html(SLOW, FAST);
    expect(out).toMatch(/data-testid="live-hero-row-hero-a-energy" class="[^"]*\bw-8\b[^"]*text-right/);
  });

  it('gives the level its own fixed slot, so a three-digit level cannot shift the reading beside it', () => {
    const wide = html({
      ...SLOW,
      onField: [{ id: 'hero-a', name: 'Astra', grade: 'S', level: 106, rarity: 4, energyFraction: 0.42 }],
    });
    expect(wide).toContain('Lv 106');
    expect(wide).toMatch(/class="[^"]*\bw-10\b[^"]*"[^>]*>Lv 106</);
  });

  it('separates neighbouring rows with an alternating tint rather than running them together', () => {
    const out = html(SLOW, FAST);
    const rows = out.match(/<li data-testid="live-hero-row-[^"]*" class="([^"]*)"/g) ?? [];
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row).toContain('odd:bg-');
    }
  });

  it('gives every row one fixed height so a missing reading cannot make it taller', () => {
    const out = html(SLOW, FAST);
    const rows = out.match(/<li data-testid="live-hero-row-[^"]*" class="[^"]*"/g) ?? [];
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row).toContain('h-9');
    }
  });

  it('prints a dash for an absent energy reading and carries the words for a screen reader', () => {
    const out = html(SLOW, FAST);
    expect(out).toMatch(/data-testid="live-hero-row-hero-c-energy"[^>]*><span aria-hidden="true">—/);
    expect(out).toContain(`class="sr-only">${en.valueNotAvailable}<`);
  });

  it('shows the empty-list copy when there are no rows', () => {
    const out = html({ ...SLOW, onField: [], recovering: [], queued: [], benched: [] });
    expect(out).toContain(en.liveListEmptyLine);
    expect(out).toContain('data-testid="live-hero-list-empty"');
  });
});
