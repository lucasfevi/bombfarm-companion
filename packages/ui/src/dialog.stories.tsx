import type { Meta, StoryObj } from '@storybook/react';
import { Dialog } from './index';

const meta = {
  title: 'UI/Dialog',
  component: Dialog.Root,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Dialog.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenStatic: Story = {
  render: () => (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Head>
            <Dialog.Title>Sample dialog</Dialog.Title>
            <Dialog.Close aria-label="Close">×</Dialog.Close>
          </Dialog.Head>
          <p className="m-0 text-sm text-muted">
            Generic body slot — no import or roster business logic.
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ),
};
