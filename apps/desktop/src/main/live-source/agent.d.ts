/**
 * Hand-written companion to `agent.js`: that file is genuine runtime JavaScript (it is injected
 * into another process, so it cannot be a compiled TS output), and this declaration is what lets
 * `agent.test.ts` typecheck against it under strict TS without an `allowJs` project-wide switch.
 */

export interface TapAgentHostCall {
  readonly ctx: string | number;
  readonly length: number;
  read(length: number): Uint8Array;
}

export interface TapAgentHost {
  hook(address: number, onCall: (call: TapAgentHostCall) => void): { detach(): void };
  send(message: { readonly address: number; readonly ctx: string | number; readonly bytes: Uint8Array }): void;
}

export interface TapAgent {
  attach(addresses: readonly number[]): void;
  detachAll(): void;
}

export declare const MAX_READ_BYTES: number;
export declare function createAgent(host: TapAgentHost): TapAgent;
