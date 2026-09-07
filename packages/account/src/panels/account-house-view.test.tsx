import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AccountHouseView,
  type AccountHouseLabels,
  type AccountHouseViewProps,
} from './account-house-view.js';

function labelsTagged(tag: string): AccountHouseLabels {
  return {
    title: `${tag}-panelTitle`,
    tip: `${tag}-upgradeTip`,
    tipMaxed: `${tag}-maxedTip`,
    house: `${tag}-houseRow`,
    level: `${tag}-levelRow`,
    cycle: `${tag}-cycleRow`,
    cycleTip: `${tag}-cycleHint`,
    slots: `${tag}-slotsRow`,
    slotsTip: `${tag}-slotsHint`,
    houseName: (houseIndex) => `${tag}-casa${String(houseIndex)}`,
    nextHouseHeading: (houseName) => `${tag}-nextUp[${houseName}]`,
    levelOfMax: (level, maxLevel) => `${tag}-lvl${String(level)}of${String(maxLevel)}`,
    cycleDuration: (totalSeconds) => `${tag}-dur${String(totalSeconds)}`,
    cycleDelta: (deltaSeconds) => `${tag}-cycleGap${String(deltaSeconds)}`,
    slotsDelta: (delta) => `${tag}-slotGap${String(delta)}`,
  };
}

function render(props: Partial<AccountHouseViewProps> = {}) {
  return renderToStaticMarkup(
    <AccountHouseView
      houseIndex={0}
      houseLevel={7}
      slots={3}
      restSeconds={1180}
      labels={labelsTagged('aa')}
      {...props}
    />,
  );
}

function flatten(fragment: string): string {
  return fragment
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rows(html: string): { label: string; value: string }[] {
  return [...html.matchAll(/<dt[^>]*>(.*?)<\/dt><dd[^>]*>(.*?)<\/dd>/g)].map((match) => ({
    label: flatten(match[1] ?? ''),
    value: flatten(match[2] ?? ''),
  }));
}

function textChunks(html: string): string[] {
  return html
    .split(/<[^>]*>/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

describe('AccountHouseView — what the account has now', () => {
  it('lists the House, its level against the cap, its cycle and its recovery slots', () => {
    const labels = labelsTagged('aa');

    expect(rows(render()).slice(0, 4)).toEqual([
      { label: labels.house, value: labels.houseName(0) },
      { label: labels.level, value: labels.levelOfMax(7, 20) },
      { label: labels.cycle, value: labels.cycleDuration(1180) },
      { label: labels.slots, value: '3' },
    ]);
  });

  it('shows the House art for the House the account owns, not a fixed picture', () => {
    const first = /<img[^>]*src="([^"]*)"/.exec(render())?.[1];
    const last = /<img[^>]*src="([^"]*)"/.exec(render({ houseIndex: 4 }))?.[1];

    expect(first).toMatch(/houses\//);
    expect(last).not.toBe(first);
  });
});

describe('AccountHouseView — the next House', () => {
  it('adds the next House block, headed by that House, while one is left to buy', () => {
    const labels = labelsTagged('aa');
    const html = render();

    expect(html).toContain(labels.nextHouseHeading(labels.houseName(1)));
    expect(rows(html)).toHaveLength(6);
    expect(html).toContain(labels.tip);
  });

  it('drops the block entirely on the last House, and says so in the tip instead', () => {
    const labels = labelsTagged('aa');
    const html = render({ houseIndex: 4, slots: 9 });

    expect(html).not.toContain('aa-nextUp');
    expect(rows(html)).toHaveLength(4);
    expect(html).toContain(labels.tipMaxed);
    expect(html).not.toContain(labels.tip);
  });

  it('quotes the next House at level 1, the base the game reports for a House not yet levelled', () => {
    const labels = labelsTagged('aa');

    expect(rows(render())[4]?.value).toContain(labels.cycleDuration(1080));
  });
});

describe('AccountHouseView — which direction is an improvement', () => {
  it('marks a shorter cycle as a gain', () => {
    expect(render({ restSeconds: 1200 })).toContain(
      '<span class="text-up">aa-cycleGap-120</span>',
    );
  });

  it('marks a longer cycle as a loss, because for a cycle less is better', () => {
    expect(render({ restSeconds: 600 })).toContain('<span class="text-down">aa-cycleGap480</span>');
  });

  it('marks more slots as a gain', () => {
    expect(render({ slots: 3 })).toContain('<span class="text-up">aa-slotGap2</span>');
  });

  it('marks fewer slots as a loss, because for slots more is better', () => {
    expect(render({ slots: 9 })).toContain('<span class="text-down">aa-slotGap-4</span>');
  });
});

describe('AccountHouseView — an upgrade that changes nothing', () => {
  it('prints no slots delta when the next House adds no slots', () => {
    const labels = labelsTagged('aa');
    const slotsDelta = vi.fn(labels.slotsDelta);
    const html = render({ houseIndex: 3, slots: 9, restSeconds: 800, labels: { ...labels, slotsDelta } });

    expect(slotsDelta).not.toHaveBeenCalled();
    expect(html).not.toContain('aa-slotGap');
  });

  it('still prints the cycle delta of that same upgrade, so the block is not merely absent', () => {
    const html = render({ houseIndex: 3, slots: 9, restSeconds: 800 });

    expect(html).toContain('<span class="text-up">aa-cycleGap-140</span>');
    expect(rows(html)[5]?.value).toBe('9');
  });

  it('prints no cycle delta when the next House keeps the same cycle', () => {
    const labels = labelsTagged('aa');
    const cycleDelta = vi.fn(labels.cycleDelta);
    const html = render({ restSeconds: 1080, labels: { ...labels, cycleDelta } });

    expect(cycleDelta).not.toHaveBeenCalled();
    expect(html).not.toContain('aa-cycleGap');
    expect(html).toContain('aa-slotGap2');
  });
});

describe('AccountHouseView — where its words come from', () => {
  it('prints no word of its own — every string comes from the label bag or a prop', () => {
    const labels = labelsTagged('aa');
    const supplied = new Set<string>([
      ...Object.values(labels).filter((value): value is string => typeof value === 'string'),
      labels.houseName(0),
      labels.houseName(1),
      labels.nextHouseHeading(labels.houseName(1)),
      labels.levelOfMax(7, 20),
      labels.cycleDuration(1180),
      labels.cycleDuration(1080),
      labels.cycleDelta(-100),
      labels.slotsDelta(2),
    ]);

    const unexplained = textChunks(render()).filter(
      (chunk) => !supplied.has(chunk) && !/^\d+$/.test(chunk),
    );

    expect(unexplained).toEqual([]);
  });

  it('changes every word when a differently worded bag is supplied', () => {
    const html = render({ labels: labelsTagged('bb') });

    expect(html).not.toContain('aa-');
    expect(html).toContain('bb-panelTitle');
  });
});
