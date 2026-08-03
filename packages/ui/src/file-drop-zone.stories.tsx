import type { Meta, StoryObj } from '@storybook/react';
import { FileDropZone } from './index';

const meta = {
  title: 'UI/FileDropZone',
  component: FileDropZone,
  tags: ['autodocs'],
  args: {
    onFile: () => undefined,
  },
} satisfies Meta<typeof FileDropZone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: {
    hint: 'Drop a save JSON here',
    chooseLabel: 'Choose file',
  },
};

export const WithError: Story = {
  args: {
    hint: 'Drop a save JSON here',
    chooseLabel: 'Choose file',
    error: 'Invalid JSON',
  },
};

export const DragOverPreview: Story = {
  render: (args) => (
    <div className="pointer-events-none" data-story="drag-over-preview">
      <FileDropZone {...args} />
    </div>
  ),
  args: {
    hint: 'Drop a save JSON here',
    chooseLabel: 'Choose file',
  },
};
