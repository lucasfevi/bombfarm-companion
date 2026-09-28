import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { statPanelCopyFor } from '../copy';
import { PointsPreviewActions, type OptimizeControl } from './points-preview-actions';

const noop = () => {};

const runnable: OptimizeControl = {
  disabled: false,
  disabledReason: null,
  mode: 'dps',
  onModeChange: noop,
  heroEnabled: true,
};

/** The notice rail's lines, so a string in a tooltip attribute cannot pass for one on the page. */
function noticeLines(html: string): string[] {
  return [...html.matchAll(/<p[^>]*role="status"[^>]*>([^<]*)<\/p>/g)].map((match) => match[1] ?? '');
}

function render(optimize: OptimizeControl): string {
  return renderToStaticMarkup(
    <PointsPreviewActions
      t={statPanelCopyFor('en')}
      preview={null}
      justApplied={false}
      optimize={optimize}
      formatNumber={(value) => String(value)}
      onOptimize={noop}
      onApply={noop}
      onClear={noop}
    />,
  );
}

describe('PointsPreviewActions', () => {
  const t = statPanelCopyFor('en');

  it('prints why a disabled Optimize cannot run, on the page rather than in a native tooltip', () => {
    const html = render({ ...runnable, disabled: true, disabledReason: t.optimizeBuildNoBudgetReason });
    expect(noticeLines(html)).toContain(t.optimizeBuildNoBudgetReason);
    expect(html).not.toContain('title=');
  });

  it('a reason attached to an enabled control is not printed — the reason describes the refusal', () => {
    const html = render({ ...runnable, disabledReason: t.optimizeBuildNoBudgetReason });
    expect(html).not.toContain(t.optimizeBuildNoBudgetReason);
  });
});
