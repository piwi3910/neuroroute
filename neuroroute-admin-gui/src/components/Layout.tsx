import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { 
  AppShell, 
  Burger, 
  Group, 
  Title, 
  UnstyledButton, 
  Menu, 
  Text, 
  Avatar, 
  rem,
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
  IconChevronDown
} from '@tabler/icons-react';

export function Layout() {
  const [opened, { toggle }] = useDisclosure();
  const { user, logout } = useAuth();
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
        <Group h="100%" px="md" position="apart">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3}>Neuroroute Admin</Title>
          </Group>
          
          {/* User menu */}
          <Menu position="bottom-end" withArrow shadow="md" withinPortal zIndex={1000}>
            <Menu.Target>
              <UnstyledButton
                sx={{
                  padding: '8px',
                  borderRadius: '50%',
                  transition: 'background-color 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  },
                }}
              >
                <Group gap={7}>
                  <Avatar size={36} radius="xl" color="primary">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </Avatar>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Text fw={500} size="sm" lh={1} mr={3}>
                      {user?.email || 'User'}
                    </Text>
                    <Text c="dimmed" size="xs">
                      Administrator
                    </Text>
                  </div>
                  <IconChevronDown size={rem(14)} stroke={1.5} />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconSettings size={14} stroke={1.5} />}
                component={NavLink}
                to="/profile"
              >
                Profile
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconLogout size={14} stroke={1.5} />}
                onClick={logout}
                color="red"
              >
                Logout
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
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