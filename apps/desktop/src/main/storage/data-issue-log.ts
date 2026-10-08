import { dataIssueKey, type DataIssue } from '@bombfarm/contracts';
import type { LogPort } from './index.js';

export interface DataIssueLog {
  record(issues: readonly DataIssue[]): void;
}

export function createDataIssueLog(log: LogPort): DataIssueLog {
  const seen = new Set<string>();
  return {
    record(issues) {
      for (const issue of issues) {
        const key = dataIssueKey(issue);
        if (seen.has(key)) continue;
        seen.add(key);
        log.warn({ scope: 'data-issue', event: 'data.issue', ...issue });
      }
    },
  };
}
