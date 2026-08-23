'use strict';

/* global module */

/**
 * Runs inside the target process alongside `agent.js`, so it is subject to the same constraint:
 * no imports from outside this file, only whatever is handed in explicitly. `createHostBridge`
 * takes Frida's globals (`Interceptor`, `Process`, `ptr`, `send`) as a parameter instead of
 * reading them off `globalThis` for exactly one reason: it lets this file run — and be asserted
 * against — under plain Node/Vitest with fake stand-ins, the same way `agent.js` is tested with a
 * fake `host`. The real injected script (`bootstrap-template.js`) is the only place that wires in
 * the genuine Frida globals.
 */

/**
 * `frida` exposes:
 *   - `Interceptor.attach(pointer, { onEnter(args), onLeave(retval) })` — installs a native hook;
 *     `onEnter`/`onLeave` share the same per-invocation `this`, which is how state crosses from
 *     one to the other. Returns `{ detach() }`.
 *   - `Process.mainModule.base` — the running module's base address, used to rebase a hook target.
 *   - `ptr(address)` — turns a numeric address into a `NativePointer`.
 *   - `send(message, data?)` — ships `message` (JSON) and `data` (raw bytes) back to Node,
 *     received there as the `data` argument of `Script.message`'s handler.
 *
 * The hooked call's signature is `(ctx, buffer, length)` in the platform's normal argument
 * registers — `args[0]`, `args[1]`, `args[2]` under Frida's own calling-convention abstraction —
 * matching the read-trace anchors `image-scan.ts` locates. `ctx` travels as the pointer's string
 * form rather than a number: `TlsConnections` only ever uses it as an opaque Map key, and a
 * 64-bit address does not fit a JS number without losing precision.
 *
 * The hooked function is a read: it fills `buffer` as a side effect and only that side effect is
 * complete once the call returns, so the read has to happen in `onLeave`, not `onEnter` — reading
 * the buffer on entry sees whatever stale bytes were already sitting there. `args[2]` is the
 * buffer's capacity, not the number of bytes the callee actually wrote; the true count is the
 * function's return value (`<= 0` on error/would-block), so the length used for the read has to
 * come from `onLeave`'s `retval`, not from `args[2]`. The capacity captured in `onEnter` still
 * matters afterward: while several candidate addresses are hooked at once, a wrong candidate's
 * "return value" is arbitrary garbage, so a return value larger than the capacity it claimed on
 * entry is rejected rather than trusted.
 */
function createHostBridge(frida, createAgent) {
  const agentsByAddress = new Map();

  function makeHost() {
    return {
      hook(address, onCall) {
        // `address` is an RVA from `image-scan.ts` parsing the on-disk PE image, but
        // `Interceptor.attach` needs a runtime address, and ASLR relocates the module to a
        // different base on every launch — so the RVA is rebased onto the live module here, at
        // the last possible moment, only for the attach target. Everything else (the value handed
        // to `onCall`/`host.send`, and the cache `tap.ts` commits) stays the RVA.
        const base = frida.Process.mainModule.base;
        const absoluteAddress = base.add(address);
        frida.send({
          type: 'hook_installed',
          address,
          base: base.toString(),
          absoluteAddress: absoluteAddress.toString(),
        });
        return frida.Interceptor.attach(absoluteAddress, {
          onEnter(args) {
            this.tapCtx = args[0].toString();
            this.tapBuffer = args[1];
            this.tapCapacity = args[2].toUInt32();
          },
          onLeave(retval) {
            const length = retval.toInt32();
            if (length <= 0 || length > this.tapCapacity) return;

            const bufferPtr = this.tapBuffer;
            onCall({
              ctx: this.tapCtx,
              length,
              read(readLength) {
                const chunk = bufferPtr.readByteArray(readLength);
                if (chunk === null) {
                  throw new Error(`tap-runtime: unreadable pointer at ${bufferPtr.toString()}`);
                }
                return new Uint8Array(chunk);
              },
            });
          },
        });
      },
      send(message) {
        const { bytes } = message;
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        frida.send({ type: 'read', address: message.address, ctx: message.ctx }, buffer);
      },
    };
  }

  function install(address) {
    if (agentsByAddress.has(address)) return;
    const agent = createAgent(makeHost());
    agent.attach([address]);
    agentsByAddress.set(address, agent);
  }

  function uninstall(address) {
    const agent = agentsByAddress.get(address);
    if (!agent) return;
    agent.detachAll();
    agentsByAddress.delete(address);
  }

  function handleMessage(message) {
    if (!message || typeof message.address !== 'number') return;
    if (message.type === 'install') install(message.address);
    else if (message.type === 'detach') uninstall(message.address);
  }

  return {
    handleMessage,
    installedAddresses: () => Array.from(agentsByAddress.keys()),
  };
}

module.exports = { createHostBridge };
