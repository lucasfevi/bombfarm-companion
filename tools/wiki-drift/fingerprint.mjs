// The wiki fingerprint: a hash definition, a baseline schema, its validation, and the
// comparison. Node built-ins only.
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

// --- Baseline schema, validation, comparison -------------------

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns null when valid, or a short reason token when the endpoint fingerprint is invalid. */
function endpointFingerprintError(entry) {
  if (!isPlainObject(entry)) return 'not-an-object';
  if (typeof entry.url !== 'string') return 'url-invalid';
  if (typeof entry.payloadSha256 !== 'string') return 'payloadSha256-invalid';
  if (!Array.isArray(entry.sectionNames) || !entry.sectionNames.every((n) => typeof n === 'string')) {
    return 'sectionNames-invalid';
  }
  if (entry.sectionNames.length === 0) return 'sectionNames-empty';
  if (!isPlainObject(entry.sectionSha256)) return 'sectionSha256-invalid';
  if (entry.versaoCatalogo !== null && typeof entry.versaoCatalogo !== 'number') {
    return 'versaoCatalogo-invalid';
  }
  const sortedSectionShaKeys = Object.keys(entry.sectionSha256).sort();
  const sortedSectionNames = [...entry.sectionNames].sort();
  if (JSON.stringify(sortedSectionShaKeys) !== JSON.stringify(sortedSectionNames)) {
    // The non-vacuity guarantee: sectionNames must be exactly the sorted keys of
    // sectionSha256 — a baseline cannot declare a section it carries no hash for, or vice versa.
    return 'sectionNames-sectionSha256-mismatch';
  }
  return null;
}

/**
 * Reads and validates a baseline from already-read file text. `text` is `undefined`/`null` when
 * the caller could not obtain any text at all (file absent, or any other read failure) — this
 * function does no file I/O itself, so "absent" and "unreadable" collapse to the same case here.
 *
 * @param {string | null | undefined} text
 * @returns {{ ok: true, baseline: object } | { ok: false, reason: string }}
 */
export function readBaseline(text) {
  if (text == null) return { ok: false, reason: 'baseline-unreadable' };

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'baseline-unparseable' };
  }

  if (!isPlainObject(parsed)) return { ok: false, reason: 'baseline-not-an-object' };
  if (parsed.schemaVersion !== 1) return { ok: false, reason: 'baseline-schema-version-mismatch' };
  if (!isPlainObject(parsed.endpoints)) return { ok: false, reason: 'baseline-endpoints-missing' };

  const { data, fasesNomes } = parsed.endpoints;
  if (!isPlainObject(data)) return { ok: false, reason: 'baseline-endpoint-data-missing' };
  if (!isPlainObject(fasesNomes)) return { ok: false, reason: 'baseline-endpoint-fasesNomes-missing' };

  const dataError = endpointFingerprintError(data);
  if (dataError) return { ok: false, reason: `baseline-endpoint-data-${dataError}` };
  const fasesNomesError = endpointFingerprintError(fasesNomes);
  if (fasesNomesError) return { ok: false, reason: `baseline-endpoint-fasesNomes-${fasesNomesError}` };

  return {
    ok: true,
    baseline: {
      schemaVersion: 1,
      capturedAt: parsed.capturedAt,
      endpoints: { data, fasesNomes },
    },
  };
}

/**
 * Compares one baseline endpoint fingerprint against one observed endpoint fingerprint, over the
 * *whole* sectionNames list — no allowlist, no subset. A section present in `observed`
 * but not in `baseline` is `section-added`; the reverse is `section-removed`; a shared section
 * whose hash differs is `section-changed`; a whole-payload hash mismatch is `payload-changed`
 * (this fires alone, with zero `section-changed`, on a key-reorder with no value change);
 * `itens.versao_catalogo` changing (including to/from `null`) is `versao-catalogo-changed`.
 *
 * @returns {Array<{ kind: string, section: string | null, baselineSha256?: string | null, observedSha256?: string | null, from?: number | null, to?: number | null }>}
 */
export function compareFingerprints(baselineEntry, observedEntry) {
  const diffs = [];
  const baselineNames = new Set(baselineEntry.sectionNames);
  const observedNames = new Set(observedEntry.sectionNames);

  for (const name of observedEntry.sectionNames) {
    if (!baselineNames.has(name)) {
      diffs.push({
        kind: 'section-added',
        section: name,
        baselineSha256: null,
        observedSha256: observedEntry.sectionSha256[name],
      });
    }
  }

  for (const name of baselineEntry.sectionNames) {
    if (!observedNames.has(name)) {
      diffs.push({
        kind: 'section-removed',
        section: name,
        baselineSha256: baselineEntry.sectionSha256[name],
        observedSha256: null,
      });
    }
  }

  for (const name of baselineEntry.sectionNames) {
    if (!observedNames.has(name)) continue;
    const baselineSha256 = baselineEntry.sectionSha256[name];
    const observedSha256 = observedEntry.sectionSha256[name];
    if (baselineSha256 !== observedSha256) {
      diffs.push({ kind: 'section-changed', section: name, baselineSha256, observedSha256 });
    }
  }

  if (baselineEntry.payloadSha256 !== observedEntry.payloadSha256) {
    diffs.push({
      kind: 'payload-changed',
      section: null,
      baselineSha256: baselineEntry.payloadSha256,
      observedSha256: observedEntry.payloadSha256,
    });
  }

  if (baselineEntry.versaoCatalogo !== observedEntry.versaoCatalogo) {
    diffs.push({
      kind: 'versao-catalogo-changed',
      section: null,
      from: baselineEntry.versaoCatalogo,
      to: observedEntry.versaoCatalogo,
    });
  }

  return diffs;
}

/** Deterministic emission: sorted keys at every level, 2-space indent, trailing newline. */
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (isPlainObject(value)) {
    /** @type {Record<string, unknown>} */
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
  }
  return value;
}

/** @param {object} baseline */
export function serializeBaseline(baseline) {
  return `${JSON.stringify(sortKeysDeep(baseline), null, 2)}\n`;
}
