import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StepProgress } from './step-progress';

const BADGE = 'inline-flex size-[22px] items-center justify-center rounded-full border font-mono text-[11px] font-semibold';
const STEPS = ['Choose', 'Review', 'Done'];
const CURRENT_ITEM = 'data-step="current" aria-current="step" class="flex items-center gap-2 text-ink font-bold"';

const render = (current: number, steps: string[] = STEPS) =>
  renderToStaticMarkup(<StepProgress label="Progress" steps={steps} current={current} />);

describe('StepProgress', () => {
  it('renders a labelled ordered list with one item per step', () => {
    const html = render(2);
    expect(html).toMatch(
      /^<ol aria-label="Progress" class="m-0 flex list-none items-center justify-center gap-2 p-0 text-xs">/,
    );
    expect(html.match(/<li /g)).toHaveLength(3);
  });

  it('marks done, current and next steps with their state, badge and text classes', () => {
    const html = render(2);
    expect(html).toContain(
      `<li data-step="done" class="flex items-center gap-2 text-ink"><span aria-hidden="true" class="${BADGE} border-up bg-[color-mix(in_oklch,var(--up)_18%,var(--surface))] text-up">1</span>`,
    );
    expect(html).toContain(
      `<li ${CURRENT_ITEM}><span aria-hidden="true" class="${BADGE} border-accent bg-accent text-accent-ink">2</span>`,
    );
    expect(html).toContain(
      `<li data-step="next" class="flex items-center gap-2 text-muted"><span aria-hidden="true" class="${BADGE} border-line text-muted">3</span>`,
    );
    expect(html.match(/aria-current/g)).toHaveLength(1);
  });

  it('shows labels from the sm breakpoint and to screen readers always', () => {
    expect(render(1)).toContain('<span class="sr-only whitespace-nowrap sm:not-sr-only">Choose</span>');
  });

  it('draws a connector after every step but the last, green once passed', () => {
    const html = render(2);
    expect(html.match(/<span aria-hidden="true" class="h-px w-6 sm:w-12 bg-up"><\/span>/g)).toHaveLength(1);
    expect(html.match(/<span aria-hidden="true" class="h-px w-6 sm:w-12 bg-line"><\/span>/g)).toHaveLength(1);
  });

  it('clamps a current step below the range to the first step', () => {
    const html = render(0);
    expect(html).toContain(`<li ${CURRENT_ITEM}><span aria-hidden="true" class="${BADGE} border-accent bg-accent text-accent-ink">1</span>`);
    expect(html.match(/data-step="next"/g)).toHaveLength(2);
  });

  it('clamps a current step above the range to the last step', () => {
    const html = render(99);
    expect(html.match(/data-step="done"/g)).toHaveLength(2);
    expect(html).toContain(CURRENT_ITEM);
    expect(html).not.toContain('data-step="next"');
  });

  it('renders an empty list for no steps', () => {
    expect(render(1, [])).toBe(
      '<ol aria-label="Progress" class="m-0 flex list-none items-center justify-center gap-2 p-0 text-xs"></ol>',
    );
  });
});
