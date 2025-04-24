import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppShell,
  Burger,
  Group,
  Title,
  Text,
  NavLink as MantineNavLink,
  Divider,
  Box
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useAuth } from '../contexts/AuthContext';
import {
  IconHome,
  IconUsers,
  IconSettings,
  IconClipboardList
} from '@tabler/icons-react';

export function Layout() {
  const [opened, { toggle }] = useDisclosure();
  const { user } = useAuth();
  const location = useLocation();

  // Navigation items
  const navItems = [
    { label: 'Dashboard', path: '/', icon: <IconHome size={20} stroke={1.5} /> },
    { label: 'Users', path: '/users', icon: <IconUsers size={20} stroke={1.5} /> },
    { label: 'Settings', path: '/settings', icon: <IconSettings size={20} stroke={1.5} /> },
    { label: 'Audit Logs', path: '/audit-logs', icon: <IconClipboardList size={20} stroke={1.5} /> },
  ];

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
        <Box>
          {navItems.map((item) => (
            <MantineNavLink
              key={item.path}
              component={NavLink}
              to={item.path}
              label={item.label}
              leftSection={item.icon}
              active={
                item.path === '/' 
                  ? location.pathname === '/' 
                  : location.pathname.startsWith(item.path)
              }
              variant="filled"
              mb={8}
            />
          ))}
        </Box>

        <Divider my="sm" />
        
        <Text size="xs" c="dimmed" ta="center" mt="xl">
          Neuroroute Admin v1.0.0
        </Text>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}