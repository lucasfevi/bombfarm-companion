import { describe, expect, it } from 'vitest';
import { createAgent, MAX_READ_BYTES } from './agent.js';
import type { TapAgentHost, TapAgentHostCall } from './agent.js';

function createFakeHost(): {
  host: TapAgentHost;
  sent: { address: number; ctx: string | number; bytes: Uint8Array }[];
  fire: (address: number, call: TapAgentHostCall) => void;
  detached: Set<number>;
} {
  const sent: { address: number; ctx: string | number; bytes: Uint8Array }[] = [];
  const callbacks = new Map<number, (call: TapAgentHostCall) => void>();
  const detached = new Set<number>();

  const host: TapAgentHost = {
    hook(address, onCall) {
      callbacks.set(address, onCall);
      return {
        detach() {
          detached.add(address);
          callbacks.delete(address);
        },
      };
    },
    send(message) {
      sent.push(message);
    },
  };

  function fire(address: number, call: TapAgentHostCall): void {
    callbacks.get(address)?.(call);
  }

  return { host, sent, fire, detached };
}

describe('agent.js createAgent', () => {
  it('ships bytes and the opaque connection id out for a single hooked address', () => {
    const { host, sent, fire } = createFakeHost();
    const agent = createAgent(host);

    agent.attach([0x1000]);
    const bytes = new Uint8Array([1, 2, 3]);
    fire(0x1000, { ctx: 'conn-a', length: 3, read: () => bytes });

    expect(sent).toEqual([{ address: 0x1000, ctx: 'conn-a', bytes }]);
  });

  it('never reads past the length the intercepted call declared', () => {
    const { host, sent, fire } = createFakeHost();
    const agent = createAgent(host);

    agent.attach([0x2000]);
    let requestedLength: number | undefined;
    fire(0x2000, {
      ctx: 'conn-b',
      length: 5,
      read: (length) => {
        requestedLength = length;
        return new Uint8Array(length);
      },
    });

    expect(requestedLength).toBe(5);
    expect(sent).toHaveLength(1);
  });

  it('rejects a declared length beyond the defensive cap without attempting a read', () => {
    const { host, sent, fire } = createFakeHost();
    const agent = createAgent(host);

    agent.attach([0x3000]);
    let readAttempted = false;
    fire(0x3000, {
      ctx: 'conn-c',
      length: MAX_READ_BYTES + 1,
      read: () => {
        readAttempted = true;
        return new Uint8Array(0);
      },
    });

    expect(readAttempted).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it('swallows a read that faults (a wrong candidate whose second argument is not a real buffer) without crashing', () => {
    const { host, sent, fire } = createFakeHost();
    const agent = createAgent(host);

    agent.attach([0x4000]);
    expect(() => {
      fire(0x4000, {
        ctx: 'conn-d',
        length: 8,
        read: () => {
          throw new Error('access violation');
        },
      });
    }).not.toThrow();
    expect(sent).toHaveLength(0);
  });

  it('confirms the first address to produce a real read as the winner and detaches every other hooked address', () => {
    const { host, sent, fire, detached } = createFakeHost();
    const agent = createAgent(host);

    agent.attach([0x1000, 0x2000, 0x3000, 0x4000]);

    fire(0x3000, { ctx: 'conn-e', length: 4, read: () => new Uint8Array([9, 9, 9, 9]) });

    expect(sent).toEqual([{ address: 0x3000, ctx: 'conn-e', bytes: new Uint8Array([9, 9, 9, 9]) }]);
    expect(detached).toEqual(new Set([0x1000, 0x2000, 0x4000]));
  });

  it('ignores further calls on a non-winning address once a winner is confirmed, without attempting a read', () => {
    const { host, sent, fire } = createFakeHost();
    const agent = createAgent(host);

    agent.attach([0x1000, 0x2000]);
    fire(0x1000, { ctx: 'conn-f', length: 2, read: () => new Uint8Array([1, 2]) });

    let readAttempted = false;
    fire(0x2000, {
      ctx: 'conn-g',
      length: 2,
      read: () => {
        readAttempted = true;
        return new Uint8Array([3, 4]);
      },
    });

    expect(readAttempted).toBe(false);
    expect(sent).toHaveLength(1);
  });

  it('detachAll detaches every remaining hook and resets the winner', () => {
    const { host, fire, detached } = createFakeHost();
    const agent = createAgent(host);

    agent.attach([0x1000, 0x2000]);
    fire(0x1000, { ctx: 'conn-h', length: 1, read: () => new Uint8Array([1]) });
    agent.detachAll();

    expect(detached.has(0x1000)).toBe(true);
  });
});
