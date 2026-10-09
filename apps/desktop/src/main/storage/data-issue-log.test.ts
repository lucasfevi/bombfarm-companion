import { describe, expect, it } from 'vitest';
import type { DataIssue } from '@bombfarm/contracts';
import { createDataIssueLog } from './data-issue-log.js';
import { createLogSpy } from './test-support.js';

const BIRTH_STATS_GONE: DataIssue = { kind: 'hero_field_absent', section: 'heroes', keys: ['birth_stats'], heroId: '7' };

describe('createDataIssueLog', () => {
  it('logs an issue once, however often it is recorded again', () => {
    const { log, records } = createLogSpy();
    const issueLog = createDataIssueLog(log);

    issueLog.record([BIRTH_STATS_GONE]);
    issueLog.record([BIRTH_STATS_GONE, { ...BIRTH_STATS_GONE }]);

    expect(records).toEqual([{ level: 'warn', record: { scope: 'data-issue', event: 'data.issue', ...BIRTH_STATS_GONE } }]);
  });

  it('logs the same problem on another hero as its own issue', () => {
    const { log, records } = createLogSpy();
    const issueLog = createDataIssueLog(log);

    issueLog.record([BIRTH_STATS_GONE, { ...BIRTH_STATS_GONE, heroId: '8' }]);

    expect(records).toHaveLength(2);
  });
});
