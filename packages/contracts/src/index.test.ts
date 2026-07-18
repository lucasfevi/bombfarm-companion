import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  IPC_CHANNELS,
  createPingResponse,
  isIpcChannel,
} from './index.js';

describe('contracts IPC surface', () => {
  it('lists stable invoke channels', () => {
    expect(IPC_CHANNELS).toEqual([
      'app:getFlavor',
      'app:ping',
      'settings:get',
      'storage:health',
    ]);
  });

  it('guards unknown channel names', () => {
    expect(isIpcChannel('app:ping')).toBe(true);
    expect(isIpcChannel('not-a-channel')).toBe(false);
  });

  it('creates typed ping payloads', () => {
    expect(createPingResponse('preload')).toEqual({ ok: true, from: 'preload' });
  });

  it('ships default settings schema version', () => {
    expect(DEFAULT_SETTINGS.schemaVersion).toBe(1);
    expect(DEFAULT_SETTINGS.locale).toBe('en');
  });
});
