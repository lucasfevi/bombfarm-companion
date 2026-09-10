import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FARM_PHASE,
  LAST_KNOWN_PHASE,
  clampToKnownPhase,
  readHeroPhase,
  shownHeroPhase,
  type FarmPhaseSelection,
} from './hero-phase';

describe('clampToKnownPhase', () => {
  it('passes a phase inside the known run through untouched', () => {
    expect(clampToKnownPhase(51)).toBe(51);
    expect(clampToKnownPhase(1)).toBe(1);
    expect(clampToKnownPhase(LAST_KNOWN_PHASE)).toBe(LAST_KNOWN_PHASE);
  });

  it('clamps a phase past the end of what the tables describe onto the last one they do', () => {
    expect(clampToKnownPhase(LAST_KNOWN_PHASE + 1)).toBe(LAST_KNOWN_PHASE);
    expect(clampToKnownPhase(9_000)).toBe(LAST_KNOWN_PHASE);
  });

  it('clamps a phase below the first one onto the first one', () => {
    expect(clampToKnownPhase(0)).toBe(1);
    expect(clampToKnownPhase(-40)).toBe(1);
  });

  it('rounds a fractional phase to the row it names', () => {
    expect(clampToKnownPhase(51.4)).toBe(51);
    expect(clampToKnownPhase(51.6)).toBe(52);
  });

  it('answers with nothing at all for a reading that is not a phase', () => {
    expect(clampToKnownPhase(null)).toBeNull();
    expect(clampToKnownPhase(undefined)).toBeNull();
    expect(clampToKnownPhase(Number.NaN)).toBeNull();
    expect(clampToKnownPhase(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('knows a real run of phases, so the clamp is a bound and not a constant', () => {
    expect(LAST_KNOWN_PHASE).toBeGreaterThan(1);
  });
});

describe('readHeroPhase', () => {
  const READY = (phase: number | null): FarmPhaseSelection => ({ ready: true, phase });

  it('draws no figures until the Farm selection has actually been read', () => {
    expect(readHeroPhase({ ready: false, phase: null }, null)).toEqual({ kind: 'pending' });
    expect(readHeroPhase({ ready: false, phase: null }, 120)).toEqual({ kind: 'pending' });
  });

  it('opens on the phase the Farm screen has selected, and says so', () => {
    expect(readHeroPhase(READY(51), null)).toEqual({
      kind: 'at',
      selection: { kind: 'farmScreen', phase: 51 },
    });
  });

  it('opens on the phase the Farm screen itself defaults to when nothing is selected there', () => {
    expect(readHeroPhase(READY(null), null)).toEqual({
      kind: 'at',
      selection: { kind: 'farmScreen', phase: DEFAULT_FARM_PHASE },
    });
  });

  it('computes at the overridden phase, and names it as a choice of the reader rather than of Farm', () => {
    expect(readHeroPhase(READY(51), 120)).toEqual({
      kind: 'at',
      selection: { kind: 'override', phase: 120 },
    });
  });

  it('clamps an override outside the known run rather than answering about a phase it has no row for', () => {
    expect(readHeroPhase(READY(51), 9_000)).toEqual({
      kind: 'at',
      selection: { kind: 'override', phase: LAST_KNOWN_PHASE },
    });
    expect(readHeroPhase(READY(51), 0)).toEqual({
      kind: 'at',
      selection: { kind: 'override', phase: 1 },
    });
  });

  it('draws no figures at all for an override that is not a phase', () => {
    expect(readHeroPhase(READY(51), Number.NaN)).toEqual({ kind: 'unknown' });
  });

  it('hands the screen back to the Farm selection the moment the override is cleared', () => {
    const farm = READY(51);
    expect(readHeroPhase(farm, 120).kind).toBe('at');
    expect(readHeroPhase(farm, null)).toEqual({
      kind: 'at',
      selection: { kind: 'farmScreen', phase: 51 },
    });
  });
});

describe('shownHeroPhase', () => {
  it('shows the phase in force, whichever half of the pair supplied it', () => {
    expect(shownHeroPhase(readHeroPhase({ ready: true, phase: 51 }, null), null)).toBe(51);
    expect(shownHeroPhase(readHeroPhase({ ready: true, phase: 51 }, 120), 120)).toBe(120);
  });

  it('shows what the player typed even while it names no phase, so the field can be corrected', () => {
    expect(shownHeroPhase({ kind: 'unknown' }, 7)).toBe(7);
  });
});
