import { useState } from 'react';
import { 
  Title, 
  Text, 
  Card, 
  Switch, 
  TextInput, 
  Button, 
  Group, 
  Stack, 
  Divider, 
  Grid, 
  Paper,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  Select,
  Checkbox,
  MultiSelect,
  NumberInput
} from '@mantine/core';
import { IconBrain, IconEdit, IconTrash, IconCheck, IconX } from '@tabler/icons-react';

// Mock model data
const initialModels = [
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    enabled: true,
    capabilities: ['text', 'function-calling', 'vision'],
    contextWindow: 128000,
    costPer1MTokensInput: 10,
    costPer1MTokensOutput: 30,
    priority: 1
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    enabled: true,
    capabilities: ['text', 'function-calling'],
    contextWindow: 16000,
    costPer1MTokensInput: 0.5,
    costPer1MTokensOutput: 1.5,
    priority: 2
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    enabled: true,
    capabilities: ['text', 'vision', 'function-calling'],
    contextWindow: 200000,
    costPer1MTokensInput: 15,
    costPer1MTokensOutput: 75,
    priority: 1
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    enabled: true,
    capabilities: ['text', 'vision', 'function-calling'],
    contextWindow: 200000,
    costPer1MTokensInput: 3,
    costPer1MTokensOutput: 15,
    priority: 2
  },
  {
    id: 'local-model-1',
    name: 'Local Model 1',
    provider: 'lmstudio',
    enabled: false,
    capabilities: ['text'],
    contextWindow: 8000,
    costPer1MTokensInput: 0,
    costPer1MTokensOutput: 0,
    priority: 3
  }
];

// Mock providers for dropdown
const providers = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'lmstudio', label: 'LM Studio' },
  { value: 'ollama', label: 'Ollama' }
];

// Available capabilities
const capabilities = [
  { value: 'text', label: 'Text Generation' },
  { value: 'vision', label: 'Vision/Image Analysis' },
  { value: 'function-calling', label: 'Function Calling' },
  { value: 'embeddings', label: 'Embeddings' },
  { value: 'audio', label: 'Audio Processing' }
];

export function ModelsPage() {
  const [models, setModels] = useState(initialModels);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    provider: '',
    enabled: true,
    capabilities: [] as string[],
    contextWindow: 0,
    costPer1MTokensInput: 0,
    costPer1MTokensOutput: 0,
    priority: 1
  });

  const handleToggleModel = (id: string) => {
    setModels(models.map(model => 
      model.id === id ? { ...model, enabled: !model.enabled } : model
    ));
  };

  const handleEditModel = (model: any) => {
    setEditingModel(model.id);
    setEditForm(model);
  };

  const handleSaveEdit = () => {
    setModels(models.map(model => 
      model.id === editingModel ? editForm : model
    ));
    setEditingModel(null);
  };

  const handleCancelEdit = () => {
    setEditingModel(null);
  };

  const handleSaveChanges = () => {
    // In a real app, this would send the updated models to the API
    console.log('Saving models:', models);
    // Show success notification or feedback
  };

  return (
    <>
      <Title order={2} mb="md">LLM Models</Title>
      <Text mb="lg">Configure and enable models from your activated providers.</Text>

      <Paper withBorder p="md" mb="xl">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Model</Table.Th>
              <Table.Th>Provider</Table.Th>
              <Table.Th>Capabilities</Table.Th>
              <Table.Th>Context Window</Table.Th>
              <Table.Th>Cost (per 1M tokens)</Table.Th>
              <Table.Th>Priority</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {models.map((model) => (
              <Table.Tr key={model.id}>
                <Table.Td>{model.name}</Table.Td>
                <Table.Td>
                  {providers.find(p => p.value === model.provider)?.label || model.provider}
                </Table.Td>
                <Table.Td>
                  <Group gap={5}>
                    {model.capabilities.map(cap => (
                      <Badge key={cap} size="sm">
                        {capabilities.find(c => c.value === cap)?.label || cap}
                      </Badge>
                    ))}
                  </Group>
                </Table.Td>
                <Table.Td>{model.contextWindow.toLocaleString()}</Table.Td>
                <Table.Td>${model.costPer1MTokensInput} / ${model.costPer1MTokensOutput}</Table.Td>
                <Table.Td>{model.priority}</Table.Td>
                <Table.Td>
                  <Badge color={model.enabled ? 'green' : 'gray'}>
                    {model.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={5}>
                    <Tooltip label="Toggle Status">
                      <ActionIcon 
                        variant="subtle" 
                        color={model.enabled ? 'red' : 'green'}
                        onClick={() => handleToggleModel(model.id)}
                      >
                        {model.enabled ? <IconX size={16} /> : <IconCheck size={16} />}
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Edit Model">
                      <ActionIcon 
                        variant="subtle" 
                        color="blue"
                        onClick={() => handleEditModel(model)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {editingModel && (
        <Card withBorder shadow="sm" p="lg" radius="md" mb="xl">
          <Title order={4} mb="md">Edit Model: {editForm.name}</Title>
          <Stack>
            <TextInput
              label="Model Name"
              value={editForm.name}
              onChange={(e) => setEditForm({...editForm, name: e.target.value})}
            />
            
            <Select
              label="Provider"
              data={providers}
              value={editForm.provider}
              onChange={(value) => setEditForm({...editForm, provider: value || ''})}
            />
            
            <Switch
              label="Enabled"
              checked={editForm.enabled}
              onChange={(e) => setEditForm({...editForm, enabled: e.currentTarget.checked})}
            />
            
            <MultiSelect
              label="Capabilities"
              data={capabilities}
              value={editForm.capabilities}
              onChange={(value) => setEditForm({...editForm, capabilities: value})}
            />
            
            <NumberInput
              label="Context Window (tokens)"
              value={editForm.contextWindow}
              onChange={(value) => setEditForm({...editForm, contextWindow: Number(value)})}
              min={0}
              step={1000}
            />
            
            <NumberInput
              label="Cost per 1M Input Tokens ($)"
              value={editForm.costPer1MTokensInput}
              onChange={(value) => setEditForm({...editForm, costPer1MTokensInput: Number(value)})}
              min={0}
              precision={2}
              step={0.1}
            />
            
            <NumberInput
              label="Cost per 1M Output Tokens ($)"
              value={editForm.costPer1MTokensOutput}
              onChange={(value) => setEditForm({...editForm, costPer1MTokensOutput: Number(value)})}
              min={0}
              precision={2}
              step={0.1}
            />
            
            <NumberInput
              label="Priority (lower = higher priority)"
              value={editForm.priority}
              onChange={(value) => setEditForm({...editForm, priority: Number(value)})}
              min={1}
              max={10}
              step={1}
            />
          </Stack>
          
          <Group justify="flex-end" mt="xl">
            <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Model</Button>
          </Group>
        </Card>
      )}

      <Group justify="flex-end" mt="xl">
        <Button variant="outline">Reset Changes</Button>
        <Button onClick={handleSaveChanges}>Save All Changes</Button>
      </Group>
    </>
  );
}