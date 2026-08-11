import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CI_WEB_PATH = join(root, '.github/workflows/ci-web.yml');

/**
 * Extracts one top-level `jobs.<name>:` block's raw text (from its header line
 * up to, but not including, the next 2-space-indented `key:` line, or EOF).
 * Deliberately dumb text slicing, not a full YAML parse — matches the existing
 * convention in `tools/release-config.test.mjs` (regex/text checks on workflow
 * files, no YAML-parsing dependency).
 */
function extractJobBlock(workflowText, jobName) {
  const lines = workflowText.split('\n');
  const startIndex = lines.findIndex((line) => new RegExp(`^  ${jobName}:\\s*$`).test(line));
  if (startIndex === -1) return null;

  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }
  return lines.slice(startIndex, endIndex).join('\n');
}

/** Splits a job block into its `steps:` entries (each starting at a `- name:` or `- uses:` line). */
function extractSteps(jobBlock) {
  const stepsIndex = jobBlock.indexOf('\n    steps:');
  if (stepsIndex === -1) return [];
  const stepsText = jobBlock.slice(stepsIndex);
  const lines = stepsText.split('\n');

  const steps = [];
  let current = [];
  for (const line of lines) {
    if (/^      - (name|uses):/.test(line)) {
      if (current.length > 0) steps.push(current.join('\n'));
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) steps.push(current.join('\n'));
  return steps;
}

function stepIf(stepText) {
  const match = stepText.match(/^\s*if:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

function stepFails(stepText) {
  return /\bexit\s+1\b/.test(stepText);
}

describe('design-system-required aggregator (SBC-19/SBC-20)', () => {
  const workflowText = readFileSync(CI_WEB_PATH, 'utf8');
  const jobBlock = extractJobBlock(workflowText, 'design-system-required');

  it('exists in ci-web.yml', () => {
    expect(jobBlock).not.toBeNull();
  });

  it('runs unconditionally (if: always()) so it evaluates even when design-system failed/was skipped/cancelled', () => {
    expect(jobBlock).toMatch(/^\s*if:\s*always\(\)\s*$/m);
  });

  const steps = extractSteps(jobBlock ?? '');

  it('has at least one step', () => {
    expect(steps.length).toBeGreaterThan(0);
  });

  it('has a step that fails the job when the web filter matched but design-system did not succeed', () => {
    const enforcing = steps.find((step) => {
      const cond = stepIf(step);
      return (
        cond != null &&
        /needs\.changes\.outputs\.web\s*==\s*'true'/.test(cond) &&
        /needs\.design-system\.result\s*!=\s*'success'/.test(cond) &&
        stepFails(step)
      );
    });
    expect(enforcing).toBeDefined();
  });

  it(
    'SBC-20: no step treats a skipped design-system result as success when the web filter matched — ' +
      'the exact anti-pattern e2e-web.yml\'s e2e-visual aggregator has today (a step whose `if` ' +
      'branches on result == \'skipped\' and whose `run` does not fail)',
    () => {
      const selfGreeningSteps = steps.filter((step) => {
        const cond = stepIf(step);
        if (cond == null) return false;
        const branchesOnSkipped = /result\s*==\s*'skipped'/.test(cond);
        return branchesOnSkipped && !stepFails(step);
      });
      expect(selfGreeningSteps).toEqual([]);
    },
  );
});
