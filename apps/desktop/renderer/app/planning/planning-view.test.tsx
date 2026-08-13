/**
 * `PlanningView` owns its own data (via `useAccountView`, an internal hook) rather than taking a
 * model as a prop, so this file can only exercise what `renderToStaticMarkup`'s SSR pass actually
 * reaches — `useEffect` never runs under SSR, so the hook stays in its initial `loading` state and
 * every availability branch below it is unreachable from here. The per-availability rendering
 * itself (nothing-persisted/rejected/no-roster/complete/store-unavailable) is covered where it is
 * actually reachable: `RosterList`/`HeroDetail`/`NextPointPanel`/`FidelityNotice`'s own tests take
 * a `PlanningModel` directly, and `withhold-matrix.test.ts` / `account-model.test.ts` prove the
 * model's own branching. The Windows smoke (T7) is what proves the full, hook-driven path
 * end to end.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanningView } from './planning-view';

describe('PlanningView — reachable-under-SSR behaviour', () => {
  it('renders the planning-view testid and a loading placeholder before useAccountView resolves', () => {
    const html = renderToStaticMarkup(createElement(PlanningView));
    expect(html).toContain('data-testid="planning-view"');
    expect(html).not.toMatch(/>\s*0\s*</);
    expect(html).not.toContain('roster-list');
  });
});
