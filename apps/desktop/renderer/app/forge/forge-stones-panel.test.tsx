import { describe, expect, it } from 'vitest';
import { Fragment, createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildInventoryView, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { CopyProvider, sub } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import { resolveStoneRanges, stonesByTarget, type ForgeStoneRange } from '../../lib/forge/forge-stones';
import { forgePlanForecast } from '../../lib/forge/use-forge-plan';
import { forgeButtonReason, forgeLabels, type ForgeButtonReason } from './forge-labels';
import { ForgeForecastPanel, ForgePlanPanel } from './forge-plan-panel';

const labels = forgeLabels(en, 'en', 'en');

type PlanSectionProps = ComponentProps<typeof ForgeForecastPanel> & { onStepTarget: () => void };

/** The setup and the forecast the screen draws side by side, rendered together. */
function planSections(props: PlanSectionProps) {
  const running = props.reason === 'running' || props.reason === 'cancelling';
  return createElement(
    Fragment,
    null,
    createElement(ForgePlanPanel, { ...props, running, onMaxGoldChange: () => undefined, onAttemptsChange: () => undefined, onScrollChange: () => undefined, onStoneEdit: () => undefined }),
    createElement(ForgeForecastPanel, props),
  );
}

const FROM = 8;
const TARGET = 13;

function piece(): InventoryViewItem {
  const found = buildInventoryView([
    { id: 'g1', def_id: 'steel_luva', category: 0, set: 'steel', rarity: 2, level: 20, upgrade: FROM, power: 1, stats: [] },
  ]).items[0];
  if (!found) throw new Error('no test row');
  return found;
}

function renderPanel(stones: readonly ForgeStoneRange[], owned: readonly number[], reason: ForgeButtonReason = 'ready') {
  const ranges = resolveStoneRanges(stones, FROM, TARGET);
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: planSections({
        item: piece(),
        plan: { itemId: 'g1', target: TARGET, maxGold: null, attempts: null, stones, scroll: false },
        forecast: forgePlanForecast(FROM, TARGET, 20, 2, 0, 0, stonesByTarget(ranges)),
        stoneRanges: ranges,
        ownedStones: owned,
        walletGold: null,
        reason,
        startRefusal: null,
        labels,
        onStepTarget: () => undefined,
        onForge: () => undefined,
        onCancel: () => undefined,
      }),
    }),
  );
}

const ladderChances = (html: string) =>
  [...html.matchAll(/data-testid="forge-ladder-rung"[^>]*>.*?<span class="[^"]*text-right[^"]*">([^<]+)</gs)].map((m) => m[1]);

describe('the Chance Stones control', () => {
  it('starts as one range of no stone, with nothing expected to be spent', () => {
    const html = renderPanel([], [0, 0, 0, 0, 0, 0]);
    expect(html.match(/data-testid="forge-stone-range"/g)).toHaveLength(1);
    expect(html).not.toContain('data-testid="forge-stones-notice"');
    expect(html).not.toContain('data-testid="forge-ladder-stone"');
    expect(html).not.toContain('data-testid="forge-stones-join"');
    expect(html).not.toContain('data-testid="forge-stones-help"');
    expect(html).toContain(`aria-label="${en.forgeStonesTitle}: Pick the Chance Stone each roll uses.`);
    const face = html.split('data-testid="forge-stone-face"')[1]?.split('</button>')[0] ?? '';
    expect(face).toContain('data-testid="forge-stone-placeholder"');
    expect(face).toContain('>None<');
    expect(html).not.toMatch(/data-testid="forge-fact-stones-/);
  });

  it('lists one row per range and the stone expected for each rarity, with what the player holds', () => {
    const html = renderPanel(
      [
        { upTo: 10, rarity: 0 },
        { upTo: 13, rarity: 2 },
      ],
      [4, 0, 9, 0, 0, 0],
    );
    expect(html.match(/data-testid="forge-stone-range"/g)).toHaveLength(2);
    expect(html).toMatch(/data-testid="forge-fact-stones-0"[^>]*>[\d.,]+ of 4 owned</);
    expect(html).toMatch(/data-testid="forge-fact-stones-2"[^>]*>[\d.,]+ of 9 owned</);
    expect(html).toContain('data-testid="forge-stones-join"');
    expect(html).not.toMatch(/data-testid="forge-fact-stones-protected-2"/);
    expect(html).not.toMatch(/data-testid="forge-fact-stones-1"/);
  });

  it('raises the odds the ladder prints and names the stone on each rung it covers', () => {
    const plain = ladderChances(renderPanel([], [0, 0, 0, 0, 0, 0]));
    const stoned = ladderChances(renderPanel([{ upTo: 13, rarity: 5 }], [0, 0, 0, 0, 0, 0]));
    expect(plain.length).toBeGreaterThan(0);
    expect(stoned.length).toBe(plain.length);
    const percent = (text: string | undefined) => Number((text ?? '').replace('%', ''));
    stoned.forEach((chance, index) => {
      expect(percent(chance)).toBeGreaterThan(percent(plain[index]));
    });
  });

  it('shows each rung the stone it uses, with the base chance and what the stone adds', () => {
    const html = renderPanel([{ upTo: 13, rarity: 3 }], [0, 0, 0, 4, 0, 0]);
    const rungs = html.split('data-testid="forge-ladder-rung"').slice(1);
    expect(rungs).toHaveLength(5);
    rungs.forEach((rung) => {
      expect(rung).toContain('data-testid="forge-ladder-stone"');
      expect(rung).toContain('data-rarity="3"');
      expect(rung).toContain('data-state="used"');
      expect(rung).toContain('+40%');
    });
    expect(rungs[0]).toContain('50% <span');
  });

  it('draws each chosen stone with its own art, its bonus, its name and how many are owned', () => {
    const html = renderPanel(
      [
        { upTo: 10, rarity: 2 },
        { upTo: 13, rarity: 3 },
      ],
      [0, 0, 7, 0, 0, 0],
    );
    expect(html).toMatch(/<img[^>]*src="\/wiki-assets\/stones\/chance_stone_rare\.png"/);
    expect(html).toMatch(/<img[^>]*src="\/wiki-assets\/stones\/chance_stone_epic\.png"/);
    const faces = html.split('data-testid="forge-stone-face"').slice(1).map((part) => part.split('</button>')[0] ?? '');
    expect(faces[0]).toContain('+30% chance');
    expect(faces[0]).not.toContain('Rare');
    expect(faces[0]).toContain('7 owned');
    expect(faces[1]).toContain('+40% chance');
    expect(faces[1]).not.toContain('Epic');
    expect(faces[1]).toContain('0 owned');
    expect(faces[1]).toContain('text-down');
  });

  it('warns, without blocking, when the climb expects more stones than are held', () => {
    const short = renderPanel([{ upTo: 13, rarity: 1 }], [0, 1, 0, 0, 0, 0]);
    expect(short).toMatch(/data-testid="forge-stones-notice"[^>]*data-state="short"/);
    expect(short).toContain('You own 1 of the ');
    expect(short).toContain('Uncommon Chance Stones this climb should use');
    expect(short.match(/data-testid="forge-stones-notice"/g)).toHaveLength(1);
    expect(short).toMatch(/data-testid="forge-fact-stones-1"[^>]*class="text-warn"/);
    const enough = renderPanel([{ upTo: 13, rarity: 1 }], [0, 99, 0, 0, 0, 0]);
    expect(enough).not.toContain('data-testid="forge-stones-notice"');
  });

  it('says a stone is not used on the targets that always land', () => {
    const from0 = renderToStaticMarkup(
      createElement(CopyProvider, {
        locale: 'en',
        children: planSections({
          item: { ...piece(), upgrade: 0 },
          plan: { itemId: 'g1', target: 13, maxGold: null, attempts: null, stones: [{ upTo: 13, rarity: 3 }], scroll: false },
          forecast: null,
          stoneRanges: resolveStoneRanges([{ upTo: 13, rarity: 3 }], 0, 13),
          ownedStones: [0, 0, 0, 0, 0, 0],
          walletGold: null,
          reason: 'ready',
          startRefusal: null,
          labels,
          onStepTarget: () => undefined,
          onForge: () => undefined,
          onCancel: () => undefined,
        }),
      }),
    );
    expect(from0).toMatch(/data-testid="forge-stone-refused"[^>]*>Levels up to \+4 always land/);
    expect(from0.match(/data-state="refused"/g)).toHaveLength(4);
    expect(from0.match(/data-state="used"/g)).toHaveLength(9);
  });
});

describe('forging with a stone chosen', () => {
  it('leaves the button armed: a chosen stone is no longer a reason to refuse a run', () => {
    const html = renderPanel([{ upTo: 13, rarity: 2 }], [0, 0, 5, 0, 0, 0]);
    expect(/<button[^>]*data-testid="forge-button"[^>]*>/.exec(html)?.[0]).not.toContain(' disabled=""');
    const idle = { upgrade: 8, accountSource: 'server', forgeWritesEnabled: true, running: false, cancelRequested: false } as const;
    expect(forgeButtonReason(idle)).toBe('ready');
  });

  it('says nothing about stones that are held in enough number, and keeps what they do in a tip', () => {
    const html = renderPanel(
      [
        { upTo: 10, rarity: 0 },
        { upTo: 13, rarity: 2 },
      ],
      [4, 0, 90, 0, 0, 0],
    );
    expect(html).not.toContain('data-testid="forge-stones-notice"');
    expect(html).toContain(`aria-label="${en.forgeStonesTitle}: A Chance Stone is spent on every roll it is used on`);
    expect(html).not.toContain('data-testid="forge-stone-note"');
  });

  it('prints each shortfall as one compact line with a warning icon', () => {
    const html = renderPanel(
      [
        { upTo: 10, rarity: 0 },
        { upTo: 13, rarity: 2 },
      ],
      [1, 0, 90, 0, 0, 0],
    );
    const notices = [...html.matchAll(/data-testid="forge-stones-notice"[^>]*data-rarity="(\d)"[^>]*>(.*?)<\/p>/gs)];
    expect(notices.map((match) => match[1])).toEqual(['0']);
    expect(notices[0]?.[2]).toMatch(/^<span[^>]*>/);
    expect(notices[0]?.[2]).toContain('Common Chance Stones this climb should use');
  });

  it('warns that the run stops at once when none of the chosen kind is held', () => {
    const html = renderPanel([{ upTo: 13, rarity: 3 }], [0, 0, 0, 0, 0, 0]);
    expect(html).toContain('No Epic Chance Stones owned: the run stops at the first roll that needs one');
  });

  it('names no stone for a choice confined to the rolls that always land', () => {
    expect(renderPanel([{ upTo: 13, rarity: null }], [4, 0, 0, 0, 0, 0])).not.toContain('data-testid="forge-stones-notice"');
  });
});

describe('the range cards and the picker', () => {
  const two = [
    { upTo: 10, rarity: 0 },
    { upTo: 13, rarity: 2 },
  ];

  it('anchors each remove button to the card corner with no background of its own', () => {
    const html = renderPanel(two, [4, 0, 9, 0, 0, 0]);
    const buttons = html.match(/<button[^>]*data-testid="forge-stone-remove"[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(2);
    buttons.forEach((button) => {
      expect(button).toContain('absolute');
      expect(button).toContain('-top-1');
      expect(button).toContain('-right-1');
      expect(button).toContain('bg-transparent');
      expect(button).toContain(`aria-label="${en.forgeStonesRemove}"`);
    });
    const cards = html.split('data-testid="forge-stone-range"').slice(1);
    cards.forEach((card) => {
      expect(card.split('>')[0]).toContain('relative');
    });
  });

  it('reserves the stone art box when no stone is chosen, so the picker is as tall either way', () => {
    const none = renderPanel([], [0, 0, 0, 0, 0, 0]);
    const chosen = renderPanel([{ upTo: 13, rarity: 2 }], [0, 0, 5, 0, 0, 0]);
    expect(none).toContain('w-7');
    expect(none).toContain('aspect-[18/19]');
    expect(chosen).toMatch(/<img[^>]*chance_stone_rare/);
    expect(chosen).not.toContain('data-testid="forge-stone-placeholder"');
  });

  it('reads the chosen stone as its bonus and the word chance, in both languages', () => {
    expect(sub(en.forgeStonesFace, { bonus: '+30%' })).toBe('+30% chance');
    expect(sub(ptBR.forgeStonesFace, { bonus: '+30%' })).toBe('+30% de chance');
    expect(sub(ptBR.forgeStonesOwned, { count: '48' })).toBe('48 no inventário');
  });

  it('explains every control in the section tip, in both languages', () => {
    for (const copy of [en, ptBR]) {
      const tip = sub(copy.forgeStonesTip, { join: copy.forgeStonesJoin, split: copy.forgeStonesSplit, none: copy.forgeStonesNone });
      [copy.forgeStonesJoin, copy.forgeStonesSplit, copy.forgeStonesNone].forEach((control) => {
        expect(tip).toContain(control);
      });
    }
  });
});
