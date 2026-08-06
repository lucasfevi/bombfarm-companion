import type { Meta, StoryObj } from '@storybook/react';
import { Icon, glyphApproval, iconSources, type IconName } from './index';

const meta = {
  title: 'UI/Icon',
  component: Icon,
  tags: ['autodocs'],
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

const uiNames = (Object.keys(iconSources) as IconName[]).filter(
  (name) => iconSources[name] === 'ui',
);

const gameNames = (Object.keys(iconSources) as IconName[]).filter(
  (name) => iconSources[name] === 'game',
);

const placeholderCount = Object.values(glyphApproval).filter(
  (row) => row.approval === 'placeholder',
).length;

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

export const GameGlyphGallery: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {placeholderCount} of 17 awaiting approval
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {gameNames.map((name) => {
          const isPlaceholder = glyphApproval[name].approval === 'placeholder';
          return (
            <div key={name} className="flex flex-col gap-2 rounded border border-border p-3">
              <div className="flex items-center gap-2">
                <Icon name={name} />
                <span className="font-mono text-xs text-muted">{name}</span>
              </div>
              {isPlaceholder ? (
                <span className="w-fit rounded bg-warn/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn">
                  Placeholder
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-6">
      {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <Icon name="gem" size={size} />
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
        <Icon name="key" />
        <p className="font-mono text-xs text-muted">aria-hidden=&quot;true&quot;</p>
      </div>
      <div className="space-y-2 rounded border border-border p-3">
        <Icon name="key" label="Vault key" />
        <p className="font-mono text-xs text-muted">
          role=&quot;img&quot; · aria-label=&quot;Vault key&quot;
        </p>
      </div>
    </div>
  ),
};
