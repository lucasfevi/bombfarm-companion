/**
 * Hand-written companion to `script-source-build.js`, the same way `agent.d.ts` stands in for
 * `agent.js`: that file is plain JavaScript so it can be imported both from a `.test.ts` under
 * `src/` and from `scripts/generate-script-source.mjs`, and this declaration is what lets the
 * tests import it under strict TS.
 */

export declare const AGENT_MARKER: string;
export declare const HOST_BRIDGE_MARKER: string;

/** Replaces `marker` in `template` with `replacement` verbatim; throws if the marker is absent. */
export declare function spliceMarker(template: string, marker: string, replacement: string): string;

/** The injected script's full source, spliced from the three committed files beside this one. */
export declare function buildScriptSource(): string;

/** The exact bytes `script-source.js` must hold for a given script source. */
export declare function serializeScriptSource(scriptSource: string): string;
