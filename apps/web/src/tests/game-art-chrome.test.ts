import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STRINGS } from '@/shared/i18n';

const root = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(root, 'src', rel), 'utf8');
// `game-art`'s components live in the shared package now (see wiki-assets-bundled.test.ts and
// this package's own source for the bundled-art coverage that used to sit in this file).
const gameArtRoot = resolve(root, '../../packages/game-art');
const readGameArt = (rel: string) => readFileSync(resolve(gameArtRoot, 'src', rel), 'utf8');
// The farm screen's row builders live in the shared package the desktop app renders them from.
const farmRoot = resolve(root, '../../packages/farm');
const readFarm = (rel: string) => readFileSync(resolve(farmRoot, 'src', rel), 'utf8');
// The hero roster views — the picker among them — are their own shared package, rendered by both
// apps the same way.
const heroRoot = resolve(root, '../../packages/hero');
const readHero = (rel: string) => readFileSync(resolve(heroRoot, 'src', rel), 'utf8');

function expectKeyOrder(source: string, keys: string[]) {
  let last = -1;
  for (const key of keys) {
    const index = source.indexOf(key);
    expect(index, `${key} missing or out of order`).toBeGreaterThan(last);
    last = index;
  }
}

describe('phase drops panel', () => {
  const itemsSrc = readFarm('model/phase-fact-items.tsx');
  const iconSrc = readGameArt('drop-icon.tsx');

  it('carries the drop art on the merged row', () => {
    // One push, not the two the wiki/yours pair needed — every drop is a single row now.
    expect(
      itemsSrc.match(/icon: <DropIcon id=\{row\.id\} ato=\{intel\.ato\} \/>/g) ?? [],
    ).toHaveLength(1);
  });

  /**
   * The `icon` field, not the `label`, is the whole point. `StatList` turns a label with a `tip`
   * into the tooltip TRIGGER, so art folded into the label lands inside that trigger: measured
   * in the browser, the rows grew 31px -> 35px and the trigger's dotted underline ran under the
   * chest sprite as well as the words. As a sibling of the label both go away — and every merged
   * row carries a tip now, so the trigger is on all of them rather than half.
   */
  it('passes the art as the row icon rather than folding it into the label', () => {
    expect(itemsSrc).toContain('label: dropLabel(row.id, strings)');
    expect(itemsSrc).not.toContain('dropLabelWithArt');
  });

  /**
   * `size-8` (32px) deliberately overflows this panel's 11px/14.85px line box, where the phase
   * tables' prop art is `size-4` inside a 16px one. Paid for by the row merge: a gate phase
   * prints four rows where it printed eight, and the panel's height comes from the board grid
   * rather than its content, so the sprite can grow into space the merge freed.
   */
  it('draws the drop art far larger than the phase tables’ prop art', () => {
    // Asserted on the emitted class list, not the file: the doc comment above it names `size-4`
    // to explain why this is not that, so a whole-file `not.toContain` would match the prose.
    const classList = iconSrc.match(/cn\((['"])([^'"]+)\1/)?.[2] ?? '';
    expect(classList, 'DropIcon class list').toContain('size-8');
    expect(classList.split(/\s+/), 'DropIcon class list').not.toContain('size-4');
  });

  it('keeps the drop art decorative — the label is the accessible text', () => {
    expect(iconSrc).toContain('alt=""');
    expect(iconSrc).toContain('aria-hidden');
    expect(iconSrc).not.toContain('role="img"');
  });

  it('renders a row icon as a sibling of the label, in a block-level flex wrapper', () => {
    const listSrc = readFileSync(
      resolve(root, '../../packages/ui/src/stat-list.tsx'),
      'utf8',
    );
    expect(listSrc).toContain('{item.icon}');
    // BLOCK-level flex: an `inline-flex` wrapper sits on the text baseline and lets the art
    // hang below it, which grows every row it appears on.
    expect(listSrc).toContain('<span className="flex items-center gap-1.5">');
    expect(listSrc).not.toContain('inline-flex items-center gap-1.5');
  });
});

describe('phase prop tables', () => {
  const mixSrc = readFarm('components/phase-prop-mix-table.tsx');
  const fitSrc = readFarm('components/phases-hero-fit-table.tsx');

  it('prefixes the prop label with its art in both tables, without adding a column', () => {
    for (const src of [mixSrc, fitSrc]) {
      expect(src).toContain('<PropIcon name={row.name} />');
      // Icon and label share the existing name cell — the header row is untouched.
      expect(src).toContain('<span className="flex items-center gap-1.5">');
      expect(src).toContain('{propLabel(row.name, lang)}');
      // BLOCK-level flex, not `inline-flex`. Measured in the browser: an inline-flex wrapper
      // sits on the text baseline, so its 16px image hangs below it and grows the row from
      // 29px to 33px. `flex` takes the wrapper out of the line box entirely and the row
      // measures 29px — byte-identical to the pre-icon height.
      expect(src).not.toContain('inline-flex items-center gap-1.5');
    }
    // One header per existing column: mix has 5, hero fit has 3.
    expect(mixSrc.match(/<DataTable\.Header/g) ?? []).toHaveLength(5);
    expect(fitSrc.match(/<DataTable\.Header/g) ?? []).toHaveLength(3);
  });

  it('keeps the prop art decorative — the label is the accessible text', () => {
    const iconSrc = readGameArt('prop-icon.tsx');
    expect(iconSrc).toContain('alt=""');
    expect(iconSrc).toContain('aria-hidden');
    // `size-4` matches the dense row's `text-xs` line box, so the rows do not grow.
    expect(iconSrc).toContain('size-4');
    expect(iconSrc).not.toContain('role="img"');
  });
});

describe('hero picker roster chrome', () => {
  const rowSrc = readHero('components/hero-picker/hero-picker-row.tsx');
  const dialogSrc = readHero('components/hero-picker/hero-picker-dialog.tsx');

  it('renders gear and ability icon rows instead of gear fraction', () => {
    expect(rowSrc).toContain('HeroGearIcons');
    expect(rowSrc).toContain('HeroAbilityIcons');
    expect(rowSrc).not.toMatch(/gearCount\/\{SLOTS\.length\}/);
    expect(rowSrc).not.toContain('gearCountOf');
  });

  it('passes localized empty-slot copy into HeroGearIcons', () => {
    expect(rowSrc).toContain('t.gearSlotEmptyAria');
    expect(rowSrc).toContain('t.gearSlotEmptyTip');
    expect(rowSrc).toContain('lvLabel={t.rankLv}');
  });

  it('uses a wider popup for icon columns', () => {
    expect(dialogSrc).toMatch(/1240px/);
  });

  it('raises scroll row height for portrait gear chrome', () => {
    const tableSrc = readHero('components/hero-picker/hero-picker-table.tsx');
    expect(tableSrc).toContain('rowHeight="4.5rem"');
  });

  it('leads with an unsorted avatar column then rank', () => {
    const tableSrc = readHero('components/hero-picker/hero-picker-table.tsx');
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
  const src = readGameArt('hero-gear-icons.tsx');

  it('shows level and forge plaques on roster icons at lg size', () => {
    expect(src).toContain('size="lg"');
    expect(src).not.toContain('showUpgrade={false}');
    expect(src).not.toContain('showLevel={false}');
    expect(src).toContain('w-12');
    expect(src).toContain('aspect-[18/19]');
  });

  it('uses roster tooltip formatter with a caller-supplied rank/level label', () => {
    expect(src).toContain('formatItemRosterTooltip');
    expect(src).toContain('lvLabel');
    expect(src).not.toContain('formatItemDisplay');
  });

  it('always renders all eight slot placeholders', () => {
    expect(src).toContain('SLOTS.map');
    expect(src).not.toMatch(/equippedCount === 0/);
    expect(src).not.toMatch(/return <span className="text-muted">—<\/span>/);
  });

  it('takes empty-slot copy as caller-supplied labels, and uses hover-only tooltip triggers', () => {
    // Localisation itself is the caller's job (CIV-DEBT-02 — this package cannot import
    // `@/shared/i18n`); the roster row call sites pin the localized text, see below.
    expect(src).toContain('emptySlotAriaLabel');
    expect(src).toContain('emptySlotTip');
    expect(src).toContain('type="button"');
    expect(src).toContain('tabIndex={-1}');
    expect(src).not.toContain('role="img"');
  });
});

describe('hero ability icons', () => {
  const src = readGameArt('hero-ability-icons.tsx');

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
  const src = readHero('components/hero-picker/hero-picker-row.tsx');

  it('uses one tab stop per row without nested role=button', () => {
    expect(src).toContain('tabIndex={0}');
    expect(src).toContain('aria-label={hero.name}');
    expect(src).not.toContain('role="button"');
  });
});

describe('item icon meta glyphs', () => {
  const src = readGameArt('item-icon.tsx');

  it('renders halo level top-right and gated +N bottom-right', () => {
    expect(src).toContain('iconMetaGlyphRecipe');
    expect(src).toContain("place: 'top-end'");
    expect(src).toContain("place: 'bottom-end'");
    expect(src).toContain('shape="portrait"');
    expect(src).toContain('withUpgrade');
    expect(src).toContain('+{upgrade}');
  });

  /**
   * The tile is backed by the game's own rarity plate. `fill="rarity"` — the hand-written CSS
   * gradient that used to approximate it — survives only as the fallback for a rarity index the
   * plates do not cover, which is why both appear here.
   */
  it('lays the game slot plate under the sprite, keeping the CSS gradient as the fallback', () => {
    expect(src).toContain('raritySlotPlateSrc');
    expect(src).toContain("fill={plate ? 'plate' : 'rarity'}");
  });

  /** Level and forge are gear's glyphs alone: every other kind arrives with both at 0. */
  it('gates the level and forge glyphs on the item being gear', () => {
    expect(src).toContain('isGear');
    expect(src).toContain("item.kind === undefined || item.kind === 'equipment'");
  });

  it('keeps rarity frame when wiki PNG is missing', () => {
    expect(src).not.toMatch(/if \(!src\) return null/);
    expect(src).toContain('ArtFrame');
  });
});

describe('abilities tab chrome', () => {
  const buildCol = read('features/planner/components/hero-abilities-tab.tsx');
  const itemIcon = readGameArt('item-icon.tsx');

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
    expect(src).toMatch(/<ItemIcon item=\{equipped\} size="xl"/);
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
    expect(rowSrc).toContain('<HeroGearIcons');
    expect(rowSrc).toContain('loadout={candidate.record.loadout}');
    expect(rowSrc).toContain('<HeroAbilityIcons abilities={candidate.record.abilities}');
    expect(rowSrc).toContain('candidate.record.battleAllowed');
    expect(rowSrc).toContain('readOnly');
    expect(rowSrc).toContain('disabled');
    expect(rowSrc).not.toContain('onCheckedChange');
    expect(rowSrc).toContain('Lv{candidate.level}');
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

describe('referral code', () => {
  const footer = read('app/_shell/footer.tsx');
  const header = read('app/_shell/site-header.tsx');
  const hook = read('app/_shell/use-referral-copy.ts');

  it('renders the code from the shared constant in both places, never inlined', () => {
    for (const src of [footer, header]) {
      expect(src).toContain('REFERRAL_CODE');
      expect(src).not.toMatch(/F-[A-Z0-9]{8}/);
    }
  });

  it('shares one copy implementation instead of duplicating the fallback', () => {
    for (const src of [footer, header]) {
      expect(src).toContain('useReferralCopy');
      expect(src).not.toContain('navigator.clipboard');
    }
    expect(hook).toContain('navigator.clipboard.writeText');
  });

  it('gives both copy controls an accessible name and confirms via toast', () => {
    expect(footer).toContain('aria-label={t.referralCopy}');
    expect(header).toContain('aria-label={t.referralTitle}');
    expect(hook).toContain('flashToast(strings.referralCopied)');
  });

  it('uses the Tooltip primitive, never a native title attribute', () => {
    // Scoped to the referral controls — other topbar buttons still use `title`.
    const headerChip = header.slice(
      header.indexOf('referral-topbar'),
      header.indexOf('buymeacoffee'),
    );
    const footerLine = footer.slice(
      footer.indexOf('referralIntro'),
      footer.indexOf('data-testid="app-version"'),
    );
    for (const src of [footerLine, headerChip]) {
      expect(src).toContain('Tooltip.Popup');
      expect(src).not.toMatch(/\btitle=\{/);
    }
    expect(header).toContain('Tooltip.Trigger');
    expect(footer).toContain('Tooltip.Trigger');
  });

  it('meets the 24px minimum target size', () => {
    expect(footer).toContain("'size-6'");
    // The header chip is a text control on the topbar's h-8 control row.
    expect(header).toMatch(/data-testid="referral-topbar"[\s\S]*?h-8/);
  });

  it('keeps the topbar to the code alone, with the why in its tooltip', () => {
    const chip = header.slice(header.indexOf('referral-topbar'), header.indexOf('buymeacoffee'));
    expect(chip).not.toContain('referralIntro');
    expect(chip).not.toContain('referralReward');
    expect(chip).toContain('<Tooltip.Popup>{t.referralTitle}</Tooltip.Popup>');
    for (const lang of ['en', 'pt'] as const) {
      expect(STRINGS[lang].referralTitle).toMatch(/both|nós dois/i);
      expect(STRINGS[lang].referralTitle).toContain('151');
    }
  });

  it('falls back to selecting the code when the clipboard is unavailable', () => {
    // An empty catch would leave the click with no visible effect on insecure
    // origins or when the permission is denied.
    expect(hook).toContain('selectNodeContents');
    expect(hook).toContain('flashToast(strings.referralCopyManual)');
    for (const lang of ['en', 'pt'] as const) {
      expect(STRINGS[lang].referralCopyManual).toBeTruthy();
    }
  });

  it('states the reward is mutual, in both languages', () => {
    for (const lang of ['en', 'pt'] as const) {
      expect(STRINGS[lang].referralIntro).toBeTruthy();
      expect(STRINGS[lang].referralCopy).toBeTruthy();
      expect(STRINGS[lang].referralCopied).toBeTruthy();
      // "we both" / "nós dois" — never framed as a one-way favour.
      expect(STRINGS[lang].referralReward).toMatch(/both|nós dois/i);
      expect(STRINGS[lang].referralReward).toContain('151');
    }
  });
});
