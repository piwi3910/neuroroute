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
  IconClipboardList,
  IconLogout,
  IconServer,
  IconBrain,
  IconFilter,
  IconCategory,
  IconRoute
} from '@tabler/icons-react';

export function Layout() {
  const [opened, { toggle }] = useDisclosure();
  const { user, logout } = useAuth();
  const location = useLocation();

  // Navigation items
  const dashboardItems = [
    { label: 'Dashboard', path: '/', icon: <IconHome size={20} stroke={1.5} /> },
    { label: 'Providers', path: '/providers', icon: <IconServer size={20} stroke={1.5} /> },
    { label: 'Models', path: '/models', icon: <IconBrain size={20} stroke={1.5} /> },
  ];

  const processingItems = [
    { label: 'Preprocessor', path: '/preprocessor', icon: <IconFilter size={20} stroke={1.5} /> },
    { label: 'Classifier', path: '/classifier', icon: <IconCategory size={20} stroke={1.5} /> },
    { label: 'Routing', path: '/routing', icon: <IconRoute size={20} stroke={1.5} /> },
  ];

  const adminItems = [
    { label: 'Users', path: '/users', icon: <IconUsers size={20} stroke={1.5} /> },
    { label: 'Settings', path: '/settings', icon: <IconSettings size={20} stroke={1.5} /> },
    { label: 'Audit Logs', path: '/audit-logs', icon: <IconClipboardList size={20} stroke={1.5} /> },
  ];

  // Handle logout
  const handleLogout = () => {
    logout();
  };

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
        {/* Dashboard section */}
        <Box>
          {dashboardItems.map((item) => (
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

        <Divider my="sm" label="Processing" labelPosition="center" />
        
        {/* Processing section */}
        <Box>
          {processingItems.map((item) => (
            <MantineNavLink
              key={item.path}
              component={NavLink}
              to={item.path}
              label={item.label}
              leftSection={item.icon}
              active={location.pathname.startsWith(item.path)}
              variant="filled"
              mb={8}
            />
          ))}
        </Box>

        <Divider my="sm" label="Administration" labelPosition="center" />
        
        {/* Admin section */}
        <Box>
          {adminItems.map((item) => (
            <MantineNavLink
              key={item.path}
              component={NavLink}
              to={item.path}
              label={item.label}
              leftSection={item.icon}
              active={location.pathname.startsWith(item.path)}
              variant="filled"
              mb={8}
            />
          ))}
        </Box>

        <Divider my="sm" />
        
        <MantineNavLink
          label="Log Off"
          leftSection={<IconLogout size={20} stroke={1.5} />}
          onClick={handleLogout}
          color="red"
          mb={8}
        />
        
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