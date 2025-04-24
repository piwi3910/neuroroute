import { Outlet } from 'react-router-dom';
import { AppShell, Burger, Group, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

export function Layout() {
  const [opened, { toggle }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Title order={3}>Neuroroute Admin</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {/* Placeholder for Navigation Links */}
        Navigation
      </AppShell.Navbar>

      <AppShell.Main>
        {/* Content for the current route will be rendered here */}
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}