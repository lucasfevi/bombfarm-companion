import { describe, expect, it, vi } from 'vitest';
import type { AppSettings, ConsentRecord, LiveEvent } from '@bombfarm/contracts';
import { broadcastEventToWindows } from './broadcast-event.js';

function fakeWindow(destroyed: boolean) {
  const send = vi.fn();
  return {
    isDestroyed: () => destroyed,
    webContents: { send },
    send,
  };
}

const EMPTY_FAST_UPDATE: LiveEvent = {
  type: 'fastUpdate',
  field: [],
  recovery: [],
  energies: [],
  onFieldHeroIds: [],
  earnings: null,
  map: null,
};

describe('broadcastEventToWindows', () => {
  it('sends live:event to every non-destroyed window', () => {
    const first = fakeWindow(false);
    const second = fakeWindow(false);
    const payload = EMPTY_FAST_UPDATE;

    broadcastEventToWindows([first, second], 'bfc:event:live:event', payload);

    expect(first.send).toHaveBeenCalledWith('bfc:event:live:event', payload);
    expect(second.send).toHaveBeenCalledWith('bfc:event:live:event', payload);
  });

  it('sends account:changed to every non-destroyed window', () => {
    const first = fakeWindow(false);
    const second = fakeWindow(false);
    const payload: unknown = { gameRunning: false };

    broadcastEventToWindows([first, second], 'bfc:event:account:changed', payload);

    expect(first.send).toHaveBeenCalledWith('bfc:event:account:changed', payload);
    expect(second.send).toHaveBeenCalledWith('bfc:event:account:changed', payload);
  });

  it('sends consent:changed to every non-destroyed window', () => {
    const first = fakeWindow(false);
    const second = fakeWindow(false);
    const payload: ConsentRecord = { decision: 'granted', textVersion: 1, grantedAt: '2026-01-01' };

    broadcastEventToWindows([first, second], 'bfc:event:consent:changed', payload);

    expect(first.send).toHaveBeenCalledWith('bfc:event:consent:changed', payload);
    expect(second.send).toHaveBeenCalledWith('bfc:event:consent:changed', payload);
  });

  it('sends settings:changed to every non-destroyed window', () => {
    const first = fakeWindow(false);
    const second = fakeWindow(false);
    const payload: AppSettings = {
      schemaVersion: 3,
      locale: 'pt-BR',
      alwaysOnTopMain: false,
      alwaysOnTopMini: true,
      forgeWritesEnabled: false,
    };

    broadcastEventToWindows([first, second], 'bfc:event:settings:changed', payload);

    expect(first.send).toHaveBeenCalledWith('bfc:event:settings:changed', payload);
    expect(second.send).toHaveBeenCalledWith('bfc:event:settings:changed', payload);
  });

  it('skips destroyed windows', () => {
    const living = fakeWindow(false);
    const destroyed = fakeWindow(true);
    const payload = EMPTY_FAST_UPDATE;

    broadcastEventToWindows([living, destroyed], 'bfc:event:live:event', payload);

    expect(living.send).toHaveBeenCalledOnce();
    expect(destroyed.send).not.toHaveBeenCalled();
  });

  it('delivers to surviving windows when the first entry is destroyed', () => {
    const destroyed = fakeWindow(true);
    const living = fakeWindow(false);
    const payload = EMPTY_FAST_UPDATE;

    broadcastEventToWindows([destroyed, living], 'bfc:event:live:event', payload);

    expect(destroyed.send).not.toHaveBeenCalled();
    expect(living.send).toHaveBeenCalledWith('bfc:event:live:event', payload);
  });
});
