'use strict';

/* global module */

/**
 * Runs inside the target process alongside `agent.js`, so it is subject to the same constraint:
 * no imports from outside this file, only whatever is handed in explicitly. `createHostBridge`
 * takes Frida's globals (`Interceptor`, `ptr`, `send`) as a parameter instead of reading them off
 * `globalThis` for exactly one reason: it lets this file run — and be asserted against — under
 * plain Node/Vitest with fake stand-ins, the same way `agent.js` is tested with a fake `host`.
 * The real injected script (`bootstrap-template.js`) is the only place that wires in the genuine
 * Frida globals.
 */

/**
 * `frida` exposes:
 *   - `Interceptor.attach(pointer, { onEnter(args) })` — installs a native hook; returns
 *     `{ detach() }`.
 *   - `ptr(address)` — turns a numeric address into a `NativePointer`.
 *   - `send(message, data?)` — ships `message` (JSON) and `data` (raw bytes) back to Node,
 *     received there as the `data` argument of `Script.message`'s handler.
 *
 * The hooked call's signature is `(ctx, buffer, length)` in the platform's normal argument
 * registers — `args[0]`, `args[1]`, `args[2]` under Frida's own calling-convention abstraction —
 * matching the read-trace anchors `image-scan.ts` locates. `ctx` travels as the pointer's string
 * form rather than a number: `TlsConnections` only ever uses it as an opaque Map key, and a
 * 64-bit address does not fit a JS number without losing precision.
 */
function createHostBridge(frida, createAgent) {
  const agentsByAddress = new Map();

  function makeHost() {
    return {
      hook(address, onCall) {
        return frida.Interceptor.attach(frida.ptr(address), {
          onEnter(args) {
            const bufferPtr = args[1];
            const length = args[2].toInt32();
            onCall({
              ctx: args[0].toString(),
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
