import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STRINGS,
  sub,
  parseEmphasis,
  loadLang,
  saveLang,
  type Lang,
  type Strings,
  type ExplainSection,
} from '@/shared/i18n';
import * as chrome from '@/shared/i18n/namespaces/chrome';
import * as planner from '@/shared/i18n/namespaces/planner';
import * as gear from '@/shared/i18n/namespaces/gear';
import * as abilities from '@/shared/i18n/namespaces/abilities';
import * as account from '@/shared/i18n/namespaces/account';
import * as advice from '@/shared/i18n/namespaces/advice';
import * as breakdown from '@/shared/i18n/namespaces/breakdown';
import * as phases from '@/shared/i18n/namespaces/phases';
import * as importNs from '@/shared/i18n/namespaces/import';
import * as stats from '@/shared/i18n/namespaces/stats';

const fixturePath = join(process.cwd(), 'src/tests/fixtures/i18n-strings-main.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  en: Strings;
  pt: Strings;
};

const namespaces = [
  chrome,
  planner,
  gear,
  abilities,
  account,
  advice,
  breakdown,
  phases,
  importNs,
  stats,
] as const;

describe('i18n split parity', () => {
  it('STRINGS.en deeply equals the main-captured fixture', () => {
    expect(STRINGS.en).toEqual(fixture.en);
  });

  it('STRINGS.pt deeply equals the main-captured fixture', () => {
    expect(STRINGS.pt).toEqual(fixture.pt);
  });

  it('namespace key sets are pairwise disjoint', () => {
    const seen = new Map<string, string>();
    for (const ns of namespaces) {
      for (const key of Object.keys(ns.en)) {
        const prior = seen.get(key);
        expect(prior, `duplicate key ${key} also in ${prior}`).toBeUndefined();
        seen.set(key, 'present');
      }
    }
  });

  it('sorted key-name list is unchanged vs fixture', () => {
    const fromSplit = Object.keys(STRINGS.en).sort();
    const fromFixture = Object.keys(fixture.en).sort();
    expect(fromSplit).toEqual(fromFixture);
  });

  it('sub() behaves identically on existing fixtures', () => {
    expect(sub('a {x}', { x: 1 })).toBe('a 1');
    expect(sub('Need {pct}% pen', { pct: 12 })).toBe('Need 12% pen');
    expect(sub('missing {gone}', {})).toBe('missing ');
  });

  it('parseEmphasis() behaves identically on existing fixtures', () => {
    expect(parseEmphasis('plain')).toEqual([{ kind: 'text', value: 'plain' }]);
    expect(parseEmphasis('before <em>mid</em> after')).toEqual([
      { kind: 'text', value: 'before ' },
      { kind: 'em', value: 'mid' },
      { kind: 'text', value: ' after' },
    ]);
  });

  it('public API symbols resolve with expected shapes', () => {
    const langs: Lang[] = ['en', 'pt'];
    expect(langs.every((l) => STRINGS[l])).toBe(true);
    expect(typeof loadLang).toBe('function');
    expect(typeof saveLang).toBe('function');
    const section: ExplainSection = { h: 'x', p: ['y'] };
    expect(section.h).toBe('x');
  });
});
