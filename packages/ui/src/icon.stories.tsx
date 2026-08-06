import type { Meta, StoryObj } from '@storybook/react';
import { Icon, iconSources, type IconName } from './index';

const meta = {
  title: 'UI/Icon',
  component: Icon,
  tags: ['autodocs'],
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

const uiNames = Object.keys(iconSources) as IconName[];

const sizeCaptions: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: '12px',
  sm: '16px',
  md: '20px',
  lg: '24px',
};

export const UiChromeGallery: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {uiNames.map((name) => (
        <div key={name} className="flex items-center gap-2 rounded border border-border p-3">
          <Icon name={name} />
          <span className="font-mono text-xs text-muted">{name}</span>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-6">
      {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <Icon name="chevron-down" size={size} />
          <span className="font-mono text-xs text-muted">
            {size} · {sizeCaptions[size]}
          </span>
        </div>
      ))}
    </div>
  ),
};

export const Semantics: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2 rounded border border-border p-3">
        <Icon name="x-mark" />
        <p className="font-mono text-xs text-muted">wrapper aria-hidden</p>
      </div>
      <div className="space-y-2 rounded border border-border p-3">
        <Icon name="x-mark" label="Close dialog" />
        <p className="font-mono text-xs text-muted">
          wrapper role=&quot;img&quot; · aria-label
        </p>
      </div>
    </div>
  ),
};
