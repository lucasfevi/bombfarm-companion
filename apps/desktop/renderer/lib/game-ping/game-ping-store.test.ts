import { describe, expect, it } from 'vitest';
import { accept, initialGamePingState } from './game-ping-store';

describe('api latency arrivals', () => {
  it('adopts a push', () => {
    const next = accept(initialGamePingState, { kind: 'pushed', view: { latencyMs: 190 } });
    expect(next.view.latencyMs).toBe(190);
  });

  it('drops a read that was issued before a push landed', () => {
    const pushed = accept(initialGamePingState, { kind: 'pushed', view: { latencyMs: 190 } });
    const next = accept(pushed, { kind: 'fetched', view: { latencyMs: null }, issuedAt: 0 });
    expect(next).toBe(pushed);
  });

  it('adopts a read nothing overtook', () => {
    const next = accept(initialGamePingState, { kind: 'fetched', view: { latencyMs: 55 }, issuedAt: 0 });
    expect(next.view.latencyMs).toBe(55);
  });
});
