import type { Meta, StoryObj } from '@storybook/react';
import { Sparkline } from './index';

const RISING = [40, 44, 41, 52, 49, 61, 58, 70, 66, 78, 74, 86, 90];

const meta = {
  title: 'UI/Sparkline',
  component: Sparkline,
  tags: ['autodocs'],
  args: { values: RISING, ariaLabel: 'Gold per hour over the last 10 minutes' },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sparkline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rising: Story = {};

export const Toned: Story = {
  args: { className: 'text-gold' },
};

export const WithGaps: Story = {
  args: { values: [40, 44, null, null, 61, 58, 70, null, 78, 86, 90] },
};

export const Empty: Story = {
  args: { values: [] },
};
