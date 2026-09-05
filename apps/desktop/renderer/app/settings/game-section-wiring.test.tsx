import { describe, expect, it, vi } from 'vitest';
import { en } from '../../lib/copy/en';
import { GameSection } from './game-section';

vi.mock('../../lib/copy', () => ({
  useCopy: () => en,
  SETTINGS_WRITE_REASON_COPY_KEY: {
    no_store: 'settingsLanguageReasonNoStore',
    not_writable: 'settingsLanguageReasonNotWritable',
    unknown: 'settingsLanguageReasonUnknown',
  },
}));

function switchElement(props: {
  restartGameOnExit: boolean;
  onRestartGameOnExitChange: (next: boolean) => void;
  persistWarning: null;
}) {
  const section = GameSection(props) as unknown as {
    props: { children: [{ props: { children: unknown } }, unknown] };
  };
  const settingsRow = section.props.children[0];
  return settingsRow.props.children as { props: { onCheckedChange: (checked: boolean) => void } };
}

describe('GameSection — the rendered control is wired to onRestartGameOnExitChange', () => {
  it('calling it invokes onRestartGameOnExitChange with the new checked value', () => {
    const onRestartGameOnExitChange = vi.fn();
    const toggle = switchElement({ restartGameOnExit: false, onRestartGameOnExitChange, persistWarning: null });

    expect(toggle.props.onCheckedChange).toBe(onRestartGameOnExitChange);

    toggle.props.onCheckedChange(true);
    expect(onRestartGameOnExitChange).toHaveBeenCalledTimes(1);
    expect(onRestartGameOnExitChange).toHaveBeenCalledWith(true);

    toggle.props.onCheckedChange(false);
    expect(onRestartGameOnExitChange).toHaveBeenLastCalledWith(false);
  });
});
