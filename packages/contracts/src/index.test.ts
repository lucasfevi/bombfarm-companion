import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  FLAVORS,
  IPC_CHANNELS,
  createPingResponse,
  isIpcChannel,
  type AppEnvironmentInfo,
} from './index.js';

describe('contracts IPC surface', () => {
  it('lists stable invoke channels', () => {
    expect(IPC_CHANNELS).toEqual([
      'app:getFlavor',
      'app:getEnvironment',
      'app:ping',
      'settings:get',
      'storage:health',
      'game:getStatus',
      'game:getSnapshot',
    ]);
  });

  it('guards unknown channel names', () => {
    expect(isIpcChannel('app:ping')).toBe(true);
    expect(isIpcChannel('app:getEnvironment')).toBe(true);
    expect(isIpcChannel('not-a-channel')).toBe(false);
  });

  it('maps flavor descriptor fields to AppEnvironmentInfo for dev', () => {
    const descriptor = FLAVORS.dev;
    const info: AppEnvironmentInfo = {
      flavor: 'dev',
      productName: descriptor.productName,
      badgeLabel: descriptor.badgeLabel,
      updateChannel: descriptor.updateChannel,
      isPackaged: false,
    };
    expect(info).toEqual({
      flavor: 'dev',
      productName: 'Bomb Farm Companion (Dev)',
      badgeLabel: 'DEV',
      updateChannel: null,
      isPackaged: false,
    });
  });

  it('maps flavor descriptor fields to AppEnvironmentInfo for prod', () => {
    const descriptor = FLAVORS.prod;
    const info: AppEnvironmentInfo = {
      flavor: 'prod',
      productName: descriptor.productName,
      badgeLabel: descriptor.badgeLabel,
      updateChannel: descriptor.updateChannel,
      isPackaged: true,
    };
    expect(info).toEqual({
      flavor: 'prod',
      productName: 'Bomb Farm Companion',
      badgeLabel: null,
      updateChannel: 'latest',
      isPackaged: true,
    });
  });

  it('creates typed ping payloads', () => {
    expect(createPingResponse('preload')).toEqual({ ok: true, from: 'preload' });
  });

  it('ships default settings schema version', () => {
    expect(DEFAULT_SETTINGS.schemaVersion).toBe(1);
    expect(DEFAULT_SETTINGS.locale).toBe('en');
  });
});
