// MP5 F5 (D25's second detector) — the wiki fingerprint: a hash definition, a baseline schema,
// its validation, and the comparison. Node built-ins only.
//
// The hash definition below is copied verbatim, not improved. The maintainer's out-of-band wiki
// sync already publishes numbers computed as sha256(JSON.stringify(payload)) and
// sha256(JSON.stringify(payload[k])) per top-level key, keys iterated in sorted order — a
// canonicalised or sorted-key-stringify variant would produce a *different, nicer* number that
// can never be compared, by eye, against the other side's published figure. Cross-tool
// comparability is worth more than a prettier hash.

import { createHash } from 'node:crypto';

/** sha256(JSON.stringify(value)) — no canonicalisation, no sorted-key stringify. */
export function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

/**
 * @param {string} url
 * @param {Record<string, unknown>} payload
 * @returns {{
 *   url: string,
 *   payloadSha256: string,
 *   sectionNames: string[],
 *   sectionSha256: Record<string, string>,
 *   versaoCatalogo: number | null,
 * }}
 */
export function fingerprintPayload(url, payload) {
  const sectionNames = Object.keys(payload).sort();
  /** @type {Record<string, string>} */
  const sectionSha256 = {};
  for (const name of sectionNames) {
    sectionSha256[name] = sha256Json(payload[name]);
  }
  return {
    url,
    payloadSha256: sha256Json(payload),
    sectionNames,
    sectionSha256,
    // Computed uniformly for both endpoints: /wiki/api/fases-nomes has no `itens` at all, so
    // this is permanently null there — its *appearance* there would itself be drift.
    versaoCatalogo: payload.itens?.versao_catalogo ?? null,
  };
}
