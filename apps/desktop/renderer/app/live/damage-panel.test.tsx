import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UNATTRIBUTED_REASONS } from '@bombfarm/contracts';
import type { AppLocale, CreditAmounts, LiveDamage, LiveDamageHeroRow, UnattributedReason } from '@bombfarm/contracts';
import { CopyProvider, STRINGS, sub } from '../../lib/copy';
import type { LiveHeroFact } from '../../lib/live/live-model';
import { DamagePanel } from './damage-panel';
import { EarningsPanel } from './earnings-panel';

const LOCALES: readonly AppLocale[] = ['en', 'pt-BR'];

const NO_CREDIT: CreditAmounts = { damage: 0, props: 0, gold: 0 };

function heroRow(overrides: Partial<LiveDamageHeroRow> & { heroId: string }): LiveDamageHeroRow {
  return { dps: 1_500, damage: 900_000, props: 120, gold: 45_000, onField: true, ...overrides };
}

function damage(overrides: Partial<LiveDamage> = {}): LiveDamage {
  return {
    teamDps10: 2_400,
    teamDpsSession: 1_900,
    coverageSeconds: 120,
    sessionSeconds: 600,
    heroes: [heroRow({ heroId: 'astra' }), heroRow({ heroId: 'borealis', dps: 800, damage: 400_000, props: 60, gold: 20_000 })],
    unattributed: { damage: 50_000, props: 9, gold: 3_000 },
    unattributedReasons: Object.fromEntries(UNATTRIBUTED_REASONS.map((reason) => [reason, NO_CREDIT])) as Record<
      UnattributedReason,
      CreditAmounts
    >,
    team: { damage: 1_350_000, props: 189, gold: 68_000 },
    ...overrides,
  };
}

const FACTS: ReadonlyMap<string, LiveHeroFact> = new Map([
  ['astra', { id: 'astra', name: 'Astra', grade: 'S', level: 90, rarity: 2, stars: 1, skin: 0 }],
  ['borealis', { id: 'borealis', name: 'Borealis', grade: 'A', level: 80, rarity: 1, stars: 0, skin: 0 }],
]);

function html(
  data: LiveDamage | null,
  { locale = 'en', facts = FACTS, fieldSize }: { locale?: AppLocale; facts?: ReadonlyMap<string, LiveHeroFact>; fieldSize?: number | undefined } = {},
) {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(DamagePanel, { damage: data, heroFacts: facts, fieldSize }),
    }),
  );
}

/** The inner HTML of the one element carrying `data-testid`, found by matching its tag name's
 *  opening and closing tags — enough for the table and div wrappers this panel draws. */
function innerOf(out: string, testId: string): string {
  const open = out.match(new RegExp(`<([a-zA-Z0-9]+)[^>]*data-testid="${testId}"[^>]*>`));
  if (!open) throw new Error(`no element with data-testid="${testId}" in:\n${out}`);
  const tag = open[1];
  const rest = out.slice((open.index ?? 0) + open[0].length);
  const tokens = /<(\/)?([a-zA-Z0-9]+)[^>]*?(\/)?>/g;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(rest))) {
    const [, closing, name, selfClosing] = match;
    if (name !== tag || selfClosing) continue;
    if (closing) {
      if (depth === 0) return rest.slice(0, match.index);
      depth -= 1;
    } else {
      depth += 1;
    }
  }
  throw new Error(`unterminated element ${testId}`);
}

const HEAD_HEIGHT_PX = 32;
const ROW_HEIGHT_PX = 40;

/** Evaluates the `calc(calc(A px + B px / N) * N)` the scroller carries for one of its height
 *  limits, so a test asserts the pixels it reserves and not the way that sum is spelled. */
function reservedPx(tag: string, property: 'min-height' | 'max-height'): number {
  const expression = new RegExp(`${property}:calc\\(calc\\(([\\d.]+)px \\+ ([\\d.]+)px / (\\d+)\\) \\* (\\d+)\\)`).exec(tag);
  if (expression === null) throw new Error(`no ${property} in ${tag}`);
  const [, row, head, slots, rows] = expression.map(Number);
  return ((row ?? 0) + (head ?? 0) / (slots ?? 1)) * (rows ?? 0);
}

function textOf(markup: string): string {
  return markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function cellsOf(out: string, testId: string): string[] {
  return [...innerOf(out, testId).matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => textOf(match[1] ?? ''));
}

describe('DamagePanel', () => {
  it.each(LOCALES)('is titled with the locale word for damage in %s', (locale) => {
    expect(textOf(html(damage(), { locale }).match(/<h2[^>]*>[\s\S]*?<\/h2>/)?.[0] ?? '')).toBe(
      STRINGS[locale].liveDamageTitle,
    );
    expect(STRINGS.en.liveDamageTitle).toBe('Damage');
    expect(STRINGS['pt-BR'].liveDamageTitle).toBe('Dano');
  });

  it.each(LOCALES)('shows Team DPS for the recent window and for the session, each under its own caption in %s', (locale) => {
    const out = html(damage({ coverageSeconds: 120, teamDps10: 2_400, teamDpsSession: 1_900 }), { locale });
    const t = STRINGS[locale];
    const team = textOf(innerOf(out, 'live-damage-team'));

    expect(team).toContain(`${t.liveDamageTeamDpsLabel} ${sub(t.liveEarningsRecentWindowLabel, { minutes: 2 })}`);
    expect(team).toContain(`${t.liveDamageTeamDpsLabel} ${t.liveDamageSessionWindowLabel}`);
    expect(textOf(innerOf(out, 'live-damage-team-dps-10'))).toBe(locale === 'en' ? '2.4k' : '2,4k');
    expect(textOf(innerOf(out, 'live-damage-team-dps-session'))).toBe(locale === 'en' ? '1.9k' : '1,9k');
  });

  it.each([0, 15, 59, 120, 599, 600, 5_000])(
    'labels a coverage of %d seconds exactly as the earnings panel does',
    (coverageSeconds) => {
      const earnings = renderToStaticMarkup(
        createElement(EarningsPanel, {
          freshness: { kind: 'live' },
          onReset: () => undefined,
          earnings: {
            goldBalance: 1,
            goldBalanceCapturedAt: null,
            gold10: 1,
            goldSession: 1,
            xp10: 1,
            xpSession: 1,
            goldSessionTotal: 1,
            xpSessionTotal: 1,
            gold10Series: [],
            goldPerProp10: 1,
            propsPerMinute10: 1,
            propsSessionTotal: 1,
            coverageSeconds,
            sessionSeconds: 1,
          },
        }),
      );
      const label = textOf(innerOf(earnings, 'live-earnings-recent-window-label'));

      expect(textOf(innerOf(html(damage({ coverageSeconds })), 'live-damage-team'))).toContain(label);
    },
  );

  it.each(LOCALES)('prints an em dash for every absent figure in %s, never a zero', (locale) => {
    const out = html(
      damage({ teamDps10: null, teamDpsSession: null, heroes: [heroRow({ heroId: 'astra', dps: null })] }),
      { locale },
    );

    expect(textOf(innerOf(out, 'live-damage-team-dps-10'))).toBe('—');
    expect(textOf(innerOf(out, 'live-damage-team-dps-session'))).toBe('—');
    expect(cellsOf(out, 'live-damage-row-astra')[1]).toBe('—');
  });

  it('prints em dashes for both team figures before any damage has arrived', () => {
    const out = html(null);

    expect(textOf(innerOf(out, 'live-damage-team-dps-10'))).toBe('—');
    expect(textOf(innerOf(out, 'live-damage-team-dps-session'))).toBe('—');
  });

  it.each([
    ['en', '1.2m', '3.4k'],
    ['pt-BR', '1,2m', '3,4k'],
  ] as const)('writes DPS, props and gold in the compact form of %s', (locale, millions, thousands) => {
    const out = html(
      damage({ heroes: [heroRow({ heroId: 'astra', dps: 1_234_567, props: 3_400, gold: 1_234_567 })] }),
      { locale },
    );

    expect(cellsOf(out, 'live-damage-row-astra').slice(1)).toEqual([millions, thousands, millions]);
  });

  it('lists the rows in the order the slice gives them, without sorting or recomputing anything', () => {
    const out = html(
      damage({
        heroes: [
          heroRow({ heroId: 'borealis', dps: 5, damage: 1, props: 1, gold: 1 }),
          heroRow({ heroId: 'astra', dps: 7, damage: 9_000_000_000, props: 2, gold: 2 }),
        ],
      }),
    );

    expect(out.indexOf('live-damage-row-borealis"')).toBeLessThan(out.indexOf('live-damage-row-astra"'));
    expect(cellsOf(out, 'live-damage-row-astra').slice(1)).toEqual(['7', '2', '2']);
    expect(cellsOf(out, 'live-damage-row-borealis').slice(1)).toEqual(['5', '1', '1']);
  });

  it('draws each row as identity, Hero DPS, props and gold', () => {
    const out = html(damage());

    expect(cellsOf(out, 'live-damage-row-astra')[0]).toContain('Astra');
    expect(cellsOf(out, 'live-damage-row-astra').slice(1)).toEqual(['1.5k', '120', '45k']);
    expect(textOf(innerOf(out, 'live-damage-row-astra-name'))).toBe('Astra');
  });

  it('shows a hero the roster join does not know by its id', () => {
    const out = html(damage({ heroes: [heroRow({ heroId: 'hero-404' })] }), { facts: new Map() });

    expect(textOf(innerOf(out, 'live-damage-row-hero-404-name'))).toBe('hero-404');
    expect(cellsOf(out, 'live-damage-row-hero-404')[0]).toContain('—');
  });

  it.each(LOCALES)('heads the columns hero, DPS, props and gold in %s', (locale) => {
    const t = STRINGS[locale];
    const head = textOf(innerOf(html(damage(), { locale }), 'live-damage-scroller').match(/<thead[\s\S]*?<\/thead>/)?.[0] ?? '');

    expect(head).toBe([t.liveDamageHeroColumn, t.liveDamageDpsColumn, t.liveDamagePropsColumn, t.liveDamageGoldColumn].join(' '));
  });

  it('reserves the Unattributed row, empty and without em dashes, until the slice has a figure for it', () => {
    const out = html(damage({ unattributed: null }));
    const cells = cellsOf(out, 'live-damage-unattributed');

    expect(cells).toEqual(['', '', '', '']);
    expect(textOf(innerOf(out, 'live-damage-unattributed'))).not.toContain('—');
  });

  it.each(LOCALES)('shows the Unattributed row with its figures, zeros included, in %s', (locale) => {
    const t = STRINGS[locale];
    const zeros = cellsOf(html(damage({ unattributed: NO_CREDIT }), { locale }), 'live-damage-unattributed');
    const some = cellsOf(html(damage({ unattributed: { damage: 1, props: 1_500, gold: 2_500_000 } }), { locale }), 'live-damage-unattributed');

    expect(zeros).toEqual([t.liveDamageUnattributedLabel, '', '0', '0']);
    expect(some).toEqual([t.liveDamageUnattributedLabel, '', locale === 'en' ? '1.5k' : '1,5k', locale === 'en' ? '2.5m' : '2,5m']);
  });

  it('keeps the Unattributed row outside the scroller, on the same four columns', () => {
    const out = html(damage());
    const scroller = innerOf(out, 'live-damage-scroller');
    const columns = (markup: string) => [...markup.matchAll(/<col class="([^"]*)"\/>/g)].map((match) => match[1]);

    expect(scroller).not.toContain('live-damage-unattributed');
    expect(out).toContain('live-damage-unattributed');
    expect(columns(scroller)).toHaveLength(4);
    expect(columns(out.slice(out.indexOf('live-damage-scroller')))).toEqual([...columns(scroller), ...columns(scroller)]);
  });

  it.each([
    [0, 6],
    [1, 6],
    [6, 6],
    [9, 6],
    [0, 9],
    [3, 9],
  ])('reserves a %d-row table of a %d-slot field as one 32px header plus that many 40px rows, as minimum and maximum alike', (rowCount, fieldSize) => {
    const heroes = Array.from({ length: rowCount }, (_unused, index) => heroRow({ heroId: `hero-${String(index)}` }));
    const style = html(damage({ heroes }), { fieldSize }).match(/<div[^>]*data-testid="live-damage-scroller"[^>]*>/)?.[0] ?? '';

    expect(reservedPx(style, 'min-height')).toBeCloseTo(HEAD_HEIGHT_PX + ROW_HEIGHT_PX * fieldSize, 6);
    expect(reservedPx(style, 'max-height')).toBeCloseTo(HEAD_HEIGHT_PX + ROW_HEIGHT_PX * fieldSize, 6);
  });

  it.each([0, 1, 9, 12])('falls back to nine slots while the field size is unknown, with %d rows', (rowCount) => {
    const heroes = Array.from({ length: rowCount }, (_unused, index) => heroRow({ heroId: `hero-${String(index)}` }));
    const style = html(damage({ heroes }), { fieldSize: undefined }).match(/<div[^>]*data-testid="live-damage-scroller"[^>]*>/)?.[0] ?? '';

    expect(reservedPx(style, 'max-height')).toBeCloseTo(HEAD_HEIGHT_PX + ROW_HEIGHT_PX * 9, 6);
    expect(reservedPx(style, 'min-height')).toBeCloseTo(HEAD_HEIGHT_PX + ROW_HEIGHT_PX * 9, 6);
  });

  it('makes every body row 40px tall: a fixed cell height, and the base table padding overridden so it cannot add to it', () => {
    const out = html(damage());
    const cellTags = [...innerOf(out, 'live-damage-row-astra').matchAll(/<td[^>]*>/g)].map((match) => match[0]);
    const tableTags = [...out.matchAll(/<table[^>]*>/g)].map((match) => match[0]);

    expect(cellTags).toHaveLength(4);
    for (const tag of cellTags) expect(tag).toMatch(/class="[^"]*\bh-10\b/);
    expect(tableTags).toHaveLength(2);
    for (const tag of tableTags) expect(tag).toContain('[&amp;_td]:py-1');
    for (const tag of tableTags) expect(tag).not.toContain('[&amp;_td]:py-1.5');
  });

  it('scrolls the table body under its own header', () => {
    const out = html(damage());

    expect(out).toMatch(/<div[^>]*overflow-auto[^>]*data-testid="live-damage-scroller"/);
    expect(innerOf(out, 'live-damage-scroller')).toContain('<thead class="sticky');
  });

  it('puts no screen-reader-only element inside the scroller, where it would add a scrollbar', () => {
    expect(innerOf(html(damage()), 'live-damage-scroller')).not.toContain('sr-only');
  });

  it.each(LOCALES)('puts the explanation behind a design-system tooltip, never inline prose or a native title, in %s', (locale) => {
    const t = STRINGS[locale];
    const out = html(damage(), { locale });

    expect(out).toContain(`aria-label="${t.liveDamageInfoLabel}: ${t.liveDamageInfoBody}"`);
    expect(out).toMatch(/<button[^>]*aria-label="[^"]*"/);
    expect(out).not.toMatch(/\stitle="/);
    expect(textOf(out)).not.toContain(t.liveDamageInfoBody);
  });

  it('has no control but the information trigger: nothing here can be dismissed', () => {
    expect(html(damage()).match(/<button/g)).toHaveLength(1);
  });

  it('renders nothing but the title and empty slots before the first slice arrives', () => {
    const out = html(null);

    expect(out).toContain('live-damage-scroller');
    expect(innerOf(out, 'live-damage-scroller')).not.toContain('<td');
    expect(cellsOf(out, 'live-damage-unattributed')).toEqual(['', '', '', '']);
  });
});
