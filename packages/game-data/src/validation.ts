const FORMAT_SPEC_RE = /%[0-9]*[a-zA-Z]/;

export function looksLikeFormatString(value: unknown): boolean {
  return typeof value === 'string' && FORMAT_SPEC_RE.test(value);
}

export function isPlausibleId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > 32) return false;
  if (looksLikeFormatString(value)) return false;
  return /^[0-9]+$/.test(value);
}

export function isPlausibleDefId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > 64) return false;
  if (looksLikeFormatString(value)) return false;
  return /^[a-z0-9_]+$/.test(value);
}

export function parseNumericField(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
