import type { Meta, StoryObj } from '@storybook/react';
import { AreaChart } from './index';

const meta = {
  title: 'UI/Charts/Area',
  component: AreaChart,
  tags: ['autodocs'],
  args: {
    labels: Array.from({ length: 12 }, (_, index) => `${String(index * 2).padStart(2, '0')}:00`),
    ariaLabel: 'Requests per hour today',
    empty: 'No requests yet',
    series: [{ label: 'Requests', values: [40, 25, 18, 60, 180, 320, 410, 380, 350, 290, 160, 90] }],
  },
  decorators: [
    (Story) => (
      <div style={{ width: 640 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AreaChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
