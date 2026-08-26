import { describe, expect, it } from 'vitest';
import type { FieldCountdown, RotationHeroSnapshot, RotationSnapshot } from '@bombfarm/contracts';
import { buildLiveFastModel, buildLiveFreshness, buildLiveSlowModel } from './live-model';

function hero(overrides: Partial<RotationHeroSnapshot> & { id: string }): RotationHeroSnapshot {
  return overrides;
}

describe('buildLiveFastModel — absent is not zero', () => {
  it('a hero at genuine zero countdown is a present key; a hero the source never reported is not a key at all', () => {
    const field: readonly FieldCountdown[] = [
      { heroId: 'zeroed-out', secondsRemaining: 0, drainPerSecond: 1, basis: 'observed' },
    ];

    const fast = buildLiveFastModel(field, []);

    expect(fast.field['zeroed-out']).toEqual({ heroId: 'zeroed-out', secondsRemaining: 0, basis: 'observed' });
    expect('never-reported' in fast.field).toBe(false);
    expect(fast.field['never-reported']).toBeUndefined();
  });

  it('the same distinction holds for recovery countdowns', () => {
    const fast = buildLiveFastModel([], [{ heroId: 'zeroed-out', secondsRemaining: 0, advancing: true }]);

    expect(fast.recovery['zeroed-out']).toEqual({ heroId: 'zeroed-out', secondsRemaining: 0, advancing: true });
    expect('never-reported' in fast.recovery).toBe(false);
  });
});

describe('buildLiveSlowModel — absent is not zero', () => {
  function rotationWithRecovering(heroes: readonly RotationHeroSnapshot[]): RotationSnapshot {
    return {
      heroes,
      house: { cycleSeconds: 1000 },
    };
  }

  it('a hero whose recovery is genuinely complete carries recoverySeconds: 0; a hero with no energy reading carries no recoverySeconds key at all', () => {
    const done = hero({ id: 'done', activity: 'resting', recovering: true, energyFraction: 1 });
    const unknown = hero({ id: 'unknown-energy', activity: 'resting', recovering: true });

    const slow = buildLiveSlowModel({ snapshot: rotationWithRecovering([done, unknown]), drops: [] });

    const doneEntry = slow.recovering.find((entry) => entry.id === 'done');
    const unknownEntry = slow.recovering.find((entry) => entry.id === 'unknown-energy');

    expect(doneEntry).toBeDefined();
    expect(doneEntry?.recoverySeconds).toBe(0);
    expect('recoverySeconds' in (unknownEntry ?? {})).toBe(false);
  });

  it('a hero with no roster name survives with only its id — no placeholder name or grade', () => {
    const nameless = hero({ id: 'nameless', activity: 'benched' });

    const slow = buildLiveSlowModel({ snapshot: { heroes: [nameless] }, drops: [] });

    expect(slow.benched).toEqual([{ id: 'nameless' }]);
  });

  it('a hero with rarity/stars carries them through; a hero without either has no key for them at all', () => {
    const identified = hero({ id: 'identified', activity: 'benched', rarity: 3, stars: 2 });
    const unidentified = hero({ id: 'unidentified', activity: 'benched' });

    const slow = buildLiveSlowModel({ snapshot: { heroes: [identified, unidentified] }, drops: [] });

    const identifiedFact = slow.benched.find((entry) => entry.id === 'identified');
    const unidentifiedFact = slow.benched.find((entry) => entry.id === 'unidentified');
    expect(identifiedFact).toEqual({ id: 'identified', rarity: 3, stars: 2 });
    expect('rarity' in (unidentifiedFact ?? {})).toBe(false);
    expect('stars' in (unidentifiedFact ?? {})).toBe(false);
  });

  it('a hero with a joined skin carries it through; a hero without one has no skin key at all', () => {
    const skinned = hero({ id: 'skinned', activity: 'benched', skin: 4 });
    const skinless = hero({ id: 'skinless', activity: 'benched' });

    const slow = buildLiveSlowModel({ snapshot: { heroes: [skinned, skinless] }, drops: [] });

    const skinnedFact = slow.benched.find((entry) => entry.id === 'skinned');
    const skinlessFact = slow.benched.find((entry) => entry.id === 'skinless');
    expect(skinnedFact).toEqual({ id: 'skinned', skin: 4 });
    expect('skin' in (skinlessFact ?? {})).toBe(false);
  });

  it('never re-sorts what classifyRotation returned', () => {
    const b = hero({ id: 'b', activity: 'benched' });
    const a = hero({ id: 'a', activity: 'benched' });

    // classifyRotation sorts benched heroes by id ascending — feeding them in reverse input order
    // proves the builder passes the classifier's own order through rather than reusing input order.
    const slow = buildLiveSlowModel({ snapshot: { heroes: [b, a] }, drops: [] });

    expect(slow.benched.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('passes unclassifiedCount, occupancy and house through unchanged', () => {
    const slow = buildLiveSlowModel({
      snapshot: {
        heroes: [],
        fieldSize: 3,
        house: { slots: 5, cycleSeconds: 900 },
        rescuesLeft: 2,
        rescuesMax: 10,
      },
      drops: [],
    });

    expect(slow.unclassifiedCount).toBe(0);
    expect(slow.occupancy).toEqual({ occupied: 0, fieldSize: 3 });
    expect(slow.house).toEqual({ slots: 5, cycleSeconds: 900, rescuesLeft: 2, rescuesMax: 10 });
  });
});

describe('buildLiveFreshness', () => {
  it('a live currency has no gap fields at all', () => {
    expect(buildLiveFreshness({ kind: 'live', lastFrameAt: 't', sinceAt: 't' })).toEqual({ kind: 'live' });
  });

  it('carries the gap reason, actionable flag and likelyQuarantine through', () => {
    const freshness = buildLiveFreshness({
      kind: 'gap',
      reason: 'runtimeUnavailable',
      actionable: false,
      sinceAt: 't',
      likelyQuarantine: true,
    });

    expect(freshness).toEqual({ kind: 'gap', reason: 'runtimeUnavailable', actionable: false, likelyQuarantine: true });
  });

  it('omits likelyQuarantine entirely when the source did not report it — not a false default', () => {
    const freshness = buildLiveFreshness({ kind: 'gap', reason: 'detached', actionable: false, sinceAt: 't' });

    expect('likelyQuarantine' in freshness).toBe(false);
  });
});
