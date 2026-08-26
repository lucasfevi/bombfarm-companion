import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SegmentedToggle, type SegmentedToggleOption } from './segmented-toggle';

const LANGUAGE_OPTIONS: SegmentedToggleOption[] = [
  { id: 'pt', label: 'PT' },
  { id: 'en', label: 'EN' },
];

function SegmentedToggleDemo({ initialValue = 'pt' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <SegmentedToggle options={LANGUAGE_OPTIONS} value={value} onChange={setValue} ariaLabel="Language" />;
}

const RANGE_OPTIONS: SegmentedToggleOption[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

function ThreeOptionDemo() {
  const [value, setValue] = useState('week');
  return <SegmentedToggle options={RANGE_OPTIONS} value={value} onChange={setValue} ariaLabel="Range" />;
}

const meta = {
  title: 'UI/SegmentedToggle',
  component: SegmentedToggleDemo,
  tags: ['autodocs'],
} satisfies Meta<typeof SegmentedToggleDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EnglishSelected: Story = {
  args: { initialValue: 'en' },
};

/** Three options — the shape is not language-specific (DS-09). */
export const ThreeOptions: Story = {
  render: () => <ThreeOptionDemo />,
};
