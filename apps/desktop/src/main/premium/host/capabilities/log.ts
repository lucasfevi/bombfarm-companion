import type { LogPort } from '../../../storage/index.js';
import { CapabilityError, type CapabilityHandler } from '../capability-channel.js';

export interface LogCapabilityDeps {
  readonly log: LogPort;
  /** The running bundle's sequence, for the record. */
  sequence(): number;
}

export const LOG_EVENT_PATTERN = /^[a-z][a-z0-9_.]{0,47}$/;
export const LOG_FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9]{0,31}$/;
export const LOG_FIELD_TEXT_PATTERN = /^[a-z0-9_-]{0,32}$/;
export const LOG_MAX_FIELDS = 8;

function keptValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return LOG_FIELD_TEXT_PATTERN.test(value) ? value : undefined;
  return undefined;
}

/**
 * `log`: a named event with a few flat fields, written as one `premium.bundle_log` record. No free
 * text gets through: a field that is not a number, a boolean or a short enum-like string is dropped,
 * and so is a key outside the pattern or beyond the eighth kept. The host's own keys come last in
 * the record so a field cannot overwrite them.
 */
export function createLogCapability(deps: LogCapabilityDeps): CapabilityHandler {
  return (args) => {
    if (typeof args !== 'object' || args === null) throw new CapabilityError('bad_args');
    const { event, fields } = args as Record<string, unknown>;
    if (typeof event !== 'string' || !LOG_EVENT_PATTERN.test(event)) throw new CapabilityError('bad_args');

    const kept: Record<string, string | number | boolean> = {};
    if (typeof fields === 'object' && fields !== null && !Array.isArray(fields)) {
      for (const [key, value] of Object.entries(fields)) {
        if (Object.keys(kept).length >= LOG_MAX_FIELDS) break;
        const keptOne = keptValue(value);
        if (keptOne !== undefined && LOG_FIELD_KEY_PATTERN.test(key)) kept[key] = keptOne;
      }
    }
    deps.log.info({
      ...kept,
      scope: 'premium',
      event: 'premium.bundle_log',
      bundleEvent: event,
      sequence: deps.sequence(),
    });
    return null;
  };
}
