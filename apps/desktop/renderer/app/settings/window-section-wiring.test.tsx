import { describe, expect, it, vi } from 'vitest';
import { en } from '../../lib/copy/en';
import { WindowSection } from './window-section';

vi.mock('../../lib/copy', () => ({
  useCopy: () => en,
  SETTINGS_WRITE_REASON_COPY_KEY: {
    no_store: 'settingsLanguageReasonNoStore',
    not_writable: 'settingsLanguageReasonNotWritable',
    unknown: 'settingsLanguageReasonUnknown',
  },
}));

function switchElement(props: {
  alwaysOnTopMain: boolean;
  onAlwaysOnTopMainChange: (next: boolean) => void;
  persistWarning: null;
  alwaysOnTopMini: boolean;
  onAlwaysOnTopMiniChange: (next: boolean) => void;
  miniPersistWarning: null;
}) {
  const section = WindowSection(props) as unknown as {
    props: { children: [{ props: { children: unknown } }, unknown, { props: { children: unknown } }, unknown] };
  };
  const mainSettingsRow = section.props.children[0];
  return mainSettingsRow.props.children as { props: { onCheckedChange: (checked: boolean) => void } };
}

function miniSwitchElement(props: {
  alwaysOnTopMain: boolean;
  onAlwaysOnTopMainChange: (next: boolean) => void;
  persistWarning: null;
  alwaysOnTopMini: boolean;
  onAlwaysOnTopMiniChange: (next: boolean) => void;
  miniPersistWarning: null;
}) {
  const section = WindowSection(props) as unknown as {
    props: { children: [{ props: { children: unknown } }, unknown, { props: { children: unknown } }, unknown] };
  };
  const miniSettingsRow = section.props.children[2];
  return miniSettingsRow.props.children as { props: { onCheckedChange: (checked: boolean) => void } };
}

describe('WindowSection — the rendered control is wired to onAlwaysOnTopMainChange', () => {
  it('calling it invokes onAlwaysOnTopMainChange with the new checked value', () => {
    const onAlwaysOnTopMainChange = vi.fn();
    const toggle = switchElement({
      alwaysOnTopMain: false,
      onAlwaysOnTopMainChange,
      persistWarning: null,
      alwaysOnTopMini: false,
      onAlwaysOnTopMiniChange: () => {},
      miniPersistWarning: null,
    });

    expect(toggle.props.onCheckedChange).toBe(onAlwaysOnTopMainChange);

    toggle.props.onCheckedChange(true);
    expect(onAlwaysOnTopMainChange).toHaveBeenCalledTimes(1);
    expect(onAlwaysOnTopMainChange).toHaveBeenCalledWith(true);
  });
});

describe('WindowSection — the mini switch is wired to onAlwaysOnTopMiniChange', () => {
  it('calling it invokes onAlwaysOnTopMiniChange with the new checked value', () => {
    const onAlwaysOnTopMiniChange = vi.fn();
    const toggle = miniSwitchElement({
      alwaysOnTopMain: false,
      onAlwaysOnTopMainChange: () => {},
      persistWarning: null,
      alwaysOnTopMini: false,
      onAlwaysOnTopMiniChange,
      miniPersistWarning: null,
    });

    expect(toggle.props.onCheckedChange).toBe(onAlwaysOnTopMiniChange);

    toggle.props.onCheckedChange(true);
    expect(onAlwaysOnTopMiniChange).toHaveBeenCalledTimes(1);
    expect(onAlwaysOnTopMiniChange).toHaveBeenCalledWith(true);
  });
});
