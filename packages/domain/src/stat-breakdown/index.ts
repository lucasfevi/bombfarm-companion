/**
 * Pure per-stat breakdown builder (Option B).
 * Reconstructs ledger / formula views from already-computed pipeline facts.
 * Does NOT import or modify derive() / model internals beyond shared types + pure fns.
 *
 * Public barrel for shared/domain/stat-breakdown — split by concern (W7). Every
 * pre-split export is re-exported here so `@/shared/domain/stat-breakdown` keeps
 * resolving to the same public surface (module-scope private helpers stay
 * inside their concern module).
 */

export type {
  BreakdownStatId,
  LedgerOp,
  LedgerSource,
  LedgerNote,
  LedgerStep,
  LedgerGroup,
  FormulaBreakdown,
  StatBreakdown,
  PipelineFacts,
} from '@/shared/domain/stat-breakdown/types';

export { LEDGER_SOURCE_GROUP } from '@/shared/domain/stat-breakdown/types';

export { foldLedger } from '@/shared/domain/stat-breakdown/ledger-kit';

export {
  BREAKDOWN_SHEET_IDS,
  BREAKDOWN_DERIVED_IDS,
  buildStatBreakdown,
} from '@/shared/domain/stat-breakdown/build';
