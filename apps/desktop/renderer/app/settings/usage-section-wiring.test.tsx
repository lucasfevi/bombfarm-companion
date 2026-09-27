import { describe, expect, it, vi } from 'vitest';
import { en } from '../../lib/copy/en';
import { UsageSection } from './usage-section';

vi.mock('../../lib/copy', () => ({
  useCopy: () => en,
  SETTINGS_WRITE_REASON_COPY_KEY: {
    no_store: 'settingsLanguageReasonNoStore',
    not_writable: 'settingsLanguageReasonNotWritable',
    unknown: 'settingsLanguageReasonUnknown',
  },
}));

function switchElement(props: {
  usagePingEnabled: boolean;
  onUsagePingEnabledChange: (next: boolean) => void;
  persistWarning: null;
}) {
  const section = UsageSection(props) as unknown as {
    props: { children: [{ props: { children: unknown } }, unknown] };
  };
  const settingsRow = section.props.children[0];
  return settingsRow.props.children as { props: { onCheckedChange: (checked: boolean) => void } };
}

describe('UsageSection — the rendered control is wired to onUsagePingEnabledChange', () => {
  it('calling it invokes onUsagePingEnabledChange with the new checked value', () => {
    const onUsagePingEnabledChange = vi.fn();
    const toggle = switchElement({ usagePingEnabled: true, onUsagePingEnabledChange, persistWarning: null });

    expect(toggle.props.onCheckedChange).toBe(onUsagePingEnabledChange);

    toggle.props.onCheckedChange(false);
    expect(onUsagePingEnabledChange).toHaveBeenCalledWith(false);
  });
});
