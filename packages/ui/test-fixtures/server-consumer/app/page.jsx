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
        brand={
          <a href="/" className={ui.siteHeaderBrandClass}>
            <ui.BrandLockup title="Acme" tag="Planner" />
          </a>
        }
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
        compactActions={
          <ui.DetailsMenu.Root label="Site menu">
            <ui.DetailsMenu.Item render={<a href="/reports" />}>Reports link</ui.DetailsMenu.Item>
            <ui.DetailsMenu.Item>Sign out button</ui.DetailsMenu.Item>
          </ui.DetailsMenu.Root>
        }
      />
      <ui.SiteFooter
        legal={<span>Acme legal line</span>}
        trailing={<a href="/terms">Terms link</a>}
      />
      <ui.PageFrame
        header={<p>Frame header</p>}
        notices={<p>Frame notice</p>}
        footer={<p>Frame footer</p>}
        overlays={<p>Frame overlay</p>}
      >
        <ui.PageSection>Default section</ui.PageSection>
        <ui.PageSection measure="settings">Settings section</ui.PageSection>
      </ui.PageFrame>
      <ui.Panel data-testid="server-panel">server panel</ui.Panel>
      <ui.Select aria-label="Fixture select" defaultValue="a">
        <option value="a">Alpha</option>
      </ui.Select>
      <ui.TextInput aria-label="Fixture text input" placeholder="Type here" />
      <ui.TextArea aria-label="Fixture text area" defaultValue="Draft body" aria-invalid />
      <ui.TextLink href="/fixture-help">Fixture help link</ui.TextLink>
      <ui.Pagination page={2} pageCount={3} hrefFor={(page) => `/fixture-page/${page}`} />
      <ui.Skeleton shape="rows" rows={2} label="Fixture loading" />
      <ui.ErrorScreen title="Fixture error" message="Fixture error message" action={<a href="/fixture-retry">Retry</a>} />
      <ui.NativeSelect aria-label="Fixture native select" defaultValue="b">
        <option value="a">Alpha native</option>
        <option value="b">Beta native</option>
      </ui.NativeSelect>
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
