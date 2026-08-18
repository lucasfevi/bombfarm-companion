import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ABILITIES } from '@bombfarm/domain/model';
import { PROPS } from '@bombfarm/domain/phases';
import { HERO_SKIN_COUNT, heroAvatarSrc, itemIconSrc, propIconSrc, dropIconSrc } from '@bombfarm/domain/wiki-assets';
import { DROP_RATES, type DropRateId } from '@bombfarm/domain/phase-wiki';
import catalog from '@bombfarm/domain/data/catalog.json';
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

  /**
   * Item art is keyed by the SET's native level, which a game patch can re-key wholesale
   * (2026-08-15 moved 168 of 240 filenames). The catalog is regenerated then; the bundle is a
   * separate manual step, and when it is skipped every re-keyed item renders a blank frame with
   * no build or runtime error. Both directions are asserted so a stale leftover is caught too.
   */
  it('ships item art for every catalog def, and bundles no orphaned item art', () => {
    // Non-vacuity: an empty or truncated catalog would make the loop below prove nothing.
    expect(catalog.defs.length, 'catalog def count').toBeGreaterThan(200);

    const wanted = new Set<string>();
    const unresolved: string[] = [];
    const missing: string[] = [];

    for (const def of catalog.defs) {
      const src = itemIconSrc(def.id);
      if (!src) {
        unresolved.push(def.id);
        continue;
      }
      // `src` is a public-root URL (`/wiki-assets/items/…`); resolve it against `public/`
      // so the assertion follows the real helper output, not a re-derived filename.
      wanted.add(src.slice(src.lastIndexOf('/') + 1));
      if (!existsSync(resolve(root, 'public', src.slice(1)))) missing.push(`${def.id} -> ${src}`);
    }

    expect(unresolved, 'catalog defs itemIconSrc returned null for').toEqual([]);
    expect(missing, 'catalog defs whose art is not bundled').toEqual([]);

    const dir = resolve(root, 'public/wiki-assets/items');
    const orphaned = readdirSync(dir).filter((f) => !wanted.has(f));
    expect(orphaned, 'bundled item art no catalog def points at').toEqual([]);
  });

  /**
   * Same failure shape as the item guard, one table further along: `heroAvatarSrc` indexes a
   * fixed array and falls back to `?? 1`, so an index with no bundled file renders ANOTHER
   * hero's face — wrong art, not a missing image, so nothing errors.
   *
   * SCOPE — read before trusting this to catch the next appearance. This enforces a bijection
   * between `SKIN_AVATAR_FILE` and the bundled files: a half-applied edit (bumping the count
   * without adding art, adding art without raising the count, or pointing two indices at one
   * file) fails here. It CANNOT tell that the *game* has more appearances than the code knows
   * about — with `HERO_SKIN_COUNT = 7` and seven bundled files, the pre-#98 state, this test is
   * green. That gap is real and unguarded: detecting it needs an external signal about the
   * game's skin count, which nothing in the app observes. The wiki drift job is the only thing
   * positioned to notice, and it does not track this field today.
   */
  it('ships hero art for every skin index, and bundles no unreachable hero art', () => {
    const dir = resolve(root, 'public/wiki-assets/hero');
    const wanted = new Set<string>();
    const missing: string[] = [];

    for (let skin = 0; skin < HERO_SKIN_COUNT; skin += 1) {
      const src = heroAvatarSrc(skin);
      const file = src.slice(src.lastIndexOf('/') + 1);
      // A duplicate here means two skin indices share one face — the `?? 1` bug's signature.
      expect(wanted.has(file), `skin ${skin} reuses ${file}`).toBe(false);
      wanted.add(file);
      if (!existsSync(resolve(root, 'public', src.slice(1)))) missing.push(`skin ${skin} -> ${src}`);
    }

    expect(missing, 'skin indices whose avatar is not bundled').toEqual([]);

    // Only `hero{N}_avatar.png` participates; the directory also holds a
    // `hero6-bomb-activation/` subdirectory of unrelated sprites.
    const bundled = readdirSync(dir).filter((f) => /^hero\d+_avatar\.png$/.test(f));
    expect(bundled.length, 'bundled hero avatars').toBe(HERO_SKIN_COUNT);
    const orphaned = bundled.filter((f) => !wanted.has(f));
    expect(orphaned, 'bundled hero art no skin index points at').toEqual([]);
  });

  /**
   * `propIconSrc` is a bare string join over the prop's own name, so a renamed prop or a
   * missing mirror yields a well-formed path to nothing: the phase tables draw a broken
   * image and neither the type checker nor any math test notices.
   *
   * Forward direction ONLY, unlike the item and hero guards above. `env/` is a mixed
   * directory — it also holds `bomb`, `boss`, `jaula` and the five `cage_ato*` sprites,
   * which no prop points at — so a reverse "no orphaned art" sweep would fail on assets
   * that are legitimately reachable from elsewhere.
   */
  it('ships env art for every modeled prop', () => {
    // Non-vacuity: a truncated PROPS table would make the loop below prove nothing.
    expect(PROPS.length, 'modeled props').toBe(10);

    const missing: string[] = [];
    for (const prop of PROPS) {
      const src = propIconSrc(prop.name);
      expect(src, `propIconSrc returned null for ${prop.name}`).not.toBeNull();
      // `src` is a public-root URL; resolve it against `public/` so the assertion follows
      // the real helper output rather than a re-derived filename.
      if (!existsSync(resolve(root, 'public', src!.slice(1)))) missing.push(`${prop.name} -> ${src}`);
    }

    expect(missing, 'props whose env art is not bundled').toEqual([]);
  });

  /**
   * Same failure mode as the prop sweep above, with a much wider blast radius: `dropIconSrc`
   * builds 21 paths across four directories, and `key/`, `steam/` and `chests/gems/` are reached
   * by nothing else in the app. A mis-mirrored drop sprite draws a broken image in the Drops
   * panel and no math or type check notices.
   *
   * Every band is swept, not just one, because the per-band families are built by interpolating
   * the band into the filename — so a family can be correct at ato 1 and dead at ato 4.
   *
   * Forward direction only, for the same reason as props — `icons/` and `steam/` are mixed
   * directories holding the rarity crystals and other `chest_*` sprites, so a reverse
   * "no orphaned art" sweep would fail on assets reachable from elsewhere.
   */
  it('ships drop art for every modeled drop-chance row, in every difficulty band', () => {
    const ids = Object.keys(DROP_RATES) as DropRateId[];
    const bands = [1, 2, 3, 4, 5];
    // Non-vacuity: a shrunken DROP_RATES would make the loop below prove nothing.
    expect(ids.length, 'modeled drop rows').toBe(5);

    const missing: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      for (const ato of bands) {
        const src = dropIconSrc(id, ato);
        expect(src, `dropIconSrc returned null for ${id} at ato ${ato}`).not.toBeNull();
        seen.add(src!);
        // `src` is a public-root URL; resolve it against `public/` so the assertion follows the
        // real helper output rather than a re-derived filename.
        if (!existsSync(resolve(root, 'public', src!.slice(1)))) missing.push(`${id}@${ato} -> ${src}`);
      }
    }

    expect(missing, 'drop rows whose art is not bundled').toEqual([]);
    // Four per-band families of 5, plus the one fixed item chest. Pins the count so a family
    // silently collapsing to a single sprite fails here rather than looking fine.
    expect(seen.size, 'distinct sprites the panel can reach').toBe(21);
  });
});

describe('phase drops panel', () => {
  const itemsSrc = read('features/phases/model/phase-fact-items.tsx');
  const iconSrc = read('shared/game-art/drop-icon.tsx');

  it('carries the drop art on both rows of each wiki/yours pair', () => {
    // Icon-on-one-row would leave the pair's labels starting at different x positions in the
    // panel's `dl` grid, so both pushes supply it.
    expect(
      itemsSrc.match(/icon: <DropIcon id=\{row\.id\} ato=\{intel\.ato\} \/>/g) ?? [],
    ).toHaveLength(2);
  });

  /**
   * The `icon` field, not the `label`, is the whole point. `StatList` turns a label with a `tip`
   * into the tooltip TRIGGER, so art folded into the label lands inside that trigger: measured
   * in the browser, the four "yours" rows grew 31px -> 35px and the trigger's dotted underline
   * ran under the chest sprite as well as the words. As a sibling of the label both go away.
   */
  it('passes the art as the row icon rather than folding it into the label', () => {
    expect(itemsSrc).toContain('label: labels.wiki');
    expect(itemsSrc).toContain('label: labels.actual');
    expect(itemsSrc).not.toContain('dropLabelWithArt');
  });

  /**
   * `size-3.5`, not the `size-4` the phase tables use: this panel's rows are an 11px/14.85px
   * line box against the tables' 12px/16px, so a 16px sprite overflows and grows every row it
   * lands on by a pixel. Measured at 14px the rows match their pre-icon height exactly.
   */
  it('sizes the drop art to this panel’s line box, not the phase tables’', () => {
    // Asserted on the emitted class list, not the file: the doc comment above it names `size-4`
    // to explain why this is not that, so a whole-file `not.toContain` would match the prose.
    const classList = iconSrc.match(/cn\((['"])([^'"]+)\1/)?.[2] ?? '';
    expect(classList, 'DropIcon class list').toContain('size-3.5');
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
  const mixSrc = read('features/phases/components/phase-prop-mix-table.tsx');
  const fitSrc = read('features/phases/components/phases-hero-fit-table.tsx');

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
    const iconSrc = read('shared/game-art/prop-icon.tsx');
    expect(iconSrc).toContain('alt=""');
    expect(iconSrc).toContain('aria-hidden');
    // `size-4` matches the dense row's `text-xs` line box, so the rows do not grow.
    expect(iconSrc).toContain('size-4');
    expect(iconSrc).not.toContain('role="img"');
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
