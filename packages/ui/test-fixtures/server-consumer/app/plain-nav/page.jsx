import { AppNav } from '@bombfarm/ui';

export default function Page() {
  return (
    <AppNav
      items={[
        { id: 'one', label: 'One', active: true },
        { id: 'two', label: 'Two', active: false },
      ]}
    />
  );
}
