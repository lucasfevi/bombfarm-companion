import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unmodelledTreeFindings } from '@bombfarm/domain/tree-guards';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'sheet-math');

describe('unmodelledTreeFindings (BSPW4-13, BSP-61)', () => {
  it('AC-75: reports no findings across every sheet-math fixture in the repo', () => {
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

  it('AC-76: a non-empty keystones array produces a finding naming BSP-61', () => {
    const findings = unmodelledTreeFindings({ keystones: ['deadly_eye'] });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('BSP-61');
    expect(findings[0]).toContain('deadly_eye');
  });

  it('AC-76: crit_dmg_mult !== 1 produces a finding naming DEC-08', () => {
    const findings = unmodelledTreeFindings({ crit_dmg_mult: 2 });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain('DEC-08');
    expect(findings[0]).toContain('2');
  });

  it('both clauses can fire independently in the same call', () => {
    const findings = unmodelledTreeFindings({ keystones: ['deadly_eye'], crit_dmg_mult: 1.5 });
    expect(findings).toHaveLength(2);
  });

  it('empty keystones and crit_dmg_mult === 1 produce no findings', () => {
    expect(unmodelledTreeFindings({ keystones: [], crit_dmg_mult: 1 })).toEqual([]);
    expect(unmodelledTreeFindings({})).toEqual([]);
  });

  it('non-array / non-number inputs do not throw and produce no findings', () => {
    expect(() => unmodelledTreeFindings({ keystones: null, crit_dmg_mult: 'x' })).not.toThrow();
    expect(unmodelledTreeFindings({ keystones: null, crit_dmg_mult: 'x' })).toEqual([]);
  });
});
