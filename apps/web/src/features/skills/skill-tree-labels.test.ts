import { describe, expect, it } from 'vitest';
import { SKILL_ARMS, SKILL_EFFECT_KINDS, SKILL_TIERS, SKILL_TOTALS_KEYS } from '@bombfarm/domain/skill-tree';
import { STRINGS } from '@/shared/i18n';
import { formatSkillTotal, skillTreeLabels } from './skill-tree-labels';

const en = skillTreeLabels(STRINGS.en, 'en');
const pt = skillTreeLabels(STRINGS.pt, 'pt');

describe('skillTreeLabels', () => {
  it('names every arm, tier and effect kind in both languages, with the game\'s own words', () => {
    for (const labels of [en, pt]) {
      for (const arm of SKILL_ARMS) expect(labels.armName(arm)).not.toBe('');
      for (const tier of SKILL_TIERS) expect(labels.tierName(tier)).not.toBe('');
      for (const kind of SKILL_EFFECT_KINDS) expect(labels.kindName(kind)).not.toBe('');
    }
    expect(en.kindName('team_dmg')).toBe('Squad Damage');
    expect(pt.kindName('team_dmg')).toBe('Dano do Esquadrão');
    expect(en.armName('neutro')).toBe('Neutral Axis');
    expect(pt.armName('drop')).toBe('Drop/Sorte');
  });

  it('prints a percent effect as a signed two-decimal percentage and a count effect as a count', () => {
    expect(en.effectPerLevel('team_dmg', 0.005)).toBe('+0.50% squad damage');
    expect(pt.effectPerLevel('team_dmg', 0.005)).toBe('+0,50% dano do esquadrão');
    expect(en.effectPerLevel('vagas_campo', 1)).toBe('+1 hero on the field');
    expect(pt.effectPerLevel('bag_tab', 1)).toBe('+1 aba de bolsa');
    expect(en.effectAtLevel('g_luck', 0.1)).toBe('+10.00% luck (chests)');
  });

  it('formats every totals row the way the game sums it', () => {
    expect(formatSkillTotal('team_dmg_add', 0.888814815, 'en')).toBe('+88.88%');
    expect(formatSkillTotal('team_dmg_add', 0.888814815, 'pt')).toBe('+88,88%');
    expect(formatSkillTotal('geo_mult', 1.19177608, 'en')).toBe('×1.192');
    expect(formatSkillTotal('xp_mult', 1.5, 'en')).toBe('×1.5');
    expect(formatSkillTotal('dmg_static', 2, 'pt')).toBe('×2');
    expect(formatSkillTotal('vagas_campo', 8, 'en')).toBe('+8');
    expect(formatSkillTotal('bag_tabs_bonus', 1, 'en')).toBe('+1');
    for (const key of SKILL_TOTALS_KEYS) {
      expect(en.totalRows[key]).not.toBe('');
      expect(en.formatTotal(key, 1)).not.toBe('');
    }
  });

  it('prints gold per hour with three significant digits', () => {
    expect(en.goldPerHour?.(4_300_000)).toBe('4.30m/h');
    expect(en.goldPerHour?.(3_900)).toBe('3.90k/h');
  });
});
