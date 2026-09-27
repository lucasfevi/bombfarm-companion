import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SHEET_DISPLAY_KEYS } from '@bombfarm/domain/planner-constants';
import { TEAM_AURA_SWITCH_IDS, noTeamAuraSwitches, type TeamAuraId } from '@bombfarm/domain/team-buffs';
import { numberFormatterFor } from '@bombfarm/ui';
import { heroCopyFor, statPanelCopyFor, type Lang } from '../copy';
import { derivedLabel, formatBreakdownValue, isSheetKey, rowValue } from '../model/breakdown-labels';
import { COMBAT_BREAKDOWN_CARDS } from '../model/combat-breakdown';
import { factsForHero, fixtureHero, loadBreakdownFixture } from '../model/combat-breakdown.test-fixture';
import { CombatBreakdownPanel } from './combat-breakdown-panel';
import type { TeamAuraControls } from './team-auras-section';

const fixture = loadBreakdownFixture();
const hero = fixtureHero(fixture, 'Minato');
const switches = noTeamAuraSwitches();
const facts = factsForHero(fixture, hero, switches);
const AURAS: TeamAuraControls = {
  deltas: Object.fromEntries(TEAM_AURA_SWITCH_IDS.map((id, index) => [id, index + 0.5])) as Record<TeamAuraId, number>,
  onSwitch: () => undefined,
};

function render(lang: Lang): string {
  return renderToStaticMarkup(
    <CombatBreakdownPanel
      t={statPanelCopyFor(lang)}
      facts={facts}
      hero={hero}
      phase={fixture.phase}
      switches={switches}
      auras={AURAS}
      lang={lang}
    />,
  );
}

/** One card's markup, from its own opening tag up to the next card's. */
function cardMarkup(html: string, id: string): string {
  const marker = html.indexOf(`data-breakdown-card="${id}"`);
  if (marker < 0) throw new Error(`no card for ${id}`);
  const next = html.indexOf('data-breakdown-card="', marker + 1);
  return html.slice(html.lastIndexOf('<', marker), next < 0 ? undefined : html.lastIndexOf('<', next));
}

function openingTag(fragment: string): string {
  return fragment.slice(0, fragment.indexOf('>') + 1);
}

function textOf(fragment: string, testId: string): string {
  const match = new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`).exec(fragment);
  if (!match) throw new Error(`no ${testId} in fragment`);
  return match[1] ?? '';
}

describe('CombatBreakdownPanel', () => {
  it.each(['en', 'pt'] as const)('%s: every card prints rowValue(id, facts), formatted the way the breakdown formats it', (lang) => {
    const html = render(lang);
    const t = statPanelCopyFor(lang);
    const formatNumber = numberFormatterFor(lang);
    for (const id of COMBAT_BREAKDOWN_CARDS) {
      const card = cardMarkup(html, id);
      expect(textOf(card, 'breakdown-value'), id).toBe(formatBreakdownValue(id, rowValue(id, facts), formatNumber));
      const label = isSheetKey(id) ? t.statFull[id] : derivedLabel(t, id);
      expect(card, `${id} label`).toContain(`>${label}<`);
    }
  });

  it('draws the twenty cards in pipeline order under the four row labels, and nothing is folded away', () => {
    const html = render('en');
    const order = [...html.matchAll(/data-breakdown-card="([a-zA-Z]+)"/g)].map((match) => match[1]);
    expect(order).toEqual([...COMBAT_BREAKDOWN_CARDS]);
    expect(html).not.toContain('data-slot="accordion');
    expect([...html.matchAll(/data-breakdown-row="/g)].length).toBe(4);
  });

  it('the matrix has all seven sheet stats even when no aura moves any of them', () => {
    const html = render('en');
    const rows = [...html.matchAll(/data-matrix-row="([a-zA-Z]+)"/g)].map((match) => match[1]);
    expect(rows).toEqual([...SHEET_DISPLAY_KEYS]);
    const formatNumber = numberFormatterFor('en');
    for (const key of SHEET_DISPLAY_KEYS) {
      expect(html).toContain(formatNumber(facts.effective[key], 2));
    }
  });

  it('the wires are not drawn on the server — they need the cards measured first', () => {
    expect(render('en')).not.toContain('data-testid="breakdown-wires"');
  });

  it('the Mitigation factor card carries the penetration reading', () => {
    const card = cardMarkup(render('en'), 'mitF');
    expect(card).toMatch(/data-testid="breakdown-penetration"[^>]*>(nothing lost to mitigation|[\d.,]+% of each hit lost to mitigation)</);
  });

  it('a derived card prints its symbolic formula; a sheet card prints none', () => {
    const html = render('en');
    expect(cardMarkup(html, 'hit')).toContain('atk × mitF × dmg');
    expect(cardMarkup(html, 'attack')).not.toContain('data-testid="breakdown-symbolic"');
  });

  it('every team aura is badged on its card, dimmed while off, and the hero\'s own abilities are lit', () => {
    const html = render('en');
    expect(cardMarkup(html, 'fieldSeconds')).toMatch(/data-badge="folego_mineiro" data-on="false"/);
    expect(cardMarkup(html, 'attack')).toMatch(/data-badge="grito_guerra" data-on="false"/);
    expect(cardMarkup(html, 'activeDps')).toMatch(/data-badge="misericordia" data-on="true"/);
    expect(cardMarkup(html, 'dmg')).not.toMatch(/data-badge="misericordia"/);
  });

  it('the whole card is the one popover trigger, under a help cursor; its badges are labelled icons with no popover and no tab stop', () => {
    const html = render('en');
    const fieldTime = cardMarkup(html, 'fieldSeconds');
    const root = openingTag(fieldTime);
    expect(root).toContain('data-slot="tooltip-trigger"');
    expect(root).toContain('tabindex="0"');
    expect(root).toContain('cursor-help');
    expect(fieldTime.match(/data-slot="tooltip-trigger"/g)).toHaveLength(1);
    expect(fieldTime.match(/tabindex="0"/g)).toHaveLength(1);
    expect(fieldTime).toMatch(/<li role="img" aria-label="Miner(?:'|&#x27;)s Breath — switched off"/);
    expect(html).not.toContain('data-muted');
  });

  it.each(['en', 'pt'] as const)(
    '%s: the team auras sit between the pipeline and the sheet matrix, under their own heading and tip',
    (lang) => {
      const html = render(lang);
      const copy = heroCopyFor(lang);
      const pipeline = html.indexOf('data-testid="breakdown-pipeline"');
      const auras = html.indexOf('data-testid="team-auras"');
      const matrixHeading = html.indexOf(`>${copy.heroDetailBreakdownMatrixTitle}<`);
      expect(pipeline).toBeGreaterThan(-1);
      expect(auras).toBeGreaterThan(pipeline);
      expect(matrixHeading).toBeGreaterThan(auras);
      const section = html.slice(auras, matrixHeading);
      expect(section).toContain(`<h3 class="m-0 text-[10px] font-bold tracking-[0.08em] text-accent uppercase">${copy.heroDetailAurasTeamGroup}</h3>`);
      expect(section).toContain(`aria-label="${copy.heroDetailAurasTeamGroup}: `);
      for (const id of TEAM_AURA_SWITCH_IDS) expect(section, id).toContain(`data-testid="team-aura-${id}"`);
      expect(html.match(/data-testid="team-auras"/g)).toHaveLength(1);
    },
  );

  it('an aura the hero does not carry has a switch naming it, and its card says what flipping it would do', () => {
    const html = render('en');
    const copy = heroCopyFor('en');
    const warCry = html.slice(html.indexOf('data-testid="team-aura-grito_guerra"'));
    expect(warCry.slice(0, warCry.indexOf('</li>'))).toContain('role="switch"');
    expect(warCry).toContain(`aria-label="${copy.heroDetailAuraSwitchAria.replace('{name}', 'War Cry')}"`);
    expect(textOf(warCry, 'team-aura-delta')).toBe('+0.5% if on');
  });
});
