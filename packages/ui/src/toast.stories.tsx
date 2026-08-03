import type { Meta, StoryObj } from '@storybook/react';
import { Toast } from '@/shared/design-system';

const meta = {
  title: 'UI/Toast',
  component: Toast,
  tags: ['autodocs'],
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {
  args: { message: 'Plan saved to browser storage.' },
};

/** When `message` is null the component returns null — nothing renders on the canvas. */
export const Hidden: Story = {
  args: { message: null },
};
