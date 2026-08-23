import { describe, expect, it } from 'vitest';
import { createAgent } from './agent.js';
import { createHostBridge } from './host-bridge.js';
import type { FridaGlobals, FridaInvocationArgs, FridaNativePointer } from './host-bridge.js';

function fakePointer(address: number, memory: Map<number, Uint8Array>): FridaNativePointer {
  return {
    toInt32: () => address,
    toString: () => `0x${address.toString(16)}`,
    readByteArray: (length) => {
      const bytes = memory.get(address);
      if (!bytes) return null;
      return bytes.slice(0, length).buffer;
    },
  };
}

function createFakeFrida(): {
  frida: FridaGlobals;
  memory: Map<number, Uint8Array>;
  fireOnEnter: (address: number, args: FridaInvocationArgs) => void;
  detachedAddresses: number[];
  sent: { message: unknown; data: ArrayBuffer | null | undefined }[];
} {
  const memory = new Map<number, Uint8Array>();
  const enterCallbacks = new Map<number, (args: FridaInvocationArgs) => void>();
  const detachedAddresses: number[] = [];
  const sent: { message: unknown; data: ArrayBuffer | null | undefined }[] = [];

  const frida: FridaGlobals = {
    Interceptor: {
      attach: (pointer, callbacks) => {
        const address = pointer.toInt32();
        enterCallbacks.set(address, (args) => {
          callbacks.onEnter(args);
        });
        return {
          detach: () => {
            detachedAddresses.push(address);
            enterCallbacks.delete(address);
          },
        };
      },
    },
    ptr: (address) => fakePointer(address, memory),
    send: (message, data) => {
      sent.push({ message, data });
    },
  };

  function fireOnEnter(address: number, args: FridaInvocationArgs): void {
    enterCallbacks.get(address)?.(args);
  }

  return { frida, memory, fireOnEnter, detachedAddresses, sent };
}

function ctxArg(address: number): FridaNativePointer {
  return { toInt32: () => address, toString: () => `ctx-${address.toString()}`, readByteArray: () => null };
}

function lengthArg(value: number): FridaNativePointer {
  return { toInt32: () => value, toString: () => String(value), readByteArray: () => null };
}

describe('host-bridge createHostBridge', () => {
  it('installs a hook on an install message and ships a read out on the binary channel', () => {
    const { frida, memory, fireOnEnter, sent } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    memory.set(0x2000, new Uint8Array([9, 9, 9, 9]));
    bridge.handleMessage({ type: 'install', address: 0x1000 });
    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(4) });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.message).toEqual({ type: 'read', address: 0x1000, ctx: 'ctx-4096' });
    expect(new Uint8Array(sent[0]?.data as ArrayBuffer)).toEqual(new Uint8Array([9, 9, 9, 9]));
  });

  it('ignores a second install for the same address instead of double-hooking it', () => {
    const { frida } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    bridge.handleMessage({ type: 'install', address: 0x1000 });
    bridge.handleMessage({ type: 'install', address: 0x1000 });

    expect(bridge.installedAddresses()).toEqual([0x1000]);
  });

  it('keeps two installed addresses independent — a read on one never detaches the other', () => {
    const { frida, memory, fireOnEnter, detachedAddresses } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    memory.set(0x2000, new Uint8Array([1]));
    bridge.handleMessage({ type: 'install', address: 0x1000 });
    bridge.handleMessage({ type: 'install', address: 0x3000 });

    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(1) });

    expect(detachedAddresses).toEqual([]);
    expect(bridge.installedAddresses().sort((a, b) => a - b)).toEqual([0x1000, 0x3000]);
  });

  it('detaches the underlying hook and forgets the address on a detach message', () => {
    const { frida, detachedAddresses } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    bridge.handleMessage({ type: 'install', address: 0x1000 });
    bridge.handleMessage({ type: 'detach', address: 0x1000 });

    expect(detachedAddresses).toEqual([0x1000]);
    expect(bridge.installedAddresses()).toEqual([]);
  });

  it('ignores a detach for an address that was never installed', () => {
    const { frida, detachedAddresses } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    bridge.handleMessage({ type: 'detach', address: 0x9999 });

    expect(detachedAddresses).toEqual([]);
  });

  it('throws out of onEnter, not out of the caller, when the buffer pointer is unreadable', () => {
    const { frida, fireOnEnter } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    bridge.handleMessage({ type: 'install', address: 0x1000 });

    expect(() => {
      fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(4) });
    }).not.toThrow();
  });

  it('ignores a malformed message instead of throwing', () => {
    const { frida } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    expect(() => {
      bridge.handleMessage(null);
      bridge.handleMessage({ type: 'install' } as unknown as { type: string; address: number });
    }).not.toThrow();
    expect(bridge.installedAddresses()).toEqual([]);
  });
});
