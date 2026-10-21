import type { Meta, StoryObj } from '@storybook/react';
import { ConfirmDialog } from './confirm-dialog';

const meta = {
  title: 'UI/ConfirmDialog danger',
  component: ConfirmDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onConfirm: () => undefined,
    title: 'Delete account',
    description: 'Your data is removed for good and this cannot be undone.',
    confirmLabel: 'Delete account',
    cancelLabel: 'Keep account',
    closeLabel: 'Close',
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Danger: Story = {
  args: { tone: 'danger' },
};

export const DangerWithAcknowledgement: Story = {
  args: { tone: 'danger', requireAck: 'I understand this is permanent' },
};
