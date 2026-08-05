import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ABILITIES } from '@bombfarm/domain/model';
import { STRINGS } from '@/shared/i18n';

const root = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(root, 'src', rel), 'utf8');

function expectKeyOrder(source: string, keys: string[]) {
  let last = -1;
  for (const key of keys) {
    const index = source.indexOf(key);
    expect(index, `${key} missing or out of order`).toBeGreaterThan(last);
    last = index;
  }
}

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
    expect(dialogSrc).toMatch(/1240px/);
  });

  it('raises scroll row height for portrait gear chrome', () => {
    const tableSrc = read('features/roster/components/hero-picker-table.tsx');
    expect(tableSrc).toContain('rowHeight="4.5rem"');
  });

  it('leads with an unsorted avatar column then rank', () => {
    const tableSrc = read('features/roster/components/hero-picker-table.tsx');
    const head = tableSrc.slice(tableSrc.indexOf('<DataTable.Head>'), tableSrc.indexOf('</DataTable.Head>'));
    expectKeyOrder(head, ['heroAvatarCol', 'importColRank', 'importColName']);
    expect(rowSrc).toContain('size="lg"');
    expect(rowSrc).toContain('rosterInactiveChromeClass');
  });

  it('uses hero-strip name type and text-sm rarity type', () => {
    const strip = read('features/planner/components/hero-strip-identity.tsx');
    expect(strip).toContain('text-base leading-none font-bold');
    expect(rowSrc).toContain("className={cn('text-base leading-none font-bold'");
    expect(rowSrc).toContain('text-sm leading-none font-bold');
  });
});

describe('hero gear icons', () => {
  const src = read('shared/game-art/hero-gear-icons.tsx');

  it('shows level and forge plaques on roster icons at lg size', () => {
    expect(src).toContain('size="lg"');
    expect(src).not.toContain('showUpgrade={false}');
    expect(src).not.toContain('showLevel={false}');
    expect(src).toContain('w-12');
    expect(src).toContain('aspect-[18/19]');
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

  it('shows n/max progress at lg size matching gear', () => {
    expect(src).toContain('size="lg"');
    expect(src).toContain('level={level}');
    expect(src).toContain('max={max}');
    expect(src).toContain('${level}/${max}');
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

describe('item icon meta glyphs', () => {
  const src = read('shared/game-art/item-icon.tsx');

  it('renders halo level top-right and gated +N bottom-right', () => {
    expect(src).toContain('iconMetaGlyphRecipe');
    expect(src).toContain("place: 'top-end'");
    expect(src).toContain("place: 'bottom-end'");
    expect(src).toContain("shape=\"portrait\"");
    expect(src).toContain('fill="rarity"');
    expect(src).toContain('showUpgrade && upgrade > 0');
    expect(src).toContain('+{upgrade}');
    expect(src).toContain('{level}');
  });

  it('keeps rarity frame when wiki PNG is missing', () => {
    expect(src).not.toMatch(/if \(!src\) return null/);
    expect(src).toContain('ArtFrame');
  });
});

describe('abilities tab chrome', () => {
  const buildCol = read('features/planner/components/hero-abilities-tab.tsx');
  const itemIcon = read('shared/game-art/item-icon.tsx');

  it('shows ability icons at xl size with n/20 progress', () => {
    expect(buildCol).toContain('AbilityIcon');
    expect(buildCol).toMatch(/AbilityIcon[\s\S]*size="xl"/);
    expect(buildCol).toMatch(/level=\{level\}/);
    expect(buildCol).toMatch(/max=\{ability\.max\}/);
  });

  it('does not overlay rarity crystals on item art', () => {
    expect(itemIcon).not.toContain('rarityCrystalSrc');
    expect(itemIcon).not.toContain('crystal');
  });
});

describe('gear tab slot chrome', () => {
  const src = read('features/gear/components/slot-editor.tsx');

  it('uses ItemIcon at xl with default level and upgrade glyphs', () => {
    expect(src).toMatch(/<ItemIcon equipped=\{equipped\} size="xl"/);
    expect(src).not.toContain('showLevel={false}');
    expect(src).not.toContain('showUpgrade={false}');
    expect(src).toContain('w-16');
    expect(src).toContain('aspect-[18/19]');
  });

  it('centers filled art and keeps the slot name only on empty placeholders', () => {
    expect(src).toContain('justify-center');
    expect(src).toContain('absolute -top-1 -right-1');
    const emptyBranch = src.slice(src.indexOf(': ('), src.indexOf('<Select'));
    expect(emptyBranch).toContain('slotLabel(slot, lang)');
    const filledBranch = src.slice(src.indexOf('{equipped ? ('), src.indexOf(': ('));
    expect(filledBranch).not.toContain('slotLabel');
  });
});

describe('import preview table chrome', () => {
  const tableSrc = read('features/import/components/import-candidate-table.tsx');
  const rowSrc = read('features/import/components/import-candidate-row.tsx');
  const dialogSrc = read('features/import/components/import-heroes-dialog.tsx');
  const accountSrc = read('features/import/components/import-account-summary.tsx');

  it('uses switch-hero column order', () => {
    const head = tableSrc.slice(tableSrc.indexOf('<DataTable.Head>'), tableSrc.indexOf('</DataTable.Head>'));
    expectKeyOrder(head, [
      'heroAvatarCol',
      'importColRank',
      'importColName',
      'importColRarity',
      'importColLevel',
      'importColPower',
      'rosterColGear',
      'rosterColAbilities',
      'rosterColStatus',
    ]);
  });

  it('wires loadout and abilities into shared icon rows', () => {
    expect(rowSrc).toContain('<HeroGearIcons loadout={candidate.record.loadout}');
    expect(rowSrc).toContain('<HeroAbilityIcons abilities={candidate.record.abilities}');
    expect(rowSrc).toContain('candidate.record.battleAllowed');
    expect(rowSrc).toContain('L{candidate.level}');
    expect(rowSrc).toContain('size="lg"');
    expect(rowSrc).toContain('rosterInactiveChromeClass');
    expect(rowSrc).not.toContain("from '@/features/roster'");
  });

  it('drops badges and expand-row details', () => {
    expect(rowSrc).not.toContain('importGearRefreshBadge');
    expect(rowSrc).not.toContain('importUpdateBadge');
    expect(rowSrc).not.toContain('importIssuesCount');
    expect(rowSrc).not.toContain('ImportCandidateDetails');
    expect(tableSrc).not.toContain('expanded');
    expect(dialogSrc).not.toContain('expanded');
  });

  it('widens the import dialog for icon columns', () => {
    expect(dialogSrc).toMatch(/1240px/);
  });

  it('raises scroll row height for portrait gear chrome', () => {
    expect(tableSrc).toContain('rowHeight="4.5rem"');
  });

  it('fills the preview dialog without a nested page scroller', () => {
    expect(dialogSrc).toContain('importPreviewTitle');
    expect(dialogSrc).toContain('importPreviewDesc');
    expect(dialogSrc).toContain("previewReady ? t.importPreviewTitle : t.importDialogTitle");
    expect(dialogSrc).toContain("previewReady ? t.importPreviewDesc : t.importDialogDesc");
    expect(dialogSrc).toContain('!h-[min(85vh,900px)]');
    expect(dialogSrc).not.toContain('overflow-auto pr-0.5');
    expect(tableSrc).toContain('flex-1');
    expect(tableSrc).not.toContain('maxRows');
  });

  it('previews skill-tree gold gain and drops the old lead/verify copy', () => {
    expect(accountSrc).toContain('treeTeamCoin');
    expect(accountSrc).toContain('accountData.tree.teamCoinPct');
    expect(accountSrc).not.toContain('importAccountLead');
    expect(accountSrc).not.toContain('importAccountVerify');
  });

  it('uses the same name and rarity type as switch-hero', () => {
    expect(rowSrc).toContain("className={cn('text-base leading-none font-bold'");
    expect(rowSrc).toContain('text-sm leading-none font-bold');
  });
});

describe('gear slot stats', () => {
  const buildCol = read('features/planner/components/gear-slot-stats-grid.tsx');
  const compareSrc = read('features/planner/components/gear-compare-section.tsx');

  it('uses full stat labels in per-slot breakdown', () => {
    expect(buildCol).toContain('slotStatFullLabels');
    expect(buildCol).not.toMatch(/slotStatLabels\[/);
  });

  it('shows the same per-slot stats under clone gear', () => {
    expect(compareSrc).toContain('<GearSlotStatsGrid loadout={altLoadout}');
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
