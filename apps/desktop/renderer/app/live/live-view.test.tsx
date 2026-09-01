/**
 * `LiveView` owns its own data (via `useLiveModel`, an internal hook) rather than taking a model
 * as a prop, so this file can only exercise what `renderToStaticMarkup`'s SSR pass actually
 * reaches — `useEffect` never runs under SSR, so the hook stays at `INITIAL_LIVE_MODEL`
 * (`freshness: loading`, `slow: null`) and every other branch is unreachable from here. Each
 * reachable-state branch and the full `LivePanel` are covered where they are actually reachable:
 * this component's own presentational children take props directly and are tested there.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STRINGS } from '../../lib/copy';
import { LiveView } from './live-view';

const en = STRINGS.en;

describe('LiveView — reachable-under-SSR behaviour', () => {
  it('renders the live-view testid and a loading placeholder before useLiveModel resolves', () => {
    const html = renderToStaticMarkup(createElement(LiveView, {}));
    expect(html).toContain('data-testid="live-view"');
    expect(html).toContain(en.shellLoadingLabel);
    expect(html).not.toContain('data-testid="live-panel"');
  });

  it('renders the labelled Open-mini control in the loading branch', () => {
    const html = renderToStaticMarkup(createElement(LiveView, {}));
    expect(html).toContain('data-testid="live-open-mini"');
    expect(html).toContain(en.miniLiveOpenLabel);
  });
});
