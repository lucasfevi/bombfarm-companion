import { describe, expect, it, vi } from 'vitest';

vi.mock('./ipc-sender-policy.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ipc-sender-policy.js')>()),
  decideIpcSender: () => ({ allowed: true }),
}));

import { createBridgeInvokeHandler, type BridgeSender } from './ipc-bridge-handler.js';

describe('the renderer error channel when the sender check lets through a window it cannot name', () => {
  const sender: BridgeSender = { id: 9, mainFrame: { processId: 1, routingId: 1 } };
  const event = { sender, senderFrame: null };

  function build() {
    const dispatch = vi.fn(() => 'dispatched');
    const gate = { admit: vi.fn(() => true) };
    const handler = createBridgeInvokeHandler<BridgeSender>({
      env: { isDev: false },
      devRendererUrl: 'http://127.0.0.1:1',
      senderWindowOf: () => null,
      dispatch,
      log: { warn: vi.fn() },
      rendererErrorGate: gate,
    });
    return { handler, dispatch, gate };
  }

  it('drops the call instead of skipping the gate', () => {
    const { handler, dispatch, gate } = build();
    expect(handler(event, 'log:rendererError', { message: 'a' })).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
    expect(gate.admit).not.toHaveBeenCalled();
  });

  it('still dispatches every other channel, which the sender check alone governs', () => {
    const { handler, dispatch } = build();
    expect(handler(event, 'app:ping')).toBe('dispatched');
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
