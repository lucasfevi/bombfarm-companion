import { describe, expect, it } from 'vitest';
import { createAgent } from './agent.js';
import { createHostBridge } from './host-bridge.js';
import type {
  FridaGlobals,
  FridaInvocationArgs,
  FridaInvocationContext,
  FridaNativePointer,
  FridaReturnValue,
} from './host-bridge.js';

function fakePointer(address: number, memory: Map<number, Uint8Array>): FridaNativePointer {
  return {
    toInt32: () => address,
    toUInt32: () => address,
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
  fireOnLeave: (address: number, retval: FridaReturnValue) => void;
  detachedAddresses: number[];
  sent: { message: unknown; data: ArrayBuffer | null | undefined }[];
} {
  const memory = new Map<number, Uint8Array>();
  const callbacksByAddress = new Map<
    number,
    {
      onEnter(this: FridaInvocationContext, args: FridaInvocationArgs): void;
      onLeave?(this: FridaInvocationContext, retval: FridaReturnValue): void;
    }
  >();
  const contextsByAddress = new Map<number, FridaInvocationContext>();
  const detachedAddresses: number[] = [];
  const sent: { message: unknown; data: ArrayBuffer | null | undefined }[] = [];

  const frida: FridaGlobals = {
    Interceptor: {
      attach: (pointer, callbacks) => {
        const address = pointer.toInt32();
        callbacksByAddress.set(address, callbacks);
        return {
          detach: () => {
            detachedAddresses.push(address);
            callbacksByAddress.delete(address);
            contextsByAddress.delete(address);
          },
        };
      },
    },
    ptr: (address) => fakePointer(address, memory),
    send: (message, data) => {
      sent.push({ message, data });
    },
  };

  // Mirrors real Frida: onEnter and onLeave share one per-invocation `this`, and the two fire
  // as separate steps so a test can mutate `memory` in between, standing in for the callee
  // filling the buffer between entry and return.
  function fireOnEnter(address: number, args: FridaInvocationArgs): void {
    const callbacks = callbacksByAddress.get(address);
    if (!callbacks) return;
    const context: FridaInvocationContext = {};
    callbacks.onEnter.call(context, args);
    contextsByAddress.set(address, context);
  }

  function fireOnLeave(address: number, retval: FridaReturnValue): void {
    const callbacks = callbacksByAddress.get(address);
    const context = contextsByAddress.get(address);
    contextsByAddress.delete(address);
    if (!callbacks || !context) return;
    callbacks.onLeave?.call(context, retval);
  }

  return { frida, memory, fireOnEnter, fireOnLeave, detachedAddresses, sent };
}

function ctxArg(address: number): FridaNativePointer {
  return {
    toInt32: () => address,
    toUInt32: () => address,
    toString: () => `ctx-${address.toString()}`,
    readByteArray: () => null,
  };
}

function lengthArg(value: number): FridaNativePointer {
  return {
    toInt32: () => value,
    toUInt32: () => value,
    toString: () => String(value),
    readByteArray: () => null,
  };
}

function retvalArg(value: number): FridaReturnValue {
  return { toInt32: () => value };
}

describe('host-bridge createHostBridge', () => {
  it('installs a hook on an install message and ships a read out on the binary channel', () => {
    const { frida, memory, fireOnEnter, fireOnLeave, sent } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    bridge.handleMessage({ type: 'install', address: 0x1000 });
    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(4) });
    memory.set(0x2000, new Uint8Array([9, 9, 9, 9]));
    fireOnLeave(0x1000, retvalArg(4));

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
    const { frida, memory, fireOnEnter, fireOnLeave, detachedAddresses } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    bridge.handleMessage({ type: 'install', address: 0x1000 });
    bridge.handleMessage({ type: 'install', address: 0x3000 });

    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(1) });
    memory.set(0x2000, new Uint8Array([1]));
    fireOnLeave(0x1000, retvalArg(1));

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

  it('throws out of onLeave, not out of the caller, when the buffer pointer is unreadable', () => {
    const { frida, fireOnEnter, fireOnLeave } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    bridge.handleMessage({ type: 'install', address: 0x1000 });
    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(4) });

    expect(() => {
      fireOnLeave(0x1000, retvalArg(4));
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

  it('delivers the bytes written by the callee, not whatever was already in the buffer before the call', () => {
    const { frida, memory, fireOnEnter, fireOnLeave, sent } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    memory.set(0x2000, new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    bridge.handleMessage({ type: 'install', address: 0x1000 });

    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(4096) });
    // The callee fills the buffer as a side effect of the call, so the real bytes only exist
    // between onEnter and onLeave — not before the call was even entered.
    memory.set(0x2000, new Uint8Array([1, 2, 3, 4]));
    fireOnLeave(0x1000, retvalArg(4));

    expect(sent).toHaveLength(1);
    expect(new Uint8Array(sent[0]?.data as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('uses the return value as the byte count, not the capacity captured from args[2]', () => {
    const { frida, memory, fireOnEnter, fireOnLeave, sent } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    const written = new Uint8Array(4096);
    written.set([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
    memory.set(0x2000, written);
    bridge.handleMessage({ type: 'install', address: 0x1000 });

    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(4096) });
    fireOnLeave(0x1000, retvalArg(12));

    expect(sent).toHaveLength(1);
    const data = new Uint8Array(sent[0]?.data as ArrayBuffer);
    expect(data).toEqual(written.slice(0, 12));
  });

  it('produces no call when the return value is zero or negative', () => {
    const { frida, memory, fireOnEnter, fireOnLeave, sent } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    memory.set(0x2000, new Uint8Array([1, 2, 3, 4]));
    bridge.handleMessage({ type: 'install', address: 0x1000 });

    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(4) });
    fireOnLeave(0x1000, retvalArg(0));

    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(4) });
    fireOnLeave(0x1000, retvalArg(-1));

    expect(sent).toHaveLength(0);
  });

  it('rejects a return value larger than the capacity captured on entry', () => {
    const { frida, memory, fireOnEnter, fireOnLeave, sent } = createFakeFrida();
    const bridge = createHostBridge(frida, createAgent);

    memory.set(0x2000, new Uint8Array([1, 2, 3, 4]));
    bridge.handleMessage({ type: 'install', address: 0x1000 });

    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(4) });
    fireOnLeave(0x1000, retvalArg(999_999));

    expect(sent).toHaveLength(0);
  });
});
