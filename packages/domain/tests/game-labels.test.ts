import { describe, expect, it } from 'vitest';
import {
  abilityEffectText,
  abilityName,
  formatItemDisplay,
  formatItemRosterTooltip,
  houseLabel,
  itemRarityLabel,
  itemStatLabel,
  propLabel,
  rarityLabel,
  setName,
  slotLabel,
  statLabel,
  teamBuffLabel,
} from '@bombfarm/domain/game-labels';
import { ABILITIES, HOUSES, STAT_LABELS, type RarityKey, type StatKey } from '@bombfarm/domain/model';
import { ITEM_RARITIES, SLOTS, type Slot } from '@bombfarm/domain/gear';
import { TEAM_BUFF_ABILITY_IDS, TEAM_BUFF_FIELDS } from '@bombfarm/domain/team-buffs';
import { PROPS } from '@bombfarm/domain/phases';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { LOOT_ABILITY_VALUES } from '@bombfarm/domain/phase-wiki';
import catalog from '@bombfarm/domain/data/catalog.json';

describe('abilityName / abilityEffectText', () => {
  it('covers every ABILITIES id for pt and en', () => {
    for (const a of ABILITIES) {
      expect(abilityName(a.id, 'pt')).toBe(a.name);
      expect(abilityEffectText(a.id, 'pt')).toBe(a.effectText);
      const enName = abilityName(a.id, 'en');
      const enFx = abilityEffectText(a.id, 'en');
      expect(enName).not.toBe(a.id);
      expect(enName).not.toBe(a.name);
      expect(enFx).not.toBe(a.id);
      expect(enFx).not.toBe(a.effectText);
    }
  });

  it('keeps effect-text numbers aligned with AbilityEffect.perLevel (W3 rank-20 curves)', () => {
    // Spot-check modeled abilities: EN copy must mention the same perLevel figure.
    expect(abilityEffectText('ponta_diamante', 'en')).toMatch(/\+1 /);
    expect(abilityEffectText('olho_clinico', 'en')).toMatch(/\+2 crit chance points/);
    expect(abilityEffectText('bateria_extra', 'en')).toMatch(/1%/);
    // 0.185, not the naive-halved 0.2 (the ability-rank-20 halving counterexample).
    expect(abilityEffectText('marcha_acelerada', 'en')).toMatch(/0\.185%/);
    expect(abilityEffectText('pressagio_mortal', 'en')).toMatch(/\+1 TEAM crit chance point/);
    expect(abilityEffectText('misericordia', 'en')).toMatch(/1\.25%/);
    expect(abilityEffectText('explosao_ampla', 'en')).toMatch(/0\.1 /);
    expect(abilityEffectText('contra_relogio', 'en')).toMatch(/2%/);
    expect(abilityEffectText('detonacao_dupla', 'en')).toMatch(/1\.5%/);
    expect(abilityEffectText('folego_mineiro', 'en')).toMatch(/1%/);
    expect(abilityEffectText('grito_guerra', 'en')).toMatch(/1%/);
    expect(abilityEffectText('golpe_brutal', 'en')).toMatch(/4%/);
    expect(abilityEffectText('passagem_bastao', 'en')).toMatch(/4%/);
    expect(abilityEffectText('passagem_bastao', 'en')).toMatch(/120/);
    expect(abilityEffectText('passagem_bastao', 'en')).not.toMatch(/speed/i);
    expect(abilityEffectText('passagem_bastao', 'pt')).not.toMatch(/velocidade/i);
  });

  it('veia_ouro and fortuna numerals are derived from LOOT_ABILITY_VALUES, not retyped', () => {
    // pct(x): fraction -> percentage-point string with no trailing zero, e.g. 0.02 -> '2%', 0.005 -> '0.5%'.
    const pct = (fraction: number): string => `${(fraction * 100).toString()}%`;

    const veiaOuroPerLevel = pct(LOOT_ABILITY_VALUES.veia_ouro.perLevel); // '2%'
    const veiaOuroCap = pct(LOOT_ABILITY_VALUES.veia_ouro.perLevel * LOOT_ABILITY_VALUES.veia_ouro.max); // '40%'
    const fortunaPerLevel = pct(LOOT_ABILITY_VALUES.fortuna.perLevel); // '0.5%'
    const fortunaCap = pct(LOOT_ABILITY_VALUES.fortuna.perLevel * LOOT_ABILITY_VALUES.fortuna.max); // '10%'

    for (const lang of ['pt', 'en'] as const) {
      const veiaOuroText = abilityEffectText('veia_ouro', lang);
      expect(veiaOuroText).toContain(veiaOuroPerLevel);
      expect(veiaOuroText).toContain(veiaOuroCap);
      // Old per-level figure must not survive as a per-level claim.
      expect(veiaOuroText).not.toMatch(/\+4% ouro\/nível|^\+4% gold\/level/);

      const fortunaText = abilityEffectText('fortuna', lang);
      expect(fortunaText).toContain(fortunaPerLevel);
      expect(fortunaText).toContain(fortunaCap);
      expect(fortunaText).not.toContain('+2% ouro ganho');
      expect(fortunaText).not.toContain('+2% gold gained');
    }

    // olho_lapidador's rate is untouched by this fix (already correct against the wiki); the
    // 2026-08-23 patch restated its SCOPE — the drop belongs to the hero that broke the object,
    // and Jaulas are excluded — which the copy now says and the number does not move for.
    const lapidadorPerLevel = pct(LOOT_ABILITY_VALUES.olho_lapidador.perLevel); // '2.5%'
    expect(abilityEffectText('olho_lapidador', 'pt')).toContain(`+${lapidadorPerLevel}`);
    expect(abilityEffectText('olho_lapidador', 'pt')).toContain('não vale para Jaulas');
    expect(abilityEffectText('olho_lapidador', 'en')).toContain(`+${lapidadorPerLevel}`);
    expect(abilityEffectText('olho_lapidador', 'en')).toContain('not Cages');
  });

  it('falls back to raw id for unknown ability', () => {
    expect(abilityName('no_such_ability', 'en')).toBe('no_such_ability');
    expect(abilityEffectText('no_such_ability', 'pt')).toBe('no_such_ability');
  });

  it('does not rename ability ids (EGT-03)', () => {
    expect(ABILITIES.map((a) => a.id)).toEqual([
      'bateria_extra',
      'caca_hero',
      'marcha_acelerada',
      'pressagio_mortal',
      'fantasma',
      'ponta_diamante',
      'misericordia',
      'explosao_ampla',
      'contra_relogio',
      'olho_clinico',
      'detonacao_dupla',
      'folego_mineiro',
      'passagem_bastao',
      'olho_lapidador',
      'veia_ouro',
      'grito_guerra',
      'golpe_brutal',
      'matilha',
      'fortuna',
      'brecha',
    ]);
  });
});

describe('rarityLabel', () => {
  it('covers every RarityKey for pt and en; keys stay accented PT', () => {
    for (const key of RARITIES) {
      expect(rarityLabel(key, 'pt')).toBe(key);
      const en = rarityLabel(key, 'en');
      expect(en.length).toBeGreaterThan(0);
      expect(en).not.toBe(key);
    }
    // Storage keys unchanged (accents preserved)
    const keys: RarityKey[] = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendária', 'Mítico'];
    expect(RARITIES).toEqual(keys);
  });
});

describe('itemRarityLabel', () => {
  it('covers every catalog rarity idx for pt and en', () => {
    for (const r of ITEM_RARITIES) {
      expect(itemRarityLabel(r.idx, 'pt')).toBe(r.label);
      const en = itemRarityLabel(r.idx, 'en');
      expect(en.length).toBeGreaterThan(0);
      expect(en).not.toBe(r.label);
    }
  });

  it('falls back to string idx for unknown rarity', () => {
    expect(itemRarityLabel(99, 'en')).toBe('99');
  });
});

describe('houseLabel', () => {
  it('covers every house index; PT matches HOUSES.name', () => {
    HOUSES.forEach((h, i) => {
      expect(houseLabel(i, 'pt')).toBe(h.name);
      const en = houseLabel(i, 'en');
      expect(en.length).toBeGreaterThan(0);
      expect(en).not.toBe(h.name);
      expect(en).toMatch(/^House /);
    });
  });

  it('falls back to string index for unknown house', () => {
    expect(houseLabel(99, 'en')).toBe('99');
  });
});

describe('slotLabel', () => {
  it('covers every Slot for pt and en; keys stay PT', () => {
    for (const slot of SLOTS) {
      const pt = slotLabel(slot, 'pt');
      const en = slotLabel(slot, 'en');
      expect(pt.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
      expect(en).not.toBe(slot);
      // EN must not dump raw PT slot keys as the only label
      expect(en).not.toBe(pt);
    }
    const expected: Slot[] = ['arma', 'elmo', 'anel', 'amuleto', 'peito', 'calca', 'luva', 'bota'];
    expect(SLOTS).toEqual(expected);
  });
});

describe('statLabel', () => {
  it('covers every StatKey; PT matches STAT_LABELS', () => {
    const keys = Object.keys(STAT_LABELS) as StatKey[];
    for (const k of keys) {
      expect(statLabel(k, 'pt')).toBe(STAT_LABELS[k]);
      const en = statLabel(k, 'en');
      expect(en.length).toBeGreaterThan(0);
      expect(en).not.toBe(STAT_LABELS[k]);
    }
  });
});

describe('teamBuffLabel', () => {
  it('covers every TeamBuffId; PT matches TEAM_BUFF_FIELDS.label', () => {
    for (const id of TEAM_BUFF_ABILITY_IDS) {
      const field = TEAM_BUFF_FIELDS.find((f) => f.id === id)!;
      expect(teamBuffLabel(id, 'pt')).toBe(field.label);
      const en = teamBuffLabel(id, 'en');
      expect(en.length).toBeGreaterThan(0);
      expect(en).not.toBe(field.label);
    }
  });
});

describe('itemStatLabel', () => {
  it('covers every catalog itemStat for pt and en', () => {
    for (const stat of catalog.itemStats) {
      const pt = itemStatLabel(stat, 'pt');
      const en = itemStatLabel(stat, 'en');
      expect(pt.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
    }
  });

  it('falls back to raw id for unknown item stat', () => {
    expect(itemStatLabel('unknown_stat', 'en')).toBe('unknown_stat');
  });
});

describe('propLabel', () => {
  it('covers every PROPS id for pt and en', () => {
    for (const p of PROPS) {
      const pt = propLabel(p.name, 'pt');
      const en = propLabel(p.name, 'en');
      expect(pt.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
      // PT-leaning ids must get a human label in EN (not raw id alone when map exists)
      if (p.name === 'minerio_mithril' || p.name === 'crystal_rubi') {
        expect(en).not.toBe(p.name);
      }
    }
  });

  it('falls back to raw id for unknown prop', () => {
    expect(propLabel('no_such_prop', 'en')).toBe('no_such_prop');
  });
});

describe('formatItemDisplay', () => {
  it('EN composed label uses English set + slot + rarity (no PT tokens)', () => {
    const label = formatItemDisplay(
      { defId: 'clay_arma', rarityIdx: 2, level: 40, upgrade: 0 },
      'en',
    );
    expect(label).toMatch(/^Clay /);
    expect(label).toMatch(/Weapon/);
    expect(label).toMatch(/Rare/);
    expect(label).not.toMatch(/\barma\b/);
    expect(label).not.toMatch(/\bRaro\b/);
    expect(label).not.toMatch(/\bComum\b/);
    expect(label).not.toMatch(/\bÉpico\b/);
    expect(label).not.toMatch(/\bArgila\b/);
  });

  it('PT composed label uses Portuguese set + slot + rarity', () => {
    const label = formatItemDisplay(
      { defId: 'clay_arma', rarityIdx: 2, level: 40, upgrade: 0 },
      'pt',
    );
    expect(label).toMatch(/^Argila /);
    expect(label).toMatch(/Arma/);
    expect(label).toMatch(/Raro/);
    expect(label).not.toMatch(/\bClay\b/);
  });
});

describe('formatItemRosterTooltip', () => {
  it('EN roster tip uses item + forge title and Lv level + rarity subtitle', () => {
    const tip = formatItemRosterTooltip(
      { defId: 'autumn_bota', rarityIdx: 2, level: 50, upgrade: 11 },
      'en',
      'Lv',
    );
    expect(tip.title).toBe('Autumn Boots +11');
    expect(tip.subtitle).toBe('Lv 50 Rare');
  });

  it('PT roster tip uses Nv and Portuguese rarity', () => {
    const tip = formatItemRosterTooltip(
      { defId: 'autumn_bota', rarityIdx: 2, level: 50, upgrade: 11 },
      'pt',
      'Nv',
    );
    expect(tip.title).toBe('Outono Bota +11');
    expect(tip.subtitle).toBe('Nv 50 Raro');
  });
});

describe('setName', () => {
  it('covers every catalog set for pt and en', () => {
    const sets = [...new Set(catalog.defs.map((d) => d.set))];
    for (const id of sets) {
      const pt = setName(id, 'pt');
      const en = setName(id, 'en');
      expect(pt).not.toBe(id);
      expect(en).not.toBe(id);
      expect(en.charAt(0)).toBe(en.charAt(0).toUpperCase());
    }
    expect(setName('clay', 'pt')).toBe('Argila');
    expect(setName('clay', 'en')).toBe('Clay');
    expect(setName('sandstorm', 'pt')).toBe('Tempestade de Areia');
    expect(setName('wooden', 'pt')).toBe('Madeira');
  });
});
