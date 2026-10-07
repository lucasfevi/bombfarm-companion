import { describe, expect, it } from 'vitest';
import { accept, initialOnlinePlayersState } from './online-players-store';

const view = (players: number) => ({ reading: { at: 1, players } });

describe('online players store', () => {
  it('takes a push', () => {
    expect(accept(initialOnlinePlayersState, { kind: 'pushed', view: view(5) }).view).toEqual(view(5));
  });

  it('discards a mount read that a push overtook', () => {
    const pushed = accept(initialOnlinePlayersState, { kind: 'pushed', view: view(7) });
    const late = accept(pushed, { kind: 'fetched', view: view(3), issuedAt: initialOnlinePlayersState.applied });
    expect(late).toBe(pushed);
  });

  it('takes a mount read nothing overtook', () => {
    const next = accept(initialOnlinePlayersState, { kind: 'fetched', view: view(3), issuedAt: 0 });
    expect(next.view).toEqual(view(3));
  });
});
