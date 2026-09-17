/**
 * `skills.levels` -> `account.skillTree`. Totals can exist without the per-node map, and the
 * Skill Tree page treats that gap as "import again" rather than inventing a tree.
 */
import { describe, expect, it } from 'vitest';
import { parseAccountPayload, parseSaveFile } from '@bombfarm/domain/import-save';

const POST_PATCH_TOTALS = { vagas_campo: 0, bag_tabs_bonus: 0 };

function accountOf(skills: Record<string, unknown>) {
  return parseAccountPayload({ heroes: [], skills: { refunds: {}, totals: POST_PATCH_TOTALS, ...skills } }, [])
    .account;
}

describe('import-save — skills.levels -> account.skillTree', () => {
  it('carries owned levels, refunds and gold when the save has a levels map', () => {
    const account = accountOf({
      levels: { D01: 5, H01: 2 },
      refunds: { D01: 100 },
      gold: 12_500,
    });
    expect(account.skillTree).toEqual({
      levels: { D01: 5, H01: 2 },
      refunds: { D01: 100 },
      gold: 12_500,
    });
  });

  it('gold written as a string still parses', () => {
    expect(accountOf({ levels: { D01: 1 }, gold: '222054630' }).skillTree?.gold).toBe(222054630);
  });

  it('totals without levels produce no tree — the page asks for a re-import', () => {
    expect(accountOf({}).skillTree).toBeNull();
  });

  it('parseSaveFile and parseAccountPayload agree on the same payload', () => {
    const raw = {
      heroes: [],
      skills: { refunds: {}, totals: POST_PATCH_TOTALS, levels: { D01: 3 }, gold: 9 },
    };
    expect(parseSaveFile(raw, []).account.skillTree).toEqual(parseAccountPayload(raw, []).account.skillTree);
  });
});
