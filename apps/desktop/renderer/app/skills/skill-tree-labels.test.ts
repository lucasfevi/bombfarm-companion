import { describe, expect, it } from 'vitest';
import { SKILL_ARMS, SKILL_EFFECT_KINDS, SKILL_TIERS, SKILL_TOTALS_KEYS } from '@bombfarm/domain/skill-tree';
import { STRINGS } from '../../lib/copy';
import { formatSkillTotal, skillTreeLabels } from './skill-tree-labels';

const en = skillTreeLabels(STRINGS.en, 'en');
const pt = skillTreeLabels(STRINGS['pt-BR'], 'pt');

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

  it('prints gains signed, in the Farm board\'s own rate shape, and an em dash for a figure it cannot give', () => {
    expect(en.gainGold(12_300)).toBe('+12.3k/h');
    expect(en.gainGold(-800)).toBe('−800/h');
    expect(en.gainDps(340)).toBe('+340 DPS');
    expect(en.perMillionGold(Number.POSITIVE_INFINITY)).toBe('—');
    expect(pt.perMillionDps(1_500)).toBe('+1,5k DPS');
  });

  it('fills every sentence with its figures', () => {
    expect(en.level(3, 10)).toBe('Level 3/10');
    expect(en.stateLockedPrerequisite('Devastation', 5, 2)).toBe('Needs Devastation at level 5 — you have 2');
    expect(pt.stateLockedPhase(80)).toBe('Desbloqueia após a fase 80');
    expect(en.gold(1_234_567)).toBe('1,234,567 gold');
    expect(pt.goldCompact(1_234_567)).toBe('1,2m');
    expect(en.treeProgress(120, 400)).toBe('120 of 400 levels bought');
    expect(en.nodeAria('Devastation', 2, 5)).toBe('Devastation, level 2 of 5');
    expect(en.totalNowNext('+5%', '+6%')).toBe('+5% → +6%');
    expect(en.goldPerHour?.(4_300_000)).toBe('4.30m/h');
    expect(en.goldPerHour?.(3_900)).toBe('3.90k/h');
    expect(en.previewGoldAtRoster).toBe('Gold per hour at this roster');
    expect(pt.previewGoldAtRoster).toBe('Ouro por hora neste elenco');
  });
});
