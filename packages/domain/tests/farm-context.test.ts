import { describe, expect, it } from 'vitest';
import {
  effectiveFarmPhase,
  effectiveMitigationPct,
  effectiveTargetProp,
  FARM_CYCLE_MODEL,
  FARM_WALK_DELAY_SEC,
  isTargetPropUnset,
} from '@bombfarm/domain/farm-context';
import {
  formatPhaseLabel,
  firstPhaseForAto,
  listMapsForAto,
  phaseForMapCoord,
  phaseMapCoord,
  phaseMapDisplayName,
  phaseSubIndex,
} from '@bombfarm/domain/phase-wiki';

describe('farm-context', () => {
  it('defaults farm phase to 1 when unset', () => {
    expect(effectiveFarmPhase(null)).toBe(1);
    expect(effectiveFarmPhase(0)).toBe(1);
    expect(effectiveFarmPhase(42)).toBe(42);
  });

  it('uses phase 1 mitigation when farm phase unset', () => {
    const mit = effectiveMitigationPct({ phase: null, mitigationPct: 99 });
    expect(mit).toBeCloseTo(1, 5);
  });

  it('exposes fixed cycle constants', () => {
    expect(FARM_CYCLE_MODEL).toBe('serial');
    expect(FARM_WALK_DELAY_SEC).toBe(0.15);
  });

  it('detects unset target prop', () => {
    expect(isTargetPropUnset(null)).toBe(true);
    expect(isTargetPropUnset('')).toBe(true);
    expect(isTargetPropUnset('stone')).toBe(false);
    expect(effectiveTargetProp(null)).toBe('stone');
  });
});

describe('formatPhaseLabel', () => {
  it('formats in-game coordinates EN', () => {
    expect(formatPhaseLabel(65, 'en')).toBe('Normal 1-15 (65)');
    expect(formatPhaseLabel(151, 'en')).toBe('Hard 1-1 (151)');
  });
});

describe('phaseSubIndex', () => {
  it('phaseSubIndex matches mundo band index', () => {
    expect(phaseSubIndex(65)).toBe(15);
    expect(phaseSubIndex(151)).toBe(1);
  });
});

describe('phase map picker', () => {
  it('lists maps for a difficulty in phase order', () => {
    const easy = listMapsForAto(1);
    expect(easy[0]).toMatchObject({ phase: 1, coord: '1-1' });
    expect(easy.find((row) => row.phase === 11)).toMatchObject({ coord: '2-1' });
  });

  it('resolves phase from difficulty + map coordinate', () => {
    expect(phaseForMapCoord(1, 2, 1)).toBe(11);
    expect(phaseForMapCoord(3, 1, 1)).toBe(151);
  });

  it('reads map coordinate from phase number', () => {
    expect(phaseMapCoord(11)).toEqual({ ato: 1, mundo: 2, subIndex: 1 });
    expect(phaseMapCoord(151)).toEqual({ ato: 3, mundo: 1, subIndex: 1 });
  });

  it('defaults to first map when switching difficulty', () => {
    expect(firstPhaseForAto(3)).toBe(151);
  });

  it('resolves base map display names by phase index', () => {
    expect(phaseMapDisplayName(71, 'pt')).toBe('Salão Congelado');
    expect(phaseMapDisplayName(71, 'en')).toBe('Frozen Hall');
    expect(phaseMapDisplayName(151, 'en')).toBe('First Strike');
  });
});
