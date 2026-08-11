import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unmodelledTreeFindings } from '../src/tree-guards';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'sheet-math');

describe('unmodelledTreeFindings', () => {
  it('reports no findings across every sheet-math fixture in the repo', () => {
    const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = loadFixtureJson(file);
      const totals = (raw.skills as { totals?: Record<string, unknown> } | undefined)?.totals;
      expect(totals, `${file} missing skills.totals`).toBeDefined();
      const findings = unmodelledTreeFindings(totals ?? {});
      expect(findings, `${file}: ${JSON.stringify(findings)}`).toEqual([]);
    }
  });

  it('unknown keystone ids produce a finding', () => {
    const findings = unmodelledTreeFindings({ keystones: ['deadly_eye'] });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('unknown');
    expect(findings[0]).toContain('deadly_eye');
  });

  it('known keystones and crit_dmg_mult !== 1 produce no findings', () => {
    expect(unmodelledTreeFindings({ keystones: ['C15', 'D15'], crit_dmg_mult: 2 })).toEqual([]);
  });

  it('empty keystones produce no findings', () => {
    expect(unmodelledTreeFindings({ keystones: [], crit_dmg_mult: 1 })).toEqual([]);
    expect(unmodelledTreeFindings({})).toEqual([]);
  });

  it('non-array / non-number inputs do not throw and produce no findings', () => {
    expect(() => unmodelledTreeFindings({ keystones: null, crit_dmg_mult: 'x' })).not.toThrow();
    expect(unmodelledTreeFindings({ keystones: null, crit_dmg_mult: 'x' })).toEqual([]);
  });
});
