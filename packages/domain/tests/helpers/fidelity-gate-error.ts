/**
 * The fidelity gate's one error type. A `code` and not only a message: the
 * discrimination suite (T6) asserts on both, so a mutant that dies for the wrong reason cannot
 * pass — the fourth-instance failure this repo already paid for.
 */

/** The closed set of ways the fidelity gate can fail. */
export type FidelityGateErrorCode =
  | 'fixtureMissing'
  | 'fixtureUnreadable'
  | 'fixtureMalformed'
  | 'manifestInvalid'
  | 'unscrubbedFixture'
  | 'unverifiableFidelity'
  | 'notFullFidelity'
  | 'parseRejected'
  | 'rosterMismatch'
  | 'heroStatMismatch'
  | 'accountMismatch'
  | 'underComparison';

export class FidelityGateError extends Error {
  readonly code: FidelityGateErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: FidelityGateErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'FidelityGateError';
    this.code = code;
    this.details = details;
  }
}
