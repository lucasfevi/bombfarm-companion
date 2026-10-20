import type { Meta, StoryObj } from '@storybook/react';
import { SegmentedToggleForm } from './segmented-toggle-form';
import { StatusDot } from './status-dot';
import { StepProgress } from './step-progress';

function Indicators() {
  return (
    <div className="flex flex-col gap-4">
      <StatusDot tone="live" label="Connected" live />
      <StatusDot tone="warn" label="Degraded" />
      <StatusDot tone="down" label="Offline" />
      <StatusDot tone="muted" label="Idle" />
      <StepProgress label="Setup progress" steps={['Choose', 'Review', 'Finish']} current={2} />
      <SegmentedToggleForm
        name="range"
        value="week"
        ariaLabel="Range"
        action="/records"
        hidden={{ sort: 'name' }}
        options={[
          { id: 'day', label: 'Day' },
          { id: 'week', label: 'Week' },
          { id: 'month', label: 'Month' },
        ]}
      />
    </div>
  );
}

const meta = {
  title: 'UI/Progress indicators and form toggle',
  component: Indicators,
} satisfies Meta<typeof Indicators>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
