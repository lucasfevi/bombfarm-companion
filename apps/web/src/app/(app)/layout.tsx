import { ClientAppShell } from '@/app/_shell/client-app-shell';

export default function AppLayout({
  children,
  planner,
}: Readonly<{
  children: React.ReactNode;
  planner: React.ReactNode;
}>) {
  return (
    <ClientAppShell planner={planner}>
      {children}
    </ClientAppShell>
  );
}
