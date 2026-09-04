import { describe, expect, it, vi } from 'vitest';
import { en } from '../../lib/copy/en';
import { ForgeSection } from './forge-section';

vi.mock('../../lib/copy', () => ({
  useCopy: () => en,
  SETTINGS_WRITE_REASON_COPY_KEY: {
    no_store: 'settingsLanguageReasonNoStore',
    not_writable: 'settingsLanguageReasonNotWritable',
    unknown: 'settingsLanguageReasonUnknown',
  },
}));

function switchElement(props: {
  forgeWritesEnabled: boolean;
  onForgeWritesEnabledChange: (next: boolean) => void;
  persistWarning: null;
}) {
  const section = ForgeSection(props) as unknown as {
    props: { children: [{ props: { children: unknown } }, unknown] };
  };
  const settingsRow = section.props.children[0];
  return settingsRow.props.children as { props: { onCheckedChange: (checked: boolean) => void } };
}

describe('ForgeSection — the rendered control is wired to onForgeWritesEnabledChange', () => {
  it('calling it invokes onForgeWritesEnabledChange with the new checked value', () => {
    const onForgeWritesEnabledChange = vi.fn();
    const toggle = switchElement({ forgeWritesEnabled: false, onForgeWritesEnabledChange, persistWarning: null });

    expect(toggle.props.onCheckedChange).toBe(onForgeWritesEnabledChange);

    toggle.props.onCheckedChange(true);
    expect(onForgeWritesEnabledChange).toHaveBeenCalledTimes(1);
    expect(onForgeWritesEnabledChange).toHaveBeenCalledWith(true);
  });
});
