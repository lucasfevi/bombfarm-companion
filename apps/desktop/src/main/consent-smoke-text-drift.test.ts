/**
 * The Playwright suites assert the disclosure's wording as string literals, and nothing tied those
 * literals to the constant they came from. When the disclosure was rewritten they kept asserting
 * the previous wording and stayed green through the whole unit gate — the drift only surfaced four
 * minutes into the Windows job, which does not run on every change.
 *
 * This pulls those literals back to the source, in the fast gate.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppLocale } from '@bombfarm/contracts';
import { CONSENT_TEXT } from '@bombfarm/game-api';
import { describe, expect, it } from 'vitest';

const SPEC_PATH = resolve(__dirname, '..', '..', 'tests', 'smoke', 'consent-modal.spec.mjs');

const TO_CONTAIN_TEXT_ARGUMENT = /toContainText\(\s*'([^']*)'/g;

/** Every `toContainText('…')` argument the smoke suite asserts against the disclosure body. */
function assertedDisclosureFragments(source: string): string[] {
  const body = source.slice(source.indexOf("getByTestId('consent-modal-body')"));
  return Array.from(body.matchAll(TO_CONTAIN_TEXT_ARGUMENT), (match) => match[1] ?? '');
}

function flatten(locale: AppLocale): string {
  const text = CONSENT_TEXT[locale];
  return [text.title, ...text.body.map((clause) => `${clause.heading} ${clause.text}`)].join('\n');
}

describe('the smoke suite asserts wording the disclosure actually has', () => {
  const fragments = assertedDisclosureFragments(readFileSync(SPEC_PATH, 'utf8'));

  it('finds the fragments it is meant to check, so this guard cannot pass by matching nothing', () => {
    expect(fragments.length).toBeGreaterThan(0);
  });

  it('every asserted fragment appears verbatim in the English disclosure', () => {
    const english = flatten('en');
    expect(fragments.filter((fragment) => !english.includes(fragment))).toEqual([]);
  });

  it('red state: a fragment from the superseded wording is caught by the same comparison', () => {
    expect(flatten('en')).not.toContain('the companion observes the traffic the game client is already sending');
  });
});
