import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SaveBar, SettingsRow, SettingsSection, Slider, Switch } from './index';

const meta = {
  title: 'UI/SettingsForm',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SectionWithRows: Story = {
  render: function Render() {
    const [autoDismiss, setAutoDismiss] = useState(true);
    const [ttl, setTtl] = useState(30);
    return (
      <div className="w-[26rem]">
        <SettingsSection title="Notifications" description="Control how toasts behave.">
          <SettingsRow label="Auto-dismiss success toasts" help="Applies to success and info toasts only.">
            <Switch checked={autoDismiss} onCheckedChange={setAutoDismiss} aria-label="Auto-dismiss success toasts" />
          </SettingsRow>
          <SettingsRow label="Price cache TTL">
            <Slider
              value={ttl}
              onValueChange={setTtl}
              min={5}
              max={60}
              step={5}
              aria-label="Price cache TTL"
              valueLabel={`${ttl} min`}
            />
          </SettingsRow>
        </SettingsSection>
      </div>
    );
  },
};

export const SectionHeadingLevel3: Story = {
  render: () => (
    <div className="w-[26rem]">
      <SettingsSection title="Advanced" headingLevel={3}>
        <SettingsRow label="Row under an h3 section">
          <span className="text-sm text-muted">control</span>
        </SettingsRow>
      </SettingsSection>
    </div>
  ),
};

export const SaveBarClean: Story = {
  render: () => (
    <div className="w-[26rem]">
      <SaveBar dirty={false} onSave={() => {}} onDiscard={() => {}} />
    </div>
  ),
};

export const SaveBarDirty: Story = {
  render: () => (
    <div className="w-[26rem]">
      <SaveBar dirty onSave={() => {}} onDiscard={() => {}} />
    </div>
  ),
};

export const SaveBarSaving: Story = {
  render: () => (
    <div className="w-[26rem]">
      <SaveBar dirty saving onSave={() => {}} onDiscard={() => {}} />
    </div>
  ),
};
