import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '@bombfarm/contracts';

/** The policy module imports Electron, so its source is read instead of loaded. */
const policySource = readFileSync(join(__dirname, '..', '..', 'ipc-sender-policy.ts'), 'utf8');
const miniLiveList = /MINI_LIVE_INVOKE_CHANNELS[\s\S]*?new Set<IpcInvokeChannel>\(\[([\s\S]*?)\]\)/.exec(policySource);

describe('the mount-failure channel', () => {
  it('is an invoke the main window may make', () => {
    expect(IPC_CHANNELS).toContain('premium:hostMountFailed');
  });

  it('is not one the compact Live window may make', () => {
    expect(miniLiveList?.[1]).toContain("'miniLive:close'");
    expect(miniLiveList?.[1]).not.toContain('premium:hostMountFailed');
  });
});
