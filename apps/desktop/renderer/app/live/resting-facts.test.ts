import { describe, expect, it } from 'vitest';
import { STRINGS, sub } from '../../lib/copy';
import { restingFacts, restingSlotsCount, restingSlotsHint } from './resting-facts';

const en = STRINGS.en;

describe('restingSlotsCount', () => {
  it('reads the resting heroes against the rest slots they are competing for', () => {
    expect(restingSlotsCount(3, { slots: 5 }, 'en')).toBe('3/5');
  });

  it('reads the count alone when the game has not said how many slots the house has', () => {
    expect(restingSlotsCount(3, {}, 'en')).toBe('3');
  });

  it('groups thousands per locale, so the count never renders in one language on a screen in another', () => {
    expect(restingSlotsCount(1200, { slots: 9 }, 'en')).toBe('1,200/9');
    expect(restingSlotsCount(1200, { slots: 9 }, 'pt-BR')).toBe('1.200/9');
  });
});

describe('restingSlotsHint', () => {
  it('points at the house only while the account is below the ceiling', () => {
    expect(restingSlotsHint({ slots: 5, slotsMax: 9 }, en)).toBe(en.liveRestingSlotsHint);
    expect(restingSlotsHint({ slots: 9, slotsMax: 9 }, en)).toBeUndefined();
  });

  it('stays silent when either half is unknown — advice with no fact under it', () => {
    expect(restingSlotsHint({ slots: 5 }, en)).toBeUndefined();
    expect(restingSlotsHint({ slotsMax: 9 }, en)).toBeUndefined();
    expect(restingSlotsHint({}, en)).toBeUndefined();
  });
});

describe('restingFacts', () => {
  it('states the full rest cycle as a duration, not as a bare number of seconds', () => {
    expect(restingFacts({ cycleSeconds: 1050 }, en, 'en')).toEqual([
      sub(en.liveRestingCycleValue, { duration: '17:30' }),
    ]);
  });

  it('counts the skips the day has left', () => {
    expect(restingFacts({ rescuesLeft: 3, rescuesMax: 15 }, en, 'en')).toEqual([
      sub(en.liveRestingSkipsValue, { left: '3', max: '15' }),
    ]);
  });

  it('says the day is spent rather than counting zero of fifteen', () => {
    expect(restingFacts({ rescuesLeft: 0, rescuesMax: 15 }, en, 'en')).toEqual([en.liveRestingSkipsNone]);
  });

  it('still says the day is spent when the daily allowance itself was never sent', () => {
    expect(restingFacts({ rescuesLeft: 0 }, en, 'en')).toEqual([en.liveRestingSkipsNone]);
  });

  it('withholds the skip count when only one half of the pair arrived', () => {
    expect(restingFacts({ rescuesLeft: 3 }, en, 'en')).toEqual([]);
    expect(restingFacts({ rescuesMax: 15 }, en, 'en')).toEqual([]);
  });

  it('contributes nothing at all for a house the game has sent nothing for', () => {
    expect(restingFacts({}, en, 'en')).toEqual([]);
  });

  it('orders the cycle before the skips, so the heading reads the same on every account', () => {
    expect(restingFacts({ cycleSeconds: 1050, rescuesLeft: 3, rescuesMax: 15 }, en, 'en')).toEqual([
      sub(en.liveRestingCycleValue, { duration: '17:30' }),
      sub(en.liveRestingSkipsValue, { left: '3', max: '15' }),
    ]);
  });
});
