import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { SITE_HOST } from '@bombfarm/ui/site-address';
import { defaultShareCardSettings, shareCardLayout, type RosterHeroRow, type ShareCardSettings } from '../../model';
import { item, rowFixture } from '../../model/showcase.test-fixture';
import { ShareCard, type ShareCardIdentity } from './share-card';

const SIX_ABILITIES = {
  olho_clinico: 20,
  golpe_brutal: 17,
  ponta_diamante: 12,
  grito_guerra: 20,
  fantasma: 4,
  explosao_ampla: 14,
};

const ROSTER: readonly RosterHeroRow[] = [
  rowFixture({ id: 'a', name: 'Ada', power: 5_000_000, rarity: 'Mítico', abilities: SIX_ABILITIES, rank: 'S' }),
  rowFixture({ id: 'b', name: 'Bo', power: 4_000_000, rarity: 'Lendária', loadout: { ...emptyLoadout(), arma: item(140, 13) } }),
  rowFixture({ id: 'c', name: 'Cy', power: 3_000_000, rarity: 'Épico' }),
  rowFixture({ id: 'd', name: 'Di', power: 2_000_000, rarity: 'Épico', abilities: { fortuna: 20 } }),
  rowFixture({ id: 'e', name: 'Ed', power: 1_000_000, rarity: 'Raro', battleAllowed: false }),
];

const IDENTITY: ShareCardIdentity = { playerName: 'Black', accountId: '486', maxPhase: 310 };

function render(overrides: Partial<ShareCardSettings> = {}, identity: ShareCardIdentity = IDENTITY): string {
  const settings = { ...defaultShareCardSettings(ROSTER, 180, 310), ...overrides };
  const layout = shareCardLayout(ROSTER, settings.picked, settings.feature);
  return renderToStaticMarkup(
    <ShareCard
      layout={layout}
      settings={settings}
      identity={identity}
      dps={new Map([['a', 932_400], ['d', 14_900]])}
      lang="en"
    />,
  );
}

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

describe('ShareCard', () => {
  it('is titled with the player name, and a neutral title when the read carried none', () => {
    expect(text(render())).toContain('Black');
    expect(text(render({}, { ...IDENTITY, playerName: null }))).toContain('My squad');
  });

  it('says the chosen phase and the furthest one, and the account number only when asked', () => {
    expect(text(render())).toContain('Current phase 180 · Max phase 310');
    expect(text(render())).not.toContain('Account #486');
    expect(text(render({ showAccountNumber: true }))).toContain('Account #486 · Current phase 180');
  });

  it('totals and counts only the heroes on the card, the benched one left off by default', () => {
    const html = text(render());
    expect(html).toContain('14m');
    expect(html).toContain('4 heroes');
    expect(html).toContain('1 Mythic');
    expect(html).toContain('1 Legendary');
    expect(html).toContain('2 Epic');
    expect(html).not.toContain('Ed');
  });

  it('features the three strongest with their medals, and lists the rest below', () => {
    const html = render();
    expect(html).toContain('data-testid="share-card-featured-a"');
    expect(html).toContain('data-testid="share-card-featured-c"');
    expect(html).toContain('data-testid="share-card-rest-d"');
    expect(text(html)).toContain('Strongest');
    expect(text(html)).toContain('Also on the team');
  });

  it('prints each hero DPS, and a dash for one the host could not work out', () => {
    const html = text(render());
    expect(html).toContain('932.4k DPS');
    expect(html).toContain('14.9k DPS');
    expect(html).toContain('— DPS');
  });

  it('draws six abilities as bare icons, with no level printed on any of them', () => {
    const html = render();
    const featuredA = html.slice(html.indexOf('share-card-featured-a'), html.indexOf('share-card-featured-b'));
    expect(featuredA.match(/src="[^"]*abilit[^"]*"/g)?.length).toBe(6);
    expect(text(featuredA)).not.toMatch(/\d+\/20/);
  });

  it('prints an item level and its forge on the featured gear, and hides the gear when asked', () => {
    expect(render()).toContain('data-testid="share-card-gear"');
    expect(text(render())).toContain('+13');
    expect(render({ showGear: false })).not.toContain('data-testid="share-card-gear"');
  });

  it('shows the seven team auras from the heroes on the card, and hides them when asked', () => {
    const html = render();
    expect(text(html)).toContain('Team auras · 2 of 7');
    expect(html).toContain('data-testid="share-card-aura-fortuna" data-covered="true"');
    expect(html).toContain('data-testid="share-card-aura-brecha" data-covered="false"');
    expect(text(html)).toContain('Not on the team');
    expect(render({ showAuras: false })).not.toContain('share-card-auras');
  });

  it('ends on the download address and the phase the DPS was worked out at', () => {
    const html = text(render());
    expect(html).toContain(`${SITE_HOST}/download`);
    expect(html).toContain('DPS at phase 180');
  });

  it('says to pick a hero when nobody is on the card', () => {
    expect(text(render({ picked: new Set() }))).toContain('Pick at least one hero');
  });
});
