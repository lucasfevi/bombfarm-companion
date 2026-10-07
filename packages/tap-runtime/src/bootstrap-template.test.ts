/**
 * `bootstrap-template.js` is the only code in this package that runs inside the game process, and
 * it was the only file here with no test at all: `agent.js`, `host-bridge.js` and `index.ts` each
 * had one, while the wrapper that wires the three together and owns the `recv` loop was executed
 * by nothing short of a real injection into a real game client.
 *
 * So it is executed here, spliced exactly as the build splices it and run under `node:vm` with
 * Frida's five injected globals faked. The vm realm is what makes this possible at all — the
 * template is an IIFE over `Interceptor`, `Process`, `ptr`, `send` and `recv`, identifiers no
 * import can provide because nothing but Frida's runtime defines them.
 *
 * What is NOT re-proved here: the agent's candidate-selection policy and the bridge's buffer
 * discipline, both already covered against the same fakes in `agent.test.ts` and
 * `host-bridge.test.ts`. The subject is the wrapper — that the two modules are reachable through
 * their shims, that a message reaches the bridge, and that the listener re-arms.
 */
import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { MODULE_BASE, createFakeFrida, ctxArg, lengthArg, retvalArg } from './frida-fakes.js';
import { buildScriptSource } from './script-source-build.js';

interface SentMessage {
  readonly type?: unknown;
  readonly address?: unknown;
  readonly base?: unknown;
  readonly absoluteAddress?: unknown;
}

function runTemplate(): {
  fake: ReturnType<typeof createFakeFrida>;
  /** How many times the script armed a `recv` listener — `listen()`'s own recursion count. */
  recvArmings: () => number;
  /** Hands one message to the armed listener, one-shot as Frida's `recv` is. */
  deliver: (message: unknown) => void;
  messages: () => SentMessage[];
} {
  const fake = createFakeFrida();
  let armed: ((message: unknown) => void) | null = null;
  let recvArmings = 0;

  const context = {
    Interceptor: fake.frida.Interceptor,
    Process: fake.frida.Process,
    ptr: (address: number) => fake.frida.ptr(address),
    send: (message: unknown, data?: ArrayBuffer | null) => {
      fake.frida.send(message, data);
    },
    recv: (handler: (message: unknown) => void) => {
      recvArmings += 1;
      armed = handler;
    },
  };

  new Script(buildScriptSource()).runInNewContext(context);

  return {
    fake,
    recvArmings: () => recvArmings,
    deliver: (message) => {
      const handler = armed;
      // Frida's `recv` is one-shot: a listener fires once and the script must arm another. Clearing
      // it here is what lets the re-arm assertion below mean anything.
      armed = null;
      if (!handler) throw new Error('no recv listener is armed');
      handler(message);
    },
    messages: () => fake.allSent.map((entry) => entry.message as SentMessage),
  };
}

describe('bootstrap-template — the script injected into the game process', () => {
  it('arms a recv listener as soon as it loads, and sends nothing before a message arrives', () => {
    const script = runTemplate();

    expect(script.recvArmings()).toBe(1);
    expect(script.messages()).toEqual([]);
  });

  it('attaches an install at the address rebased onto the running module base', () => {
    const script = runTemplate();

    script.deliver({ type: 'install', address: 0x1000 });

    expect(script.fake.attachedPointers).toEqual([MODULE_BASE + 0x1000]);
  });

  it('reports the installed hook back to the host with both the base and the absolute address', () => {
    const script = runTemplate();

    script.deliver({ type: 'install', address: 0x1000 });

    expect(script.messages()).toEqual([
      {
        type: 'hook_installed',
        address: 0x1000,
        base: `0x${MODULE_BASE.toString(16)}`,
        absoluteAddress: `0x${(MODULE_BASE + 0x1000).toString(16)}`,
      },
    ]);
  });

  it('re-arms the listener after every message, so the second install is received too', () => {
    const script = runTemplate();

    script.deliver({ type: 'install', address: 0x1000 });
    expect(script.recvArmings()).toBe(2);

    script.deliver({ type: 'install', address: 0x3000 });
    expect(script.recvArmings()).toBe(3);
    expect(script.fake.attachedPointers).toEqual([MODULE_BASE + 0x1000, MODULE_BASE + 0x3000]);
  });

  it('re-arms after a message the bridge ignores, rather than going deaf on malformed input', () => {
    const script = runTemplate();

    script.deliver({ type: 'install' });

    expect(script.recvArmings()).toBe(2);
    expect(script.fake.attachedPointers).toEqual([]);
  });

  it('detaches the hook on a detach message', () => {
    const script = runTemplate();

    script.deliver({ type: 'install', address: 0x1000 });
    script.deliver({ type: 'detach', address: 0x1000 });

    expect(script.fake.detachedAddresses).toEqual([0x1000]);
  });

  it('ships the bytes the hooked call wrote back out on the binary channel', () => {
    const script = runTemplate();
    const { frida, memory, fireOnEnter, fireOnLeave, sent } = script.fake;

    script.deliver({ type: 'install', address: 0x1000 });
    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(4096) });
    memory.set(0x2000, new Uint8Array([7, 8, 9]));
    fireOnLeave(0x1000, retvalArg(3));

    expect(sent).toHaveLength(1);
    expect(sent[0]?.message).toEqual({ type: 'read', address: 0x1000, ctx: 'ctx-4096' });
    expect(Array.from(new Uint8Array(sent[0]?.data as ArrayBuffer))).toEqual([7, 8, 9]);
  });

  it('ships nothing when the hooked call returns no bytes or claims more than its capacity', () => {
    const script = runTemplate();
    const { frida, memory, fireOnEnter, fireOnLeave, sent } = script.fake;

    script.deliver({ type: 'install', address: 0x1000 });
    memory.set(0x2000, new Uint8Array([1, 2, 3, 4]));

    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(4) });
    fireOnLeave(0x1000, retvalArg(0));

    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(4) });
    fireOnLeave(0x1000, retvalArg(-1));

    fireOnEnter(0x1000, { 0: ctxArg(0x1000), 1: frida.ptr(0x2000), 2: lengthArg(4) });
    fireOnLeave(0x1000, retvalArg(5));

    expect(sent).toEqual([]);
  });
});
