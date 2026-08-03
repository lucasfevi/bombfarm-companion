import { describe, expect, it } from 'vitest';
import {
  accordionBodyClass,
  accordionIconClass,
  accordionItemClass,
  accordionRecipe,
} from '@bombfarm/ui/accordion.recipe';

/**
 * Class-string parity guard for `accordionRecipe` + the layout constants
 * (UAC-03/04/06/07). Repo Vitest is `environment: 'node'` with no DOM — this
 * is the only automated coverage for the recipe; rendered ARIA/keyboard is
 * delegated to Base UI and covered by Storybook + Playwright e2e (spec A13).
 */

describe('accordionRecipe — tone: section (ExplainSection header parity)', () => {
  it('emits the uppercase-accent header-box chrome', () => {
    const cls = accordionRecipe({ tone: 'section', size: 'default' });
    expect(cls).toContain('border');
    expect(cls).toContain('border-line');
    expect(cls).toContain('bg-surface');
    expect(cls).toContain('px-4');
    expect(cls).toContain('py-3');
    expect(cls).toContain('text-[13px]');
    expect(cls).toContain('font-bold');
    expect(cls).toContain('tracking-[0.04em]');
    expect(cls).toContain('text-accent');
    expect(cls).toContain('uppercase');
  });

  it('is a real <button>-compatible trigger: cursor + no default outline + select-none', () => {
    const cls = accordionRecipe({ tone: 'section' });
    expect(cls).toContain('cursor-pointer');
    expect(cls).toContain('select-none');
    expect(cls).toContain('outline-none');
  });
});

describe('accordionRecipe — tone: row (compact stat-breakdown row)', () => {
  it('emits the accent-rail ledger strip chrome', () => {
    const cls = accordionRecipe({ tone: 'row', size: 'default' });
    expect(cls).toContain('justify-between');
    expect(cls).toContain('border-l-accent');
    expect(cls).toContain('border-l-[3px]');
    expect(cls).toContain('text-left');
    expect(cls).toContain('text-ink');
    expect(cls).toContain('data-[panel-open]:bg-[color-mix(in_oklch,var(--accent)_16%,var(--bg-2))]');
  });

  it('does not carry the section box chrome', () => {
    const cls = accordionRecipe({ tone: 'row' });
    expect(cls).not.toContain('uppercase');
    expect(cls).not.toMatch(/\bbg-surface\b/);
  });
});

describe('accordionRecipe — size axis', () => {
  it('compact keeps readable 12px type for ledger rows', () => {
    const dflt = accordionRecipe({ tone: 'row', size: 'default' });
    const compact = accordionRecipe({ tone: 'row', size: 'compact' });
    expect(compact).toContain('text-[12px]');
    expect(compact).not.toBe(dflt);
  });
});

describe('accordionRecipe — defaultVariants (UAC-03 "current chrome")', () => {
  it('bare call === explicit {tone: section, size: default}', () => {
    expect(accordionRecipe()).toBe(accordionRecipe({ tone: 'section', size: 'default' }));
  });
});

describe('accordionRecipe — rotating chevron + reduced-motion (UAC-04/06)', () => {
  it('carries the data-panel-open descendant rotation selector', () => {
    expect(accordionRecipe()).toContain('[&[data-panel-open]_[data-accordion-icon]]:rotate-180');
  });

  it('accordionIconClass is a fixed shrink-0 slot with a reduced-motion-safe transition', () => {
    expect(accordionIconClass).toContain('shrink-0');
    expect(accordionIconClass).toContain('size-4');
    expect(accordionIconClass).toContain('motion-safe:transition-transform');
    expect(accordionIconClass).toContain('motion-reduce:transition-none');
  });
});

describe('token-only styling (no hardcoded palette literals)', () => {
  const all = [
    accordionRecipe({ tone: 'section', size: 'default' }),
    accordionRecipe({ tone: 'section', size: 'compact' }),
    accordionRecipe({ tone: 'row', size: 'default' }),
    accordionRecipe({ tone: 'row', size: 'compact' }),
    accordionBodyClass,
    accordionIconClass,
    accordionItemClass,
  ].join(' ');

  it('contains no hex color literal', () => {
    expect(all).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('contains no raw rgb()/rgba() literal', () => {
    expect(all).not.toMatch(/\brgba?\(/);
  });
});
