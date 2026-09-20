import { describe, expect, it } from 'vitest';
import { MARKET_SNAPSHOT_CHECK_MS, UPDATE_CHECK_INTERVAL_MS } from '@bombfarm/contracts';
import { READ_PACING } from '@bombfarm/game-api';
import { FEED_CYCLE_MS, FEED_IDS, feedAgeMs, feedMeter, feedNextInMs, feedsReadBy } from './feed-clock';
import { sequenceDecision } from './use-feeds';

const NOW = Date.parse('2026-09-20T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('the four feeds and the clock each runs on', () => {
  it('lists them in the order the sequence presses them: the game reads first, the outside checks after', () => {
    expect(FEED_IDS).toEqual(['account', 'pvp', 'market', 'updates']);
  });

  it("each feed's cycle is the clock main actually runs, not a figure of the strip's own", () => {
    expect(FEED_CYCLE_MS.account).toBe(READ_PACING.cycleForegroundMs);
    expect(FEED_CYCLE_MS.market).toBe(MARKET_SNAPSHOT_CHECK_MS);
    expect(FEED_CYCLE_MS.updates).toBe(UPDATE_CHECK_INTERVAL_MS);
    expect(FEED_CYCLE_MS.pvp).toBeNull();
  });
});

describe('which feeds a tab reads — the rest are muted while it shows', () => {
  it('every tab but PVP and Settings reads the account; Inventory adds prices, Skill Tree adds the PVP ranking', () => {
    for (const tab of ['live', 'farm', 'heroes', 'forge', 'optimizer', 'account']) expect(feedsReadBy(tab)).toEqual(['account']);
    expect(feedsReadBy('inventory')).toEqual(['account', 'market']);
    expect(feedsReadBy('skills')).toEqual(['account', 'pvp']);
    expect(feedsReadBy('pvp')).toEqual(['pvp']);
    expect(feedsReadBy('settings')).toEqual(['updates']);
  });

  it('a tab this map has never heard of reads the account, which is what a new screen almost always does', () => {
    expect(feedsReadBy('something-new')).toEqual(['account']);
  });
});

describe('the meter — how far a feed is towards refreshing itself', () => {
  it('fills from empty at the read to full at the cycle, and no further', () => {
    expect(feedMeter('account', 0)).toBe(0);
    expect(feedMeter('account', 30_000)).toBe(0.5);
    expect(feedMeter('account', 60_000)).toBe(1);
    expect(feedMeter('account', 600_000)).toBe(1);
  });

  it('is nothing for a feed with no clock, and for one never read', () => {
    expect(feedMeter('pvp', 30_000)).toBeNull();
    expect(feedMeter('market', null)).toBeNull();
  });

  it('says how long until the clock fires, floored at zero once it is due', () => {
    expect(feedNextInMs('market', 5 * 60_000)).toBe(10 * 60_000);
    expect(feedNextInMs('market', 40 * 60_000)).toBe(0);
    expect(feedNextInMs('pvp', 5 * 60_000)).toBeNull();
  });
});

describe('feedAgeMs', () => {
  it('reads an ISO capture time against now, never negative, and nothing from an unreadable one', () => {
    expect(feedAgeMs(ago(90_000), NOW)).toBe(90_000);
    expect(feedAgeMs(new Date(NOW + 5_000).toISOString(), NOW)).toBe(0);
    expect(feedAgeMs(null, NOW)).toBeNull();
    expect(feedAgeMs('not a date', NOW)).toBeNull();
  });
});

describe('refresh all — one press at a time', () => {
  it('presses a step it has not pressed', () => {
    expect(sequenceDecision({ kind: 'idle' }, false, false)).toBe('press');
  });

  it('waits while the press is working', () => {
    expect(sequenceDecision({ kind: 'working' }, true, false)).toBe('wait');
  });

  it('moves on once the press has settled — landed, or refused; a refusal never stops the run', () => {
    expect(sequenceDecision({ kind: 'idle' }, true, false)).toBe('advance');
    expect(sequenceDecision({ kind: 'refused', reason: 'rate_limited' }, true, false)).toBe('advance');
  });

  it('leaves behind a press whose state never moved, once it is overdue', () => {
    expect(sequenceDecision({ kind: 'working' }, true, true)).toBe('advance');
  });
});
