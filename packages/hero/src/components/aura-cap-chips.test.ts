import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TEAM_AURA_SWITCH_IDS } from '@bombfarm/domain/team-buffs';
import { auraCapText } from './aura-cap-chips';

const source = readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), 'aura-cap-chips.tsx'), 'utf8');

describe('auraCapText — each aura’s cap in the unit the Heroes screen prints', () => {
  it('reads every aura the strip draws, in both languages, never as a dash', () => {
    for (const auraId of TEAM_AURA_SWITCH_IDS) {
      expect(auraCapText(auraId, 'en')).not.toBe('—');
      expect(auraCapText(auraId, 'pt')).not.toBe('—');
    }
  });

  it('pins the four shapes: a percent, flat points, a drain cut, and the pulse', () => {
    expect(auraCapText('grito_guerra', 'en')).toBe('+20% attack');
    expect(auraCapText('pressagio_mortal', 'en')).toBe('+20 crit points');
    expect(auraCapText('marcha_acelerada', 'en')).toBe('+3.70% speed');
    expect(auraCapText('folego_mineiro', 'en')).toBe('−20% drain');
    expect(auraCapText('brecha', 'en')).toBe('+20 penetration');
    expect(auraCapText('passagem_bastao', 'en')).toBe('+80% dmg, pulse held up');
  });
});

describe('AuraCapChips — one press-toggle per team aura, named and lit like the Heroes screen’s rows', () => {
  it('draws every aura of TEAM_AURA_SWITCH_IDS and nothing hand-listed', () => {
    expect(source).toContain('TEAM_AURA_SWITCH_IDS.map(');
    expect(source).not.toMatch(/'grito_guerra'|'brecha'/);
  });

  it('each chip is a pressed button carrying the aura’s name as its accessible name, and the icon tile the Heroes screen draws', () => {
    expect(source).toContain('aria-pressed={atCap}');
    expect(source).toContain("aria-label={sub(t.heroDetailAuraSwitchAria, { name })}");
    expect(source).toContain('<AbilityIcon code={auraId} size="sm"');
  });

  it('an unlit chip dims to the same 40% the aura rows use, a lit one takes the switch’s accent fill', () => {
    expect(source).toContain("'opacity-40'");
    expect(source).toContain('border-accent bg-[color-mix(in_oklch,var(--accent)_32%,var(--bg-2))]');
  });

  it('reports one aura at a time and never stores the list itself', () => {
    expect(source).toContain('onToggle(auraId, !atCap)');
    expect(source).not.toMatch(/useState|useReducer/);
  });
});
