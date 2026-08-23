'use strict';

/* global Interceptor, ptr, send, recv */

/**
 * The template for the script actually injected into the target process. `scripts/
 * generate-script-source.mjs` splices `agent.js` and `host-bridge.js` in verbatim in place of the
 * two markers below — each wrapped in its own `module.exports` shim so the two files stay
 * requirable (and independently unit-testable) without ever being edited to fit this wrapper.
 *
 * This file is never imported or run directly: it is source text spliced together at build time,
 * not a module. The leading "global" directive above documents the identifiers Frida injects into
 * the script's global scope — no import can bring them in, since nothing but Frida's own runtime
 * exists inside the target process.
 */

(function () {
  const agentModule = { exports: {} };
  (function (module) {
    void module;
    /* __AGENT_SOURCE__ */
  })(agentModule);
  const createAgent = agentModule.exports.createAgent;

  const hostBridgeModule = { exports: {} };
  (function (module) {
    void module;
    /* __HOST_BRIDGE_SOURCE__ */
  })(hostBridgeModule);
  const createHostBridge = hostBridgeModule.exports.createHostBridge;

  const bridge = createHostBridge({ Interceptor, ptr, send }, createAgent);

  function listen() {
    recv(function (message) {
      bridge.handleMessage(message);
      listen();
    });
  }

  listen();
})();
