import { checkSchema, type SchemaCheckResult } from '@bombfarm/domain/save-schema';
import type { RouteFingerprint } from './fingerprints.js';

/**
 * The runtime drift guard. Cross-validation is gone under `D24` — this
 * is the only thing standing between a game update that reshapes a response and a confidently
 * wrong number. A missing required key is a shape break (`ok:false`), and an
 * ADDED key at any declared level is ALSO a shape break, never additive, never merely logged. The
 * 2026-08-13 patch added `skills.refunds` and `skills.totals.vagas_campo`/`bag_tabs_bonus` and the
 * previous guard let all three through silently; this is the fix.
 */
export type ShapeCheckResult = SchemaCheckResult;

export function checkShape(body: Record<string, unknown>, fingerprint: RouteFingerprint): ShapeCheckResult {
  return checkSchema(body, fingerprint);
}
