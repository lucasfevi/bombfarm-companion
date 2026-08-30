import { describe, expect, it } from 'vitest';
import { propCountForAto, propCountForPhase, wikiPhaseLine } from '../src/phase-wiki';

describe('propCountForPhase', () => {
  it('resolves a phase to its own ato’s prop count', () => {
    // Phase 61 sits in ato 2, whose maps spawn 75 props.
    expect(propCountForPhase(61)).toBe(75);
    expect(propCountForPhase(1)).toBe(50);
  });

  it('agrees with propCountForAto for every phase the wiki describes', () => {
    for (let phase = 1; phase <= 600; phase += 1) {
      const line = wikiPhaseLine(phase);
      expect(line).toBeDefined();
      expect(propCountForPhase(phase)).toBe(propCountForAto(line?.ato ?? 0));
    }
  });

  it('covers both ends of the wiki range', () => {
    expect(propCountForPhase(1)).not.toBeNull();
    expect(propCountForPhase(600)).not.toBeNull();
  });

  it('refuses a phase outside the wiki range instead of clamping to the nearest one', () => {
    // The distinction that matters: `wikiPhaseLine` answers phase 900 with phase 600's row, so a
    // caller delegating the range check to it would print ato 5's count for a map the wiki has
    // never described.
    expect(wikiPhaseLine(900)?.ato).toBe(5);
    expect(propCountForPhase(900)).toBeNull();
    expect(propCountForPhase(601)).toBeNull();
    expect(propCountForPhase(0)).toBeNull();
    expect(propCountForPhase(-3)).toBeNull();
  });

  it('refuses a non-finite phase rather than returning a count for it', () => {
    expect(propCountForPhase(Number.NaN)).toBeNull();
    expect(propCountForPhase(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('rounds a fractional phase to the phase it names, and refuses one that rounds out of range', () => {
    expect(propCountForPhase(61.4)).toBe(propCountForPhase(61));
    expect(propCountForPhase(0.4)).toBeNull();
  });
});
