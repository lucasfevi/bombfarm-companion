/**
 * Hand-written companion to `host-bridge.js`, the same way `agent.d.ts` stands in for `agent.js`:
 * that file runs injected inside the target process, so it is genuine runtime JavaScript rather
 * than a compiled TS output, and this declaration is what lets `host-bridge.test.ts` typecheck
 * against it under strict TS.
 */

import type { TapAgent, TapAgentHost } from './agent.js';

export interface FridaNativePointer {
  toInt32(): number;
  toUInt32(): number;
  toString(): string;
  readByteArray(length: number): ArrayBuffer | null;
}

export interface FridaReturnValue {
  toInt32(): number;
}

export interface FridaInvocationArgs {
  [index: number]: FridaNativePointer;
}

export interface FridaInvocationContext {
  [key: string]: unknown;
}

export interface FridaInvocationListener {
  detach(): void;
}

export interface FridaInterceptor {
  attach(
    pointer: FridaNativePointer,
    callbacks: {
      onEnter(this: FridaInvocationContext, args: FridaInvocationArgs): void;
      onLeave(this: FridaInvocationContext, retval: FridaReturnValue): void;
    },
  ): FridaInvocationListener;
}

export interface FridaGlobals {
  readonly Interceptor: FridaInterceptor;
  ptr(address: number): FridaNativePointer;
  send(message: unknown, data?: ArrayBuffer | null): void;
}

export interface HostBridgeMessage {
  readonly type: string;
  readonly address: number;
}

export interface HostBridge {
  handleMessage(message: HostBridgeMessage | null | undefined): void;
  installedAddresses(): number[];
}

export declare function createHostBridge(
  frida: FridaGlobals,
  createAgent: (host: TapAgentHost) => TapAgent,
): HostBridge;
