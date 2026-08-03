import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Fields, Select } from './index';

const meta = {
  title: 'UI/Select',
  component: Select,
  tags: ['autodocs'],
  args: {
    size: 'default',
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render(args) {
    const [value, setValue] = useState('rare');
    return (
      <Select
        {...args}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Rarity"
      >
        <option value="common">Common</option>
        <option value="rare">Rare</option>
        <option value="epic">Epic</option>
        <option value="legendary">Legendary</option>
      </Select>
    );
  },
};

export const Compact: Story = {
  args: { size: 'compact' },
  render: function Render(args) {
    const [value, setValue] = useState('40');
    return (
      <div className="max-w-[140px]">
        <Select
          {...args}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Item level"
        >
          <option value="20">Lv 20</option>
          <option value="40">Lv 40</option>
          <option value="60">Lv 60</option>
        </Select>
      </div>
    );
  },
};

export const StarsPopup: Story = {
  render: function Render() {
    const [stars, setStars] = useState('0');
    return (
      <div className="max-w-[120px]">
        <Select
          value={stars}
          onChange={(e) => setStars(e.target.value)}
          aria-label="Stars"
        >
          <option value="0">—</option>
          <option value="1">★</option>
          <option value="2">★★</option>
          <option value="3">★★★</option>
        </Select>
      </div>
    );
  },
};

export const InFieldContext: Story = {
  render: function Render() {
    const [rarity, setRarity] = useState('rare');
    const [stars, setStars] = useState('2');
    return (
      <Fields layout="inline">
        <label>
          Rarity
          <Select value={rarity} onChange={(e) => setRarity(e.target.value)}>
            <option value="common">Common</option>
            <option value="rare">Rare</option>
            <option value="epic">Epic</option>
          </Select>
        </label>
        <label>
          Stars
          <Select value={stars} onChange={(e) => setStars(e.target.value)}>
            <option value="0">—</option>
            <option value="1">★</option>
            <option value="2">★★</option>
            <option value="3">★★★</option>
          </Select>
        </label>
      </Fields>
    );
  },
};
