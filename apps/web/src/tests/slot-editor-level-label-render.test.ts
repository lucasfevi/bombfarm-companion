import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ITEM_LEVELS, defsForSlot, setsForLevel, type EquippedItem } from '@bombfarm/domain/gear';
import { setName } from '@bombfarm/domain/game-labels';
import { SlotEditor } from '@/features/gear/components/slot-editor';
import { STRINGS, sub, type Lang } from '@/shared/i18n';

/**
 * #106 — the level option's label is now composed, not literal: `sub(t.itemLevelOpt, { n, set })`
 * fills a `{set}` placeholder the string did not carry before.
 *
 * `sub()` resolves an unknown key to `''` and does not throw (`shared/i18n/format.ts`), so a typo
 * in the CALL SITE's key (`set:` → `sett:`) silently renders "Nível 20 - " for all 30 options —
 * typecheck stays green (the `vars` record is `Record<string, string | number>`, any key is
 * assignable) and so does every source-text assertion, because the source still *contains*
 * `setName(setsForLevel(levelOption)[0]`. That substring check is what `slot-compare-chrome.test.ts`
 * does; it cannot see this class of defect.
 *
 * These assertions read the component's RENDERED output instead: `SlotEditor` is server-rendered
 * and the level control's text is pulled back out of the markup. The set segment being non-empty is
 * asserted structurally (`\S` after the separator), so the test fails on an empty substitution
 * regardless of which key was mistyped.
 *
 * Note the `<option>` children never reach the DOM — `@bombfarm/ui`'s `Select` converts them to
 * Base UI popup items behind a `Portal`, which renders nothing server-side. The selected level's
 * label does render, in the trigger, so each level is made the selected one in turn: 30 levels ×
 * 2 languages, every composed label observed as text.
 */

/** Strips the level control out of the rendered markup and returns its visible text. */
function renderedLevelLabel(lang: Lang, equipped: EquippedItem | null): string {
  const strings = STRINGS[lang];
  const markup = renderToStaticMarkup(
    createElement(SlotEditor, {
      slot: 'arma',
      equipped,
      t: strings,
      lang,
      onPatch: () => {},
    }),
  );
  // The level control is identified by its own accessible name, not by a class or position.
  const start = markup.indexOf(`aria-label="${strings.itemLevel}"`);
  expect(start, `no control labelled "${strings.itemLevel}" in the rendered markup`).toBeGreaterThan(-1);
  // `start` lands inside the open tag — step past its `>` so the remaining attributes are not
  // mistaken for text, then take everything up to the control's close tag.
  const contentStart = markup.indexOf('>', start) + 1;
  const end = markup.indexOf('</button>', contentStart);
  expect(end, 'level control is not a closed button element').toBeGreaterThan(contentStart);
  return markup
    .slice(contentStart, end)
    .replace(/<[^>]*>/g, '')
    .trim();
}

function equippedAt(level: number): EquippedItem {
  const definition = defsForSlot('arma', setsForLevel(level)[0])[0];
  expect(definition, `no arma definition for level ${level}`).toBeDefined();
  return { defId: definition.id, rarityIdx: 0, level, upgrade: 0 };
}

/** "Level 20 - Gold" / "Nível 20 - Ouro" — a non-empty set segment after the separator. */
const COMPOSED_LEVEL_LABEL = /^(Level|Nível) \d+ - \S/;

describe('slot editor level option label (rendered, not source text)', () => {
  it('non-vacuity: the catalog offers levels to render', () => {
    expect(ITEM_LEVELS.length).toBeGreaterThan(20);
  });

  it('renders a non-empty set segment for the empty slot, in both languages', () => {
    for (const lang of ['en', 'pt'] as const) {
      const label = renderedLevelLabel(lang, null);
      expect(label, `${lang}: empty slot's default level label`).toMatch(COMPOSED_LEVEL_LABEL);
      // …and it is the set the level actually implies, not merely some non-empty text.
      expect(label).toBe(
        sub(STRINGS[lang].itemLevelOpt, { n: 10, set: setName(setsForLevel(10)[0] ?? '', lang) }),
      );
    }
  });

  it('renders a non-empty set segment for every catalog level, in both languages', () => {
    const offenders: string[] = [];
    let observed = 0;
    for (const lang of ['en', 'pt'] as const) {
      for (const level of ITEM_LEVELS) {
        const label = renderedLevelLabel(lang, equippedAt(level));
        observed++;
        if (!COMPOSED_LEVEL_LABEL.test(label)) {
          offenders.push(`${lang} level ${level}: ${JSON.stringify(label)}`);
          continue;
        }
        const expected = sub(STRINGS[lang].itemLevelOpt, {
          n: level,
          set: setName(setsForLevel(level)[0] ?? '', lang),
        });
        if (label !== expected) {
          offenders.push(`${lang} level ${level}: rendered ${JSON.stringify(label)}, expected ${JSON.stringify(expected)}`);
        }
      }
    }
    // A broken render helper that returned nothing would otherwise pass this silently.
    expect(observed, 'level labels actually pulled out of rendered markup').toBe(ITEM_LEVELS.length * 2);
    expect(offenders, `labels with an empty or wrong set segment:\n${offenders.join('\n')}`).toEqual([]);
  });
});
