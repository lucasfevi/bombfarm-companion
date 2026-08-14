import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_BACKED_SECTIONS,
  FORBIDDEN_INTERPRETATION_PHRASES_FOR_TEST,
  renderIssueBody,
  renderIssueTitle,
  renderSummary,
  TRACKER_MARKER,
} from './wiki-drift/report.mjs';
import { DATA_URL, FASES_NOMES_URL } from './wiki-drift/fetch-endpoints.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));

const OUTCOME_LINE = /^outcome: (ok|drift|unreachable|baseline-missing)$/m;

function sectionChangedDiff(endpoint, section) {
  return {
    kind: 'section-changed',
    endpoint,
    section,
    baselineSha256: 'baseline-hash-aaaa',
    observedSha256: 'observed-hash-bbbb',
  };
}

describe('renderSummary — exactly one outcome line, for all four outcomes (MWD-27)', () => {
  const cases = [
    { outcome: 'ok', args: {} },
    { outcome: 'drift', args: { diffs: [sectionChangedDiff('data', 'fases')] } },
    { outcome: 'unreachable', args: { reason: 'http-500', url: DATA_URL } },
    { outcome: 'baseline-missing', args: { reason: 'baseline-unreadable' } },
  ];

  for (const { outcome, args } of cases) {
    it(`${outcome}`, () => {
      const text = renderSummary({ outcome, ...args });
      const matches = text.match(new RegExp(OUTCOME_LINE.source, 'gm')) ?? [];
      expect(matches).toEqual([`outcome: ${outcome}`]);
    });
  }
});

describe('renderSummary — unreachable / baseline-missing are attributable from the summary alone (MWD-29)', () => {
  it('unreachable names the reason token and the URL', () => {
    const text = renderSummary({ outcome: 'unreachable', reason: 'http-500', url: DATA_URL });
    expect(text).toContain('http-500');
    expect(text).toContain(DATA_URL);
  });

  it('baseline-missing names the reason token', () => {
    const text = renderSummary({
      outcome: 'baseline-missing',
      reason: 'baseline-endpoint-data-sectionNames-empty',
    });
    expect(text).toContain('baseline-endpoint-data-sectionNames-empty');
  });
});

describe('renderSummary — drift names every differing section with both hashes (MWD-06, MWD-20)', () => {
  it('a changed section is named with baseline and observed hash', () => {
    const diffs = [sectionChangedDiff('data', 'fases')];
    const text = renderSummary({ outcome: 'drift', diffs });
    expect(text).toContain('data.fases');
    expect(text).toContain('baseline-hash-aaaa');
    expect(text).toContain('observed-hash-bbbb');
  });

  it('added and removed sections are listed separately from changed ones', () => {
    const diffs = [
      { kind: 'section-added', endpoint: 'data', section: 'novaSecao', baselineSha256: null, observedSha256: 'x' },
      { kind: 'section-removed', endpoint: 'data', section: 'gemas', baselineSha256: 'y', observedSha256: null },
    ];
    const text = renderSummary({ outcome: 'drift', diffs });
    expect(text).toMatch(/added sections:[\s\S]*novaSecao/);
    expect(text).toMatch(/removed sections:[\s\S]*gemas/);
  });

  it('versao_catalogo is rendered old → new', () => {
    const diffs = [{ kind: 'versao-catalogo-changed', endpoint: 'data', section: null, from: 4, to: 5 }];
    const text = renderSummary({ outcome: 'drift', diffs });
    expect(text).toContain('versao_catalogo: 4 -> 5');
  });

  it('the reorder-only case (payload-changed alone) names itself explicitly', () => {
    const diffs = [{ kind: 'payload-changed', endpoint: 'data', section: null, baselineSha256: 'a', observedSha256: 'b' }];
    const text = renderSummary({ outcome: 'drift', diffs });
    expect(text.toLowerCase()).toContain('reorder-only');
  });
});

describe('renderSummary / renderIssueBody — no interpretation, ever (MWD-06)', () => {
  it('the forbidden-phrase list is the one the spec names', () => {
    expect(FORBIDDEN_INTERPRETATION_PHRASES_FOR_TEST).toEqual([
      'means', 'because', 'probably', 'likely', 'you should',
    ]);
  });

  it('a full drift summary contains none of the forbidden interpretation phrases', () => {
    const diffs = [
      sectionChangedDiff('data', 'fases'),
      { kind: 'section-added', endpoint: 'data', section: 'novaSecao', baselineSha256: null, observedSha256: 'x' },
      { kind: 'section-removed', endpoint: 'data', section: 'gemas', baselineSha256: 'y', observedSha256: null },
      { kind: 'versao-catalogo-changed', endpoint: 'data', section: null, from: 4, to: 5 },
    ];
    const text = renderSummary({ outcome: 'drift', diffs, observedAt: '2026-08-14T05:17:00.000Z', runUrl: 'https://example.invalid/run' });
    for (const phrase of FORBIDDEN_INTERPRETATION_PHRASES_FOR_TEST) {
      expect(text.toLowerCase()).not.toContain(phrase);
    }
  });

  it('a full issue body contains none of the forbidden interpretation phrases', () => {
    const diffs = [sectionChangedDiff('data', 'fases')];
    const body = renderIssueBody({ diffs, observedAt: '2026-08-14T05:17:00.000Z', runUrl: 'https://example.invalid/run' });
    for (const phrase of FORBIDDEN_INTERPRETATION_PHRASES_FOR_TEST) {
      expect(body.toLowerCase()).not.toContain(phrase);
    }
  });
});

describe('renderIssueTitle — stable prefix + differing-section count (MWD-43)', () => {
  it('the stable prefix is a literal', () => {
    expect(renderIssueTitle([sectionChangedDiff('data', 'fases')])).toMatch(/^Wiki data drift — /);
  });

  it('N=1', () => {
    expect(renderIssueTitle([sectionChangedDiff('data', 'fases')])).toBe('Wiki data drift — 1 section(s) differ');
  });

  it('N=2', () => {
    const diffs = [sectionChangedDiff('data', 'fases'), sectionChangedDiff('data', 'gemas')];
    expect(renderIssueTitle(diffs)).toBe('Wiki data drift — 2 section(s) differ');
  });

  it('N=12', () => {
    const diffs = Array.from({ length: 12 }, (_, i) => sectionChangedDiff('data', `section${i}`));
    expect(renderIssueTitle(diffs)).toBe('Wiki data drift — 12 section(s) differ');
  });
});

describe('renderIssueBody — every required element present, individually asserted (MWD-20)', () => {
  const diffs = [
    sectionChangedDiff('data', 'fases'),
    { kind: 'versao-catalogo-changed', endpoint: 'data', section: null, from: 4, to: 5 },
  ];
  const body = renderIssueBody({ diffs, observedAt: '2026-08-14T05:17:00.000Z', runUrl: 'https://example.invalid/actions/runs/1' });

  it('carries the tracker marker', () => {
    expect(body).toContain(TRACKER_MARKER);
  });

  it('carries both endpoint URLs', () => {
    expect(body).toContain(DATA_URL);
    expect(body).toContain(FASES_NOMES_URL);
  });

  it('carries a differing-section table naming the section and both hashes', () => {
    expect(body).toContain('data.fases');
    expect(body).toContain('baseline-hash-aaaa');
    expect(body).toContain('observed-hash-bbbb');
  });

  it('carries versao_catalogo old→new', () => {
    expect(body).toContain('versao_catalogo: 4 -> 5');
  });

  it('carries the ISO observation timestamp', () => {
    expect(body).toContain('2026-08-14T05:17:00.000Z');
  });

  it('carries the run link', () => {
    expect(body).toContain('https://example.invalid/actions/runs/1');
  });
});

describe('ARTIFACT_BACKED_SECTIONS — the itens mapping is measured, not assumed', () => {
  const catalog = JSON.parse(
    readFileSync(join(root, '../packages/domain/src/data/catalog.json'), 'utf8'),
  );

  it('catalog.json.version === 4 (matches itens.versao_catalogo)', () => {
    expect(catalog.version).toBe(4);
  });

  it('catalog.json.defs.length === 216 (matches the sync manifest defs_count)', () => {
    expect(catalog.defs.length).toBe(216);
  });

  it('data.itens is a backed section pointing at catalog.json', () => {
    expect(ARTIFACT_BACKED_SECTIONS['data.itens']).toContain('catalog.json');
  });

  it('data.skill_tree backs no committed artifact today — absent from the map', () => {
    expect(ARTIFACT_BACKED_SECTIONS['data.skill_tree']).toBeUndefined();
  });
});

describe('MWD-44 — drift confined to a section that backs no committed artifact is still reported', () => {
  it('names a section that backs no committed artifact in the body, and does not suppress the alert', () => {
    const diffs = [sectionChangedDiff('data', 'skill_tree')];
    const body = renderIssueBody({ diffs, observedAt: '2026-08-14T05:17:00.000Z', runUrl: 'https://example.invalid/run' });
    expect(body).toMatch(/no.*differing sections back a committed companion artifact/i);
    // Not suppressed: the table and the title still carry the diff.
    expect(body).toContain('data.skill_tree');
    expect(renderIssueTitle(diffs)).toBe('Wiki data drift — 1 section(s) differ');
  });

  it('a drift confined to unbacked sections still summarises as outcome: drift', () => {
    const diffs = [sectionChangedDiff('data', 'skill_tree')];
    const text = renderSummary({ outcome: 'drift', diffs });
    expect(text).toMatch(/^outcome: drift$/m);
  });
});
