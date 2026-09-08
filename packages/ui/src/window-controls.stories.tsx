import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { WindowControls } from './window-controls';

const LABELS = {
  minimize: 'Minimize',
  maximize: 'Maximize',
  restore: 'Restore down',
  close: 'Close to tray',
};

/** The shipped surface: the cluster in a strip of the header it is drawn against. */
function WindowControlsDemo({ maximized = false }: { maximized?: boolean }) {
  return (
    <div className="flex min-h-[58px] w-full items-start justify-end bg-surface">
      <WindowControls
        maximized={maximized}
        onMinimize={() => {}}
        onToggleMaximize={() => {}}
        onClose={() => {}}
        labels={LABELS}
      />
    </div>
  );
}

function TogglingDemo() {
  const [maximized, setMaximized] = useState(false);
  return (
    <div className="flex min-h-[58px] w-full items-start justify-end bg-surface">
      <WindowControls
        maximized={maximized}
        onMinimize={() => {}}
        onToggleMaximize={() => {
          setMaximized((current) => !current);
        }}
        onClose={() => {}}
        labels={LABELS}
      />
    </div>
  );
}

const meta = {
  title: 'UI/WindowControls',
  component: WindowControlsDemo,
  tags: ['autodocs'],
} satisfies Meta<typeof WindowControlsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The middle button is a restore control here, and says so — its name changes with its glyph. */
export const Maximized: Story = {
  args: { maximized: true },
};

/** In the app the state comes from the main process, because the window is maximized by things
 *  that never touch these buttons. Clicking here stands in for that answer coming back. */
export const Toggling: Story = {
  render: () => <TogglingDemo />,
};
