/**
 * The farm screen's strings live in `@bombfarm/farm/copy` so the desktop app can print the same
 * ones. Annotated `: FarmCopy` rather than re-exported bare: `farmEn` is `as const`, and a bare
 * re-export would hand `Strings` (`../strings.ts`, `typeof en`) 175 string-LITERAL properties
 * where every other namespace contributes plain `string` — which then rejects `pt`, whose
 * Portuguese values are different strings. The annotation widens the values back to `string` at
 * this boundary and leaves `Strings` byte-for-byte what it was before the move.
 */
import { farmEn, farmPtBR, type FarmCopy } from '@bombfarm/farm/copy';

export const en: FarmCopy = farmEn;
export const pt: FarmCopy = farmPtBR;
