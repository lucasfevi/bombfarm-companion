import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AccountTreeView,
  type AccountTreeLabels,
  type AccountTreeViewProps,
} from './account-tree-view.js';

function labelsTagged(tag: string): AccountTreeLabels {
  return {
    title: `${tag}-panelTitle`,
    tip: `${tag}-panelTip`,
    groupDamage: `${tag}-groupDamage`,
    groupField: `${tag}-groupField`,
    groupRewards: `${tag}-groupRewards`,
    squadDamage: `${tag}-rowSquad`,
    geoMultiplier: `${tag}-rowGeo`,
    totalDamage: `${tag}-rowTotal`,
    critChance: `${tag}-rowCritChance`,
    critDamage: `${tag}-rowCritDamage`,
    speed: `${tag}-rowSpeed`,
    energy: `${tag}-rowEnergy`,
    fieldSlots: `${tag}-rowFieldSlots`,
    fieldSlotsTip: `${tag}-fieldSlotsHint`,
    gold: `${tag}-rowGold`,
    goldTip: `${tag}-goldHint`,
    luck: `${tag}-rowLuck`,
    xp: `${tag}-rowXp`,
    bagTabs: `${tag}-rowBagTabs`,
    percent: (value) => `${tag}-pct${String(value)}`,
    multiplier: (value) => `${tag}-mult${String(value)}`,
    luckPoints: (value) => `${tag}-pp${String(value)}`,
    bonus: (value) => `${tag}-plus${String(value)}`,
    totalDamageTip: (squad, geo, total) =>
      `${tag}-working[${String(squad)}|${String(geo)}|${String(total)}]`,
    bonusOfTotal: (bonus, total) => `${tag}-bonusOf[${String(bonus)}/${String(total)}]`,
  };
}

function render(props: Partial<AccountTreeViewProps> = {}) {
  return renderToStaticMarkup(
    <AccountTreeView
      squadDamagePct={12.5}
      geoMultiplier={1.234}
      totalDamage={1.388}
      critChancePct={8}
      critDamagePct={40}
      speedPct={15}
      energyPct={20}
      teamCoinPct={30}
      luckFlatPct={2.5}
      xpMultiplier={1.5}
      fieldSlotsBonus={5}
      bagTabsBonus={2}
      fieldSlots={6}
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

function groups(html: string): { heading: string; listLabel: string; rows: ReturnType<typeof rows> }[] {
  return html
    .split('<h3')
    .slice(1)
    .map((segment) => ({
      heading: /^[^>]*>([^<]*)</.exec(segment)?.[1] ?? '',
      listLabel: /<dl[^>]*aria-label="([^"]*)"/.exec(segment)?.[1] ?? '',
      rows: rows(segment),
    }));
}

function textChunks(html: string): string[] {
  return html
    .split(/<[^>]*>/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

describe('AccountTreeView — the three groups', () => {
  it('renders damage, then field, then rewards, each under its own heading', () => {
    const labels = labelsTagged('aa');

    expect(groups(render()).map((group) => group.heading)).toEqual([
      labels.groupDamage,
      labels.groupField,
      labels.groupRewards,
    ]);
  });

  it('names each group on its own list, so the rows are not one undifferentiated run', () => {
    const labels = labelsTagged('aa');

    expect(groups(render()).map((group) => group.listLabel)).toEqual([
      labels.groupDamage,
      labels.groupField,
      labels.groupRewards,
    ]);
  });

  it('rules a separator between groups but not above the first', () => {
    const html = render();
    const separator = 'mt-3 border-t border-line pt-3';

    expect(html.split(separator)).toHaveLength(3);
    expect(html.slice(0, html.indexOf('<h3'))).not.toContain('border-t');
  });

  it('puts each stat in the group it belongs to', () => {
    const labels = labelsTagged('aa');
    const [damage, field, rewards] = groups(render());

    expect(damage?.rows).toEqual([
      { label: labels.squadDamage, value: labels.percent(12.5) },
      { label: labels.geoMultiplier, value: labels.multiplier(1.234) },
      { label: labels.totalDamage, value: labels.multiplier(1.388) },
      { label: labels.critChance, value: labels.percent(8) },
      { label: labels.critDamage, value: labels.percent(40) },
    ]);
    expect(field?.rows).toEqual([
      { label: labels.speed, value: labels.percent(15) },
      { label: labels.energy, value: labels.percent(20) },
      { label: labels.fieldSlots, value: labels.bonusOfTotal(5, 6) },
    ]);
    expect(rewards?.rows).toEqual([
      { label: labels.gold, value: labels.percent(30) },
      { label: labels.luck, value: labels.luckPoints(2.5) },
      { label: labels.xp, value: labels.multiplier(1.5) },
      { label: labels.bagTabs, value: labels.bonus(2) },
    ]);
  });
});

describe('AccountTreeView — the field-slots row', () => {
  it('shows the bonus over the usable total when the total is known', () => {
    const labels = labelsTagged('aa');
    const bonus = vi.fn(labels.bonus);
    const html = render({ labels: { ...labels, bonus } });

    expect(groups(html)[1]?.rows[2]?.value).toBe(labels.bonusOfTotal(5, 6));
    expect(bonus.mock.calls).toEqual([[2]]);
  });

  it('shows the bonus alone when the account reported no usable total', () => {
    const labels = labelsTagged('aa');
    const bonusOfTotal = vi.fn(labels.bonusOfTotal);
    const html = render({ fieldSlots: null, labels: { ...labels, bonusOfTotal } });

    expect(groups(html)[1]?.rows[2]?.value).toBe(labels.bonus(5));
    expect(bonusOfTotal).not.toHaveBeenCalled();
  });
});

describe('AccountTreeView — the damage tip', () => {
  it('hands the bag the two factors and the total, unformatted, so it can print the working', () => {
    const labels = labelsTagged('aa');
    const totalDamageTip = vi.fn(labels.totalDamageTip);
    render({ labels: { ...labels, totalDamageTip } });

    expect(totalDamageTip.mock.calls).toEqual([[12.5, 1.234, 1.388]]);
  });

  it('attaches that working to the total-damage row', () => {
    const labels = labelsTagged('aa');

    expect(render()).toContain(
      `aria-label="${labels.totalDamage}: ${labels.totalDamageTip(12.5, 1.234, 1.388)}"`,
    );
  });
});

describe('AccountTreeView — where its words come from', () => {
  it('prints no word of its own — every string comes from the label bag', () => {
    const labels = labelsTagged('aa');
    const supplied = new Set<string>([
      ...Object.values(labels).filter((value): value is string => typeof value === 'string'),
      labels.percent(12.5),
      labels.percent(8),
      labels.percent(40),
      labels.percent(15),
      labels.percent(20),
      labels.percent(30),
      labels.multiplier(1.234),
      labels.multiplier(1.388),
      labels.multiplier(1.5),
      labels.luckPoints(2.5),
      labels.bonus(2),
      labels.bonusOfTotal(5, 6),
    ]);

    expect(textChunks(render()).filter((chunk) => !supplied.has(chunk))).toEqual([]);
  });

  it('changes every word when a differently worded bag is supplied', () => {
    const html = render({ labels: labelsTagged('bb') });

    expect(html).not.toContain('aa-');
    expect(html).toContain('bb-panelTitle');
  });
});
