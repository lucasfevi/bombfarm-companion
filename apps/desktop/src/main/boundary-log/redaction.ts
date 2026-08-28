const REDACTED_MARKER = '[redacted]';
const UNREDACTABLE_MARKER = '[unredactable]';

const DEFAULT_MAX_DEPTH = 12;
const DEFAULT_MAX_NODES = 5000;

/** Below this length a "secret" is more likely a typo'd field than a real token, and blanking
 * every occurrence of a short string would erase unrelated text across the whole log. */
const MIN_SECRET_LENGTH = 6;

export const SENSITIVE_KEY_NAMES = [
  'accountId',
  'playerName',
  'token',
  'sessionToken',
  'authorization',
  'cookie',
  'password',
  'secret',
] as const;

export interface RedactorOptions {
  maxDepth?: number;
  maxNodes?: number;
}

export interface Redactor {
  redact(record: Record<string, unknown>): Record<string, unknown>;
  registerSecret(value: string): void;
  /** A single slot, not a growing list: there is only ever one session token live at a time, and
   *  a later call replaces the earlier one rather than accumulating unboundedly. */
  setCredentialRedactor(redact: ((text: string) => string) | null): void;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '');
}

const NORMALIZED_SENSITIVE_KEYS = new Set(SENSITIVE_KEY_NAMES.map(normalizeKey));

export function isSensitiveKey(key: string): boolean {
  return NORMALIZED_SENSITIVE_KEYS.has(normalizeKey(key));
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

export function createRedactor(options: RedactorOptions = {}): Redactor {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const secrets: string[] = [];
  let credentialRedactor: ((text: string) => string) | null = null;

  function registerSecret(value: string): void {
    if (value.length < MIN_SECRET_LENGTH) return;
    secrets.push(value);
  }

  function setCredentialRedactor(redact: ((text: string) => string) | null): void {
    credentialRedactor = redact;
  }

  function redactString(value: string): string {
    let result = value;
    for (const secret of secrets) {
      result = result.split(secret).join(REDACTED_MARKER);
    }
    return credentialRedactor ? credentialRedactor(result) : result;
  }

  function redactValue(value: unknown, depth: number, seen: WeakSet<object>, budget: { nodes: number }): unknown {
    budget.nodes += 1;
    if (budget.nodes > maxNodes || depth > maxDepth) return UNREDACTABLE_MARKER;

    if (value === null || value === undefined) return value;

    if (typeof value === 'string') return redactString(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return UNREDACTABLE_MARKER;

    const obj = value;
    if (seen.has(obj)) return UNREDACTABLE_MARKER;

    if (Array.isArray(obj)) {
      seen.add(obj);
      const result = obj.map((item) => redactValue(item, depth + 1, seen, budget));
      seen.delete(obj);
      return result;
    }

    if (!isPlainObject(obj)) return UNREDACTABLE_MARKER;

    seen.add(obj);
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(obj)) {
      result[key] = isSensitiveKey(key) ? REDACTED_MARKER : redactValue(entryValue, depth + 1, seen, budget);
    }
    seen.delete(obj);
    return result;
  }

  function redact(record: Record<string, unknown>): Record<string, unknown> {
    return redactValue(record, 0, new WeakSet(), { nodes: 0 }) as Record<string, unknown>;
  }

  return { redact, registerSecret, setCredentialRedactor };
}
