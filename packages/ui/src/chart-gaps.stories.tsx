import type { Meta, StoryObj } from '@storybook/react';
import { LineChart } from './index';

const meta = {
  title: 'UI/Charts/Gaps',
  component: LineChart,
  tags: ['autodocs'],
  args: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    ariaLabel: 'Daily visitors with missing days',
    empty: 'No visitors yet',
    series: [{ label: 'Visitors', values: [120, 180, null, null, 210, 320, 290] }],
  },
  decorators: [
    (Story) => (
      <div style={{ width: 640 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LineChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BrokenLine: Story = {};

export const IsolatedReading: Story = {
  args: { series: [{ label: 'Visitors', values: [120, null, 150, null, 210, 320, null] }] },
};
