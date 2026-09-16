import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PvpDuelRow, PvpHistoryResult } from '@bombfarm/contracts';
import { en } from '../../lib/copy/en';

vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return { ...actual, useCopy: () => en, useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }) };
});

const filters = vi.hoisted(() => ({ opponent: '', setOpponent: vi.fn() }));

vi.mock('../../lib/pvp/use-pvp-filters', () => ({
  usePvpFilters: () => ({ opponent: filters.opponent, result: 'all', setOpponent: filters.setOpponent, setResult: () => undefined }),
}));

const { RivalsPanel } = await import('./rivals-panel');

function row(id: number, defender: string, won: boolean, yours = 100, theirs = 50, minutesAgo = 5): PvpDuelRow {
  return {
    id,
    recordedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    accountId: null,
    filmStored: false,
    won,
    phase: 120,
    filmId: 0,
    rooms: 0,
    seconds: 60,
    attacker: { name: 'Me', heroes: 9, score: yours },
    defender: { name: defender, heroes: 8, score: theirs },
    pointsBefore: 0,
    pointsAfter: won ? 5 : -10,
    duelsLeft: 1,
    duelsMax: 10,
    prize: 'won',
    tier: 'r2',
    tierFloor: 50,
    squadHeroIds: [],
  };
}

function history(rows: PvpDuelRow[]): PvpHistoryResult {
  return {
    rows,
    totals: { duels: rows.length, won: rows.filter((r) => r.won).length, films: 0 },
    standing: null,
    rank: null,
  };
}

function render(rows: PvpDuelRow[] | null, fill = false): string {
  return renderToStaticMarkup(createElement(RivalsPanel, { history: rows === null ? null : history(rows), fill }));
}

describe('RivalsPanel', () => {
  it('prints one row per opponent with the record, the summed margin and the last result, worst record first', () => {
    const html = render([
      row(1, 'Ana', true, 120, 100),
      row(2, 'Ana', true, 130, 100, 60),
      row(3, 'Bruno', false, 80, 100),
      row(4, 'Bruno', true, 90, 100, 120),
      row(5, 'Caio', false, 50, 100, 3),
    ]);
    expect(html).toContain('data-testid="pvp-rivals" data-state="rivals"');
    expect(html).toContain(en.pvpRivalsNote);
    expect(html.match(/data-testid="pvp-rival-row"/g)).toHaveLength(3);
    expect(html.indexOf('data-opponent="Caio"')).toBeLessThan(html.indexOf('data-opponent="Bruno"'));
    expect(html.indexOf('data-opponent="Bruno"')).toBeLessThan(html.indexOf('data-opponent="Ana"'));

    expect(html).toMatch(/data-testid="pvp-rival-record" class="font-mono text-up">2–0</);
    expect(html).toMatch(/data-testid="pvp-rival-record" class="font-mono">1–1</);
    expect(html).toMatch(/data-testid="pvp-rival-record" class="font-mono text-down">0–1</);

    expect(html).toMatch(/data-testid="pvp-rival-margin" class="text-up">\+25\.0%</);
    expect(html).toMatch(/data-testid="pvp-rival-margin" class="text-down">-15\.0%</);
    expect(html).toMatch(/data-testid="pvp-rival-margin" class="text-down">-50\.0%</);

    expect(html).toContain('won 5m ago');
    expect(html).toContain('lost 5m ago');
    expect(html).toContain('lost 3m ago');
  });

  it('marks the opponent the filter already names as pressed', () => {
    filters.opponent = 'Ana';
    try {
      const html = render([row(1, 'Ana', true), row(2, 'Bruno', true)]);
      expect(html).toMatch(/data-opponent="Ana" data-chosen="true"/);
      expect(html).toMatch(/data-opponent="Bruno" data-chosen="false"/);
      expect(html).toContain('aria-pressed="true"');
    } finally {
      filters.opponent = '';
    }
  });

  it('prints a dash for the margin while the opponent has scored nothing', () => {
    const html = render([row(1, 'Ana', true, 100, 0), row(2, 'Bruno', true)]);
    expect(html).toMatch(/data-testid="pvp-rival-margin" class=""><span aria-hidden="true">—<\/span>/);
  });

  it('caps the table at eight scrolling rows alone, and lets it fill the replay beside it on a wide window', () => {
    const rows = [row(1, 'Ana', true), row(2, 'Bruno', false)];
    const alone = render(rows);
    expect(alone).toMatch(/class="isolate min-h-0 overflow-auto" style="max-height:calc\(2rem \* 8\)"/);
    expect(alone).not.toContain('data-fill=');
    const beside = render(rows, true);
    expect(beside).toContain('data-testid="pvp-rivals" data-state="rivals" data-fill="replay"');
    expect(beside).toMatch(/<section class="[^"]*xl:flex xl:h-full xl:min-h-0 xl:flex-col"[^>]*data-fill="replay"/);
    expect(beside).toContain('class="isolate min-h-0 overflow-auto max-h-[calc(2rem*8)] xl:max-h-none xl:flex-1"');
    expect(beside).not.toContain('style="max-height');
  });

  it('says rivals need two opponents instead of drawing a one-row table, and the same with no history at all', () => {
    for (const rows of [[row(1, 'Ana', true), row(2, 'Ana', false)], [], null]) {
      const html = render(rows);
      expect(html).toContain('data-testid="pvp-rivals" data-state="few"');
      expect(html).toContain(en.pvpRivalsFew);
      expect(html).not.toContain('data-testid="pvp-rival-row"');
      expect(html).not.toContain(en.pvpRivalsNote);
    }
  });
});
