import type { AccountSection } from '@bombfarm/contracts';

export type SectionDropVerdict =
  | { readonly drop: false }
  | { readonly drop: true; readonly triggers: readonly string[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A `casa` row written before `/rotation` yielded its whole body holds the bare house object with
 * no nested `casa` key; read today it looks like a rotation that lost four of its five keys.
 * Keys a row carries beyond the current schema are never a reason to drop it: a game update that
 * adds one must not cost the saved section.
 */
function isPreContractCasaBody(section: AccountSection, body: unknown): boolean {
  return section === 'casa' && isObject(body) && !isObject(body.casa);
}

export function judgeStoredSection(section: AccountSection, body: unknown): SectionDropVerdict {
  if (isPreContractCasaBody(section, body)) return { drop: true, triggers: ['casa.casa'] };
  return { drop: false };
}
