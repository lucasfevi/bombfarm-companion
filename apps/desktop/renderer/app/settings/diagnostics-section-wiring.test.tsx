import { describe, expect, it, vi } from 'vitest';
import { en } from '../../lib/copy/en';
import { DiagnosticsSection } from './diagnostics-section';

// `useCopy()` is a hook, so it needs an active React dispatcher; mocking it lets `DiagnosticsSection`
// be called directly as a plain function (no renderer, no jsdom) and its returned element tree
// walked for the rendered Button's real `onClick` prop — proving which callback is actually
// wired, not just which data-testid string appears in markup (`diagnostics-section.test.tsx`
// already covers that).
vi.mock('../../lib/copy', () => ({
  useCopy: () => en,
  sub: (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (fallback: string, key: string) => values[key] ?? fallback),
  DIAGNOSTICS_DUMP_REASON_COPY_KEY: {
    'rate-limited': 'settingsDiagnosticsReasonRateLimited',
    'write-failed': 'settingsDiagnosticsReasonWriteFailed',
    'no-source': 'settingsDiagnosticsReasonNoSource',
  },
}));

function buttonElement(props: { onSave: () => void; result: null }) {
  const section = DiagnosticsSection(props) as unknown as {
    props: { children: [{ props: { children: unknown } }, unknown] };
  };
  const settingsRow = section.props.children[0];
  return settingsRow.props.children as { props: { onClick: () => void; 'data-testid': string } };
}

describe('DiagnosticsSection — the rendered control is wired to onSave', () => {
  it('calling it invokes onSave exactly once', () => {
    const onSave = vi.fn();
    const button = buttonElement({ onSave, result: null });

    expect(button.props['data-testid']).toBe('settings-diagnostics-save');
    expect(button.props.onClick).toBe(onSave);

    button.props.onClick();
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
