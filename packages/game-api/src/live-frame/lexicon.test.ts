import { describe, expect, it } from 'vitest';
import { LIVE_FRAME_WIRE_LEXICON, wireKey } from './lexicon.js';

function domainFieldOf(symbol: string): string | undefined {
  return LIVE_FRAME_WIRE_LEXICON.find((entry) => entry.symbol === symbol)?.domainField;
}

describe('live-frame lexicon second-blast and shard-origin keys', () => {
  it('names the hit second-blast marker dd and reads it as secondBlast', () => {
    expect(wireKey('hitSecondBlast')).toBe('dd');
    expect(domainFieldOf('hitSecondBlast')).toBe('secondBlast');
  });

  it('names the hit shard-origin cell es and reads it as shardOrigin', () => {
    expect(wireKey('hitShardOrigin')).toBe('es');
    expect(domainFieldOf('hitShardOrigin')).toBe('shardOrigin');
  });

  it('names the explosion second-blast marker x2 and reads it as secondBlast', () => {
    expect(wireKey('explosionSecondBlast')).toBe('x2');
    expect(domainFieldOf('explosionSecondBlast')).toBe('secondBlast');
  });

  it('says plainly that the shard-origin key was not observed in any committed capture', () => {
    const description = LIVE_FRAME_WIRE_LEXICON.find((entry) => entry.symbol === 'hitShardOrigin')?.description;
    expect(description).toContain('Not observed in any committed capture');
  });
});
