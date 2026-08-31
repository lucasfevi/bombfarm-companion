import { describe, expect, it } from 'vitest';
import { FLAVORS } from './flavors.js';
import { initialUpdateStatus } from './update.js';

describe('initialUpdateStatus', () => {
  it('an installed build that has a channel starts idle, never disabled', () => {
    for (const flavor of ['beta', 'prod'] as const) {
      const status = initialUpdateStatus({
        currentVersion: '0.7.1',
        channel: FLAVORS[flavor].updateChannel,
        isPackaged: true,
      });

      expect(status.phase).toBe('idle');
      expect(status.channel).toBe(FLAVORS[flavor].updateChannel);
    }
  });

  it('the dev flavor is disabled by its absent channel', () => {
    expect(initialUpdateStatus({ currentVersion: '0.7.1', channel: null, isPackaged: true })).toMatchObject({
      phase: 'disabled',
      channel: null,
    });
  });

  it('an unpackaged run is disabled whatever channel it names, having no installer to replace', () => {
    expect(initialUpdateStatus({ currentVersion: '0.7.1', channel: 'latest', isPackaged: false }).phase).toBe(
      'disabled',
    );
  });
});
