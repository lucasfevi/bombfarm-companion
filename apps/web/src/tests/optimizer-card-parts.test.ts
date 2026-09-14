import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { OptimizerActionRow } from '@/features/home/components/optimizer-action-row';
import { OptimizerCardSkeleton } from '@/features/home/components/optimizer-card-skeleton';
import { planActions } from '@/features/home/model/optimizer-actions';
import { STRINGS, type Lang } from '@/shared/i18n';
import { normalizeHero } from '@/shared/lib/storage';

const LANGS: readonly Lang[] = ['en', 'pt'];

const unescape = (text: string) =>
  text.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const textOf = (html: string) => unescape(html.replace(/<[^>]+>/g, ''));

function hero(id: string, name: string) {
  return normalizeHero({
    id,
    name,
    sourceId: `src-${id}`,
    updatedAt: 1,
    rarity: 'Raro',
    level: 10,
    stars: 1,
    naked: { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
    gearedOverride: { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 },
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
    battleAllowed: true,
  });
}

function item(id: string, upgrade: number): InventoryItem {
  return {
    id,
    defId: 'ember_calca',
    rarityIdx: 2,
    level: 10,
    upgrade,
    slot: 'calca',
    equipped: false,
    equippedBy: null,
    defResolved: true,
    marketBlocked: false,
  };
}

const PLAN: TeamPlan = {
  steps: [],
  forgeList: [{ itemId: '1', defId: 'ember_calca', from: 8, to: 10 }],
  moveList: [
    { phase: 'equip', itemId: '2', defId: 'ember_calca', slot: 'calca', fromHeroId: null, toHeroId: 'src-b' },
    { phase: 'unequip', itemId: '1', defId: 'ember_calca', slot: 'calca', fromHeroId: 'src-a', toHeroId: null },
    { phase: 'equip', itemId: '1', defId: 'ember_calca', slot: 'calca', fromHeroId: 'src-a', toHeroId: 'src-b' },
  ],
  pointResets: [
    { heroId: 'src-a', ptsBefore: {}, pts: {}, heroGainDpsPct: 0, rosterGainObjective: 1234, resetCostGold: 0 },
  ],
  perHero: [],
  proposedLoadouts: {},
  regime: 'underSaturated',
  sumDuty: 1,
  slots: 3,
  currentDps: 100,
  planDps: 120,
  forgeFloorApplied: 10,
  allowedChanges: 'both',
  scoredPhase: null,
  scoredPhaseSource: 'account',
  scoredPhaseInfeasible: false,
  gearBreakdown: { forgeDelta: 0, moveDelta: 0 },
  requiresFullPlan: false,
  gearDipDps: 0,
  runedHeroNames: [],
  run: { rounds: 1, evaluations: 1, budgetExhausted: false, elapsedMs: 1, seedUsed: 'seed' },
};

describe("the optimizer card's parts", () => {
  it('the skeleton is four bars and no text', () => {
    const html = renderToStaticMarkup(createElement(OptimizerCardSkeleton));

    expect(html).toContain('data-testid="home-optimizer-skeleton"');
    expect(html.match(/<[a-z]+ [^>]*class="[^"]*bg-bg-2[^"]*"/g)).toHaveLength(4);
    expect(textOf(html)).toBe('');
    expect(html).not.toContain('<a');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<p');
  });

  it('an action row prints its sentence and only a reset carries a contribution', () => {
    for (const lang of LANGS) {
      const { rows } = planActions(PLAN, [item('1', 8), item('2', 0)], [hero('a', 'Hero a'), hero('b', 'Hero b')], STRINGS[lang], lang);
      expect(rows.map((row) => row.kind)).toEqual(['equip', 'move', 'forge', 'reset']);

      for (const row of rows) {
        const html = renderToStaticMarkup(createElement(OptimizerActionRow, { row }));
        const contribution = /data-testid="home-optimizer-contribution"[^>]*>([^<]*)</.exec(html)?.[1] ?? null;

        expect(html, row.kind).toContain(`data-testid="home-optimizer-action" data-kind="${row.kind}"`);
        expect(textOf(html), row.kind).toBe(row.text + (row.contribution ?? ''));
        expect(contribution, row.kind).toBe(row.kind === 'reset' ? (lang === 'en' ? '+1.2k' : '+1,2k') : null);
      }
    }
  });
});
