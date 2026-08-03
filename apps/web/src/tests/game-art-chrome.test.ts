import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ABILITIES } from '@bombfarm/domain/model';
import { STRINGS } from '@/shared/i18n';

const root = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(root, 'src', rel), 'utf8');

describe('bundled wiki assets', () => {
  it('ships PNG for every modeled ability', () => {
    const dir = resolve(root, 'public/wiki-assets/abilities');
    const files = new Set(readdirSync(dir).filter((f) => f.endsWith('.png')));
    for (const a of ABILITIES) {
      expect(files.has(`${a.id}.png`), `missing abilities/${a.id}.png`).toBe(true);
    }
  });
});

describe('hero picker roster chrome', () => {
  const rowSrc = read('features/roster/components/hero-picker-row.tsx');
  const dialogSrc = read('features/roster/components/hero-picker-dialog.tsx');

  it('renders gear and ability icon rows instead of gear fraction', () => {
    expect(rowSrc).toContain('HeroGearIcons');
    expect(rowSrc).toContain('HeroAbilityIcons');
    expect(rowSrc).not.toMatch(/gearCount\/\{SLOTS\.length\}/);
    expect(rowSrc).not.toContain('gearCountOf');
  });

  it('uses a wider popup for icon columns', () => {
    expect(dialogSrc).toMatch(/980px/);
  });
});

describe('hero gear icons', () => {
  const src = read('shared/game-art/hero-gear-icons.tsx');

  it('hides forge overlay on roster icons', () => {
    expect(src).toContain('showUpgrade={false}');
  });

  it('uses roster tooltip formatter with rankLv', () => {
    expect(src).toContain('formatItemRosterTooltip');
    expect(src).toContain('t.rankLv');
    expect(src).not.toContain('formatItemDisplay');
  });

  it('always renders all eight slot placeholders', () => {
    expect(src).toContain('SLOTS.map');
    expect(src).not.toMatch(/equippedCount === 0/);
    expect(src).not.toMatch(/return <span className="text-muted">—<\/span>/);
  });

  it('localizes empty slot labels and uses hover-only tooltip triggers', () => {
    expect(src).toContain('gearSlotEmptyAria');
    expect(src).toContain('gearSlotEmptyTip');
    expect(src).toContain('type="button"');
    expect(src).toContain('tabIndex={-1}');
    expect(src).not.toContain('role="img"');
  });
});

describe('hero ability icons', () => {
  const src = read('shared/game-art/hero-ability-icons.tsx');

  it('uses hover-only tooltip triggers', () => {
    expect(src).toContain('type="button"');
    expect(src).toContain('tabIndex={-1}');
    expect(src).not.toContain('role="img"');
  });
});

describe('hero picker row a11y', () => {
  const src = read('features/roster/components/hero-picker-row.tsx');

  it('uses one tab stop per row without nested role=button', () => {
    expect(src).toContain('tabIndex={0}');
    expect(src).toContain('aria-label={hero.name}');
    expect(src).not.toContain('role="button"');
  });
});

describe('item icon forge badge', () => {
  const src = read('shared/game-art/item-icon.tsx');

  it('supports hiding upgrade overlay for compact rows', () => {
    expect(src).toContain('showUpgrade');
    expect(src).toMatch(/showUpgrade && upgrade/);
  });

  it('keeps rarity frame when wiki PNG is missing', () => {
    expect(src).not.toMatch(/if \(!src\) return null/);
    expect(src).toContain('ArtFrame');
  });
});

describe('abilities tab chrome', () => {
  const buildCol = read('features/planner/components/hero-abilities-tab.tsx');
  const itemIcon = read('shared/game-art/item-icon.tsx');

  it('shows ability icons at lg size in ability cards', () => {
    expect(buildCol).toContain('AbilityIcon');
    expect(buildCol).toMatch(/AbilityIcon[\s\S]*size="lg"/);
  });

  it('does not overlay rarity crystals on item art', () => {
    expect(itemIcon).not.toContain('rarityCrystalSrc');
    expect(itemIcon).not.toContain('crystal');
  });
});

describe('gear slot stats', () => {
  const buildCol = read('features/planner/components/gear-slot-stats-grid.tsx');

  it('uses full stat labels in per-slot breakdown', () => {
    expect(buildCol).toContain('slotStatFullLabels');
    expect(buildCol).not.toMatch(/slotStatLabels\[/);
  });
});

describe('hero strip metrics', () => {
  const strip = read('features/planner/components/hero-strip.tsx');

  it('omits clone compare diff from strip chrome', () => {
    expect(strip).not.toContain('showCompareDiff');
    expect(strip).not.toContain('bDiff');
  });
});

describe('wiki asset footer credit', () => {
  it('uses generic assets wording in EN and PT', () => {
    expect(STRINGS.en.wikiArtCredit).toMatch(/Assets are from the official BombFarm wiki/);
    expect(STRINGS.en.wikiArtCredit).not.toMatch(/portrait|item icon/i);
    expect(STRINGS.pt.wikiArtCredit).toMatch(/Assets vêm da wiki oficial do BombFarm/);
    expect(STRINGS.pt.wikiArtCredit).not.toMatch(/Retratos|ícones de itens/);
  });

  it('localizes empty gear slot roster copy', () => {
    expect(STRINGS.en.gearSlotEmptyTip).toBe('Empty');
    expect(STRINGS.en.gearSlotEmptyAria).toContain('{slot}');
    expect(STRINGS.pt.gearSlotEmptyTip).toBe('Vazio');
    expect(STRINGS.pt.gearSlotEmptyAria).toContain('{slot}');
  });

  it('footer links to wiki.bombfarm.net', () => {
    const footer = read('app/_shell/footer.tsx');
    expect(footer).toContain('WIKI_URL');
    expect(footer).toContain('wikiArtCredit');
  });
});
