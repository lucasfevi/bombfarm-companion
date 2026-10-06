import type { Meta, StoryObj } from '@storybook/react';
import { CornerDismiss } from './corner-dismiss';

const meta = {
  title: 'Design system/CornerDismiss',
  component: CornerDismiss,
  args: { label: 'Remove this card' },
  decorators: [
    (Story) => (
      <div className="relative w-48 rounded-sm border border-line p-3 text-xs text-ink">
        A card with something removable in it.
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CornerDismiss>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
