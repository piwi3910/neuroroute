import { useState } from 'react';
import { 
  Title, 
  Text, 
  Card, 
  Table, 
  Group, 
  TextInput, 
  Select, 
  Button,
  Badge,
  Pagination,
  Box
} from '@mantine/core';
import { IconSearch, IconFilter } from '@tabler/icons-react';

export function AuditLogsPage() {
  // Mock audit log data - in a real app, this would come from an API call
  const mockLogs = [
    { 
      id: '1', 
      timestamp: '2025-04-24T07:30:15Z', 
      user: 'admin@example.com', 
      action: 'LOGIN', 
      resource: 'auth', 
      status: 'success',
      ipAddress: '192.168.1.1'
    },
    { 
      id: '2', 
      timestamp: '2025-04-24T07:35:22Z', 
      user: 'admin@example.com', 
      action: 'UPDATE', 
      resource: 'settings', 
      status: 'success',
      ipAddress: '192.168.1.1'
    },
    { 
      id: '3', 
      timestamp: '2025-04-24T08:12:45Z', 
      user: 'user@example.com', 
      action: 'API_CALL', 
      resource: 'models/gpt-4', 
      status: 'success',
      ipAddress: '192.168.1.2'
    },
    { 
      id: '4', 
      timestamp: '2025-04-24T09:05:11Z', 
      user: 'guest@example.com', 
      action: 'API_CALL', 
      resource: 'models/gpt-4', 
      status: 'failure',
      ipAddress: '192.168.1.3'
    },
  ];

  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    return status === 'success' ? 'green' : 'red';
  };

  return (
    <>
      <Title order={2} mb="md">Audit Logs</Title>
      <Text mb="lg">View system activity and user actions.</Text>

      <Card withBorder shadow="sm" p="md" radius="md" mb="md">
        <Group>
          <TextInput
            placeholder="Search logs..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          
          <Select
            placeholder="Filter by action"
            leftSection={<IconFilter size={16} />}
            value={actionFilter}
            onChange={setActionFilter}
            data={[
              { value: 'LOGIN', label: 'Login' },
              { value: 'LOGOUT', label: 'Logout' },
              { value: 'API_CALL', label: 'API Call' },
              { value: 'UPDATE', label: 'Update' },
              { value: 'DELETE', label: 'Delete' },
            ]}
            clearable
          />
          
          <Select
            placeholder="Filter by status"
            leftSection={<IconFilter size={16} />}
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { value: 'success', label: 'Success' },
              { value: 'failure', label: 'Failure' },
            ]}
            clearable
          />
          
          <Button variant="outline">Export</Button>
        </Group>
      </Card>

      <Card withBorder shadow="sm" p="md" radius="md">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Timestamp</Table.Th>
              <Table.Th>User</Table.Th>
              <Table.Th>Action</Table.Th>
              <Table.Th>Resource</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>IP Address</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {mockLogs.map((log) => (
              <Table.Tr key={log.id}>
                <Table.Td>{formatTimestamp(log.timestamp)}</Table.Td>
                <Table.Td>{log.user}</Table.Td>
                <Table.Td>{log.action}</Table.Td>
                <Table.Td>{log.resource}</Table.Td>
                <Table.Td>
                  <Badge color={getStatusColor(log.status)}>
                    {log.status}
                  </Badge>
                </Table.Td>
                <Table.Td>{log.ipAddress}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Box mt="md">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {mockLogs.length} of {mockLogs.length} logs
            </Text>
            <Pagination total={1} value={page} onChange={setPage} />
          </Group>
        </Box>
      </Card>
    </>
  );
}