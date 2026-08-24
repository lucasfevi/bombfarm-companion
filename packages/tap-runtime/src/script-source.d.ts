/**
 * Hand-written companion to the generated `script-source.js`, the same way `agent.d.ts` stands in
 * for `agent.js`: `scripts/generate-script-source.mjs` writes `dist/script-source.js` after `tsc`
 * runs, so no `src/script-source.ts` ever exists for `tsc` to compile. This declaration is what
 * lets `index.ts` import the generated module and still typecheck.
 */

export declare const TAP_SCRIPT_SOURCE: string;
