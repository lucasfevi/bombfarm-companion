import { describe, expect, it, vi } from 'vitest';
import { en } from '../../lib/copy/en';
import { StartupSection } from './startup-section';

vi.mock('../../lib/copy', () => ({
  useCopy: () => en,
  SETTINGS_WRITE_REASON_COPY_KEY: {
    no_store: 'settingsLanguageReasonNoStore',
    not_writable: 'settingsLanguageReasonNotWritable',
    unknown: 'settingsLanguageReasonUnknown',
  },
}));

function switchElement(props: {
  startWithWindows: boolean;
  onStartWithWindowsChange: (next: boolean) => void;
  persistWarning: null;
  loginItemBlock: null;
}) {
  const section = StartupSection(props) as unknown as {
    props: { children: [{ props: { children: unknown } }, ...unknown[]] };
  };
  const settingsRow = section.props.children[0];
  return settingsRow.props.children as { props: { onCheckedChange: (checked: boolean) => void } };
}

describe('StartupSection — the rendered control is wired to onStartWithWindowsChange', () => {
  it('calling it invokes onStartWithWindowsChange with the new checked value', () => {
    const onStartWithWindowsChange = vi.fn();
    const toggle = switchElement({
      startWithWindows: true,
      onStartWithWindowsChange,
      persistWarning: null,
      loginItemBlock: null,
    });

    expect(toggle.props.onCheckedChange).toBe(onStartWithWindowsChange);

    toggle.props.onCheckedChange(false);
    expect(onStartWithWindowsChange).toHaveBeenCalledTimes(1);
    expect(onStartWithWindowsChange).toHaveBeenCalledWith(false);

    toggle.props.onCheckedChange(true);
    expect(onStartWithWindowsChange).toHaveBeenLastCalledWith(true);
  });
});
