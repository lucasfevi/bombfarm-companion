import type { Meta, StoryObj } from '@storybook/react';
import { Fields, Num, Select } from '@/shared/design-system';

const meta = {
  title: 'UI/Fields',
  component: Fields,
  tags: ['autodocs'],
} satisfies Meta<typeof Fields>;

export default meta;
type Story = StoryObj<typeof meta>;

function FieldDemo({ layout }: { layout: 'inline' | 'inline-dense' | 'stack' }) {
  return (
    <Fields layout={layout}>
      <label className="text-xs text-muted">
        Attack speed
        <Num value={1.2} onChange={() => undefined} decimals={2} />
      </label>
      <label className="text-xs text-muted">
        Crit rate
        <Num value={0.15} onChange={() => undefined} decimals={2} />
      </label>
      <label className="text-xs text-muted">
        Rarity
        <Select defaultValue="rare">
          <option value="common">Common</option>
          <option value="rare">Rare</option>
          <option value="epic">Epic</option>
        </Select>
      </label>
    </Fields>
  );
}

export const Inline: Story = {
  render: () => <FieldDemo layout="inline" />,
};

export const InlineDense: Story = {
  render: () => <FieldDemo layout="inline-dense" />,
};

export const Stack: Story = {
  render: () => <FieldDemo layout="stack" />,
};
