import type { Meta, StoryObj } from '@storybook/react';
import { LineChart } from './index';

const meta = {
  title: 'UI/Charts/Multiple series',
  component: LineChart,
  tags: ['autodocs'],
  args: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    ariaLabel: 'Daily visitors by source this week',
    empty: 'No visitors yet',
    series: [
      { label: 'Search', values: [120, 180, 150, 240, 210, 320, 290] },
      { label: 'Direct', values: [90, 100, 130, 110, 160, 140, 200] },
      { label: 'Referral', values: [30, 45, 40, 70, 65, 90, 80] },
      { label: 'Social', values: [10, 20, 15, 35, 60, 120, 70] },
    ],
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

export const FourSeries: Story = {};

export const Shaded: Story = {
  args: { fill: true },
};

export const WithTable: Story = {
  args: { table: { summary: 'Show as table', labelHeading: 'Day' } },
};
