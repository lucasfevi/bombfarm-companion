'use strict';

/* global module */

/**
 * Runs injected inside the game client process, so it cannot `require`/`import` `ws-frame.ts`,
 * `tls-stream.ts`, `image-scan.ts`, or anything else in this directory — none of this project's
 * modules exist inside that process, only whatever host object the runtime hands this script at
 * injection time. That is also why the bounds-check below re-implements, rather than reuses,
 * the "never trust a length or a pointer, verify before every read" discipline `image-scan.ts`
 * applies to untrusted PE bytes: the constraint that forces this file to be self-contained is the
 * same one that forces the duplication.
 */

/** A defensive cap on a single read, independent of anything the hooked call claims. While more
 *  than one candidate address is hooked at once, a wrong candidate's second argument is not a
 *  buffer at all — its "length" is whatever garbage bits happen to sit there — so bounding the
 *  read keeps a bad candidate from turning into a multi-gigabyte read attempt. */
const MAX_READ_BYTES = 1 << 20;

/**
 * `host` is supplied by the runtime that injects this script. It exposes:
 *   - `hook(address, onCall)` — installs an interceptor at `address`; `onCall(call)` fires once
 *     per invocation with `call = { ctx, length, read(length) }`, where `read` performs the
 *     actual memory read and may throw if the pointer is not readable. Returns `{ detach() }`.
 *   - `send(message)` — ships a message back out to the controlling process.
 */
function createAgent(host) {
  const hooks = new Map();
  let winnerAddress = null;

  function detachExcept(address) {
    for (const [otherAddress, hook] of hooks) {
      if (otherAddress !== address) hook.detach();
    }
  }

  function onCall(address, call) {
    if (winnerAddress !== null && address !== winnerAddress) return;

    const length = call.length;
    if (typeof length !== 'number' || length <= 0 || length > MAX_READ_BYTES) return;

    let bytes;
    try {
      bytes = call.read(length);
    } catch {
      return;
    }
    if (!bytes || bytes.length !== length) return;

    if (winnerAddress === null) {
      winnerAddress = address;
      detachExcept(address);
    }

    host.send({ address, ctx: call.ctx, bytes });
  }

  function attach(addresses) {
    for (const address of addresses) {
      const handle = host.hook(address, (call) => onCall(address, call));
      hooks.set(address, handle);
    }
  }

  function detachAll() {
    for (const hook of hooks.values()) hook.detach();
    hooks.clear();
    winnerAddress = null;
  }

  return { attach, detachAll };
}

module.exports = { createAgent, MAX_READ_BYTES };
