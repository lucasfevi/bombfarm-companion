export interface LogPort {
  info(record: Record<string, unknown>): void;
  warn(record: Record<string, unknown>): void;
  debug?(record: Record<string, unknown>): void;
}
