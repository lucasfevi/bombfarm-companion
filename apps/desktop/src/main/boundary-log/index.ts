import { createEventDeduper } from './dedup.js';
import type { EventDeduper } from './dedup.js';
import { createRedactor } from './redaction.js';
import type { Redactor } from './redaction.js';

export type { EventDeduperDeps, EventDeduper } from './dedup.js';
export { VOLATILE_FIELDS, createEventDeduper } from './dedup.js';
export type { Redactor, RedactorOptions } from './redaction.js';
export { SENSITIVE_KEY_NAMES, createRedactor } from './redaction.js';

export interface BoundaryLogTransport {
  info(record: Record<string, unknown>): void;
  warn(record: Record<string, unknown>): void;
  error(record: Record<string, unknown>): void;
  debug(record: Record<string, unknown>): void;
}

export interface BoundaryLogDeps {
  transport: BoundaryLogTransport;
  now: () => number;
}

export interface BoundaryLog {
  info(record: Record<string, unknown>): void;
  warn(record: Record<string, unknown>): void;
  error(record: Record<string, unknown>): void;
  debug(record: Record<string, unknown>): void;
  flush(): void;
  registerSecret(value: string): void;
  setCredentialRedactor(redact: ((text: string) => string) | null): void;
}

type Severity = 'info' | 'warn' | 'error' | 'debug';

export function createBoundaryLog(deps: BoundaryLogDeps): BoundaryLog {
  const redactor: Redactor = createRedactor();

  function makeDeduper(emit: (record: Record<string, unknown>) => void): EventDeduper {
    return createEventDeduper({ emit, now: deps.now });
  }

  const dedupers: Record<Severity, EventDeduper> = {
    info: makeDeduper((record) => { deps.transport.info(record); }),
    warn: makeDeduper((record) => { deps.transport.warn(record); }),
    error: makeDeduper((record) => { deps.transport.error(record); }),
    debug: makeDeduper((record) => { deps.transport.debug(record); }),
  };

  function report(severity: Severity, record: Record<string, unknown>): void {
    dedupers[severity].report(redactor.redact(record));
  }

  return {
    info: (record) => { report('info', record); },
    warn: (record) => { report('warn', record); },
    error: (record) => { report('error', record); },
    debug: (record) => { report('debug', record); },
    flush: () => {
      dedupers.info.flush();
      dedupers.warn.flush();
      dedupers.error.flush();
      dedupers.debug.flush();
    },
    registerSecret: (value) => { redactor.registerSecret(value); },
    setCredentialRedactor: (redact) => { redactor.setCredentialRedactor(redact); },
  };
}
