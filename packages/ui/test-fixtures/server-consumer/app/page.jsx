import * as ui from '@bombfarm/ui';

const names = Object.keys(ui).sort();

export default function Page() {
  return (
    <main>
      <p data-testid="export-count">{names.length}</p>
      <ul data-testid="export-names">
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <ui.SiteHeader
        brand={<a href="/" className={ui.siteHeaderBrandClass}>Acme</a>}
        nav={
          <ui.AppNav
            ariaLabel="Header sections"
            items={[
              { id: 'reports', label: 'Reports', active: true },
              { id: 'billing', label: 'Billing', active: false },
            ]}
          />
        }
        actions={<span>Header actions</span>}
        compactActions={<span>Header compact actions</span>}
      />
      <ui.Panel data-testid="server-panel">server panel</ui.Panel>
      <ui.Select aria-label="Fixture select" defaultValue="a">
        <option value="a">Alpha</option>
      </ui.Select>
      <ui.Accordion.Root defaultValue={['first']}>
        <ui.Accordion.Item value="first">
          <ui.Accordion.Header>
            <ui.Accordion.Trigger>Accordion trigger one</ui.Accordion.Trigger>
          </ui.Accordion.Header>
          <ui.Accordion.Panel>Accordion panel one</ui.Accordion.Panel>
        </ui.Accordion.Item>
        <ui.Accordion.Item value="second">
          <ui.Accordion.Header>
            <ui.Accordion.Trigger>Accordion trigger two</ui.Accordion.Trigger>
          </ui.Accordion.Header>
          <ui.Accordion.Panel>Accordion panel two</ui.Accordion.Panel>
        </ui.Accordion.Item>
      </ui.Accordion.Root>
      <ui.Collapsible.Root defaultOpen>
        <ui.Collapsible.Trigger>Collapsible trigger</ui.Collapsible.Trigger>
        <ui.Collapsible.Panel>Collapsible panel text</ui.Collapsible.Panel>
      </ui.Collapsible.Root>
      <ui.Tabs.Root defaultValue="one">
        <ui.Tabs.List>
          <ui.Tabs.Tab value="one">Tab label one</ui.Tabs.Tab>
          <ui.Tabs.Tab value="two">Tab label two</ui.Tabs.Tab>
        </ui.Tabs.List>
        <ui.Tabs.Panels>
          <ui.Tabs.Panel value="one">Tab panel one</ui.Tabs.Panel>
          <ui.Tabs.Panel value="two">Tab panel two</ui.Tabs.Panel>
        </ui.Tabs.Panels>
      </ui.Tabs.Root>
    </main>
  );
}
