/**
 * The Frida stand-ins both `host-bridge.test.ts` and `bootstrap-template.test.ts` run against.
 * Lifted out of the former when the latter needed the same surface: two divergent fakes of the
 * same native API would let one test prove a property the other quietly contradicts. Test-support
 * only; deliberately not re-exported from `index.ts`.
 */
import type {
  FridaGlobals,
  FridaInvocationArgs,
  FridaInvocationContext,
  FridaNativePointer,
  FridaReturnValue,
} from './host-bridge.js';

export const MODULE_BASE = 0x140000000;

export function fakePointer(address: number, memory: Map<number, Uint8Array>): FridaNativePointer {
  return {
    toInt32: () => address,
    toUInt32: () => address,
    toString: () => `0x${address.toString(16)}`,
    add: (offset) => fakePointer(address + offset, memory),
    readByteArray: (length) => {
      const bytes = memory.get(address);
      if (!bytes) return null;
      return bytes.slice(0, length).buffer;
    },
  };
}

export interface FakeFrida {
  frida: FridaGlobals;
  memory: Map<number, Uint8Array>;
  fireOnEnter: (address: number, args: FridaInvocationArgs) => void;
  fireOnLeave: (address: number, retval: FridaReturnValue) => void;
  detachedAddresses: number[];
  sent: { message: unknown; data: ArrayBuffer | null | undefined }[];
  allSent: { message: unknown; data: ArrayBuffer | null | undefined }[];
  attachedPointers: number[];
}

export function createFakeFrida(): FakeFrida {
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
  // Every message the script sends, of any type, in order — kept separate from `sent` (which
  // callers rely on to hold only 'read' payloads) for the same reason `attachedPointers` is: a new
  // assertion gets the surface it needs without disturbing every existing 'read'-shaped test.
  const allSent: { message: unknown; data: ArrayBuffer | null | undefined }[] = [];
  // Every pointer `Interceptor.attach` was actually called with, absolute — kept separate from
  // `sent` so the rebase assertion can check the attach target without disturbing the rest.
  const attachedPointers: number[] = [];

  const frida: FridaGlobals = {
    Interceptor: {
      attach: (pointer, callbacks) => {
        const absoluteAddress = pointer.toInt32();
        attachedPointers.push(absoluteAddress);
        const address = absoluteAddress - MODULE_BASE;
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
    Process: {
      mainModule: {
        base: fakePointer(MODULE_BASE, memory),
      },
    },
    ptr: (address) => fakePointer(address, memory),
    send: (message, data) => {
      allSent.push({ message, data });
      const typed = message as { readonly type?: unknown };
      if (typed.type !== 'read') return;
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

  return { frida, memory, fireOnEnter, fireOnLeave, detachedAddresses, sent, allSent, attachedPointers };
}

export function ctxArg(address: number): FridaNativePointer {
  return {
    toInt32: () => address,
    toUInt32: () => address,
    toString: () => `ctx-${address.toString()}`,
    add: (offset) => ctxArg(address + offset),
    readByteArray: () => null,
  };
}

export function lengthArg(value: number): FridaNativePointer {
  return {
    toInt32: () => value,
    toUInt32: () => value,
    toString: () => String(value),
    add: (offset) => lengthArg(value + offset),
    readByteArray: () => null,
  };
}

export function retvalArg(value: number): FridaReturnValue {
  return { toInt32: () => value };
}
