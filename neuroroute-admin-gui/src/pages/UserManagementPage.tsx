import { Title, Text, Card, Group, Button, Table } from '@mantine/core';

export function UserManagementPage() {
  // Mock user data - in a real app, this would come from an API call
  const mockUsers = [
    { id: '1', email: 'admin@example.com', role: 'admin', status: 'active' },
    { id: '2', email: 'user@example.com', role: 'user', status: 'active' },
    { id: '3', email: 'guest@example.com', role: 'guest', status: 'inactive' },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>User Management</Title>
        <Button>Add New User</Button>
      </Group>

      <Text mb="lg">Manage user accounts and permissions.</Text>

      <Card withBorder shadow="sm" p="md" radius="md">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {mockUsers.map((user) => (
              <Table.Tr key={user.id}>
                <Table.Td>{user.id}</Table.Td>
                <Table.Td>{user.email}</Table.Td>
                <Table.Td>{user.role}</Table.Td>
                <Table.Td>{user.status}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button variant="outline" size="xs">Edit</Button>
                    <Button variant="outline" color="red" size="xs">Delete</Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </>
  );
}