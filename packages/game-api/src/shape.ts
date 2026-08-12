import type { RouteFingerprint } from './fingerprints.js';

/**
 * The runtime drift guard (LAR-19, LAR-20). Cross-validation is gone under `D24` — this is the
 * only thing standing between a game update that reshapes a response and a confidently wrong
 * number. A missing required key is a shape break (`ok:false`); an extra key is additive and
 * logged, never a failure.
 */
export type ShapeCheckResult =
  | { readonly ok: true; readonly unknownKeys: readonly string[] }
  | { readonly ok: false; readonly missingKeys: readonly string[]; readonly unknownKeys: readonly string[] };

export function checkShape(body: Record<string, unknown>, fingerprint: RouteFingerprint): ShapeCheckResult {
  const bodyKeys = new Set(Object.keys(body));
  const missingKeys = fingerprint.requiredKeys.filter((key) => !bodyKeys.has(key));
  const requiredKeySet = new Set(fingerprint.requiredKeys);
  const unknownKeys = Object.keys(body).filter((key) => !requiredKeySet.has(key));

  if (missingKeys.length > 0) {
    return { ok: false, missingKeys, unknownKeys };
  }
  return { ok: true, unknownKeys };
}
