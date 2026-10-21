import type { Meta, StoryObj } from '@storybook/react';
import { BarChart } from './index';

const meta = {
  title: 'UI/Charts/Bar',
  component: BarChart,
  tags: ['autodocs'],
  args: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    ariaLabel: 'Daily visitors this week',
    empty: 'No visitors yet',
    series: [{ label: 'Visitors', values: [120, 180, 0, 240, 210, 320, 290] }],
  },
  decorators: [
    (Story) => (
      <div style={{ width: 640 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithTable: Story = {
  args: { table: { summary: 'Show as table', labelHeading: 'Day' } },
};

export const ManyBars: Story = {
  args: {
    labels: Array.from({ length: 30 }, (_, index) => String(index + 1)),
    series: [{ label: 'Visitors', values: Array.from({ length: 30 }, (_, index) => 100 + ((index * 37) % 90)) }],
  },
};
