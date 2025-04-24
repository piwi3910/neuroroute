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
  PasswordInput,
  Accordion,
  Badge
} from '@mantine/core';
import { IconServer, IconCheck, IconX } from '@tabler/icons-react';

// Mock provider data
const initialProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    enabled: true,
    apiKey: 'sk-••••••••••••••••••••••••••••••',
    apiEndpoint: 'https://api.openai.com/v1',
    customEndpoint: false,
    models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-vision', 'gpt-4-turbo'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    enabled: true,
    apiKey: 'sk-ant-••••••••••••••••••••••••••',
    apiEndpoint: 'https://api.anthropic.com',
    customEndpoint: false,
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    enabled: false,
    apiKey: '',
    apiEndpoint: 'http://localhost:1234/v1',
    customEndpoint: true,
    models: ['local-model-1', 'local-model-2'],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    enabled: false,
    apiKey: '',
    apiEndpoint: 'http://localhost:11434/api',
    customEndpoint: true,
    models: ['llama3', 'mistral', 'gemma'],
  }
];

export function ProvidersPage() {
  const [providers, setProviders] = useState(initialProviders);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);

  const handleToggleProvider = (id: string) => {
    setProviders(providers.map(provider => 
      provider.id === id ? { ...provider, enabled: !provider.enabled } : provider
    ));
  };

  const handleUpdateProvider = (id: string, field: string, value: string | boolean) => {
    setProviders(providers.map(provider => 
      provider.id === id ? { ...provider, [field]: value } : provider
    ));
  };

  const handleSaveChanges = () => {
    // In a real app, this would send the updated providers to the API
    console.log('Saving providers:', providers);
    // Show success notification or feedback
  };

  return (
    <>
      <Title order={2} mb="md">LLM Providers</Title>
      <Text mb="lg">Enable and configure LLM providers for your Neuroroute instance.</Text>

      <Grid>
        <Grid.Col span={12}>
          <Accordion>
            {providers.map((provider) => (
              <Accordion.Item key={provider.id} value={provider.id}>
                <Accordion.Control>
                  <Group>
                    <IconServer size={20} />
                    <Text fw={500}>{provider.name}</Text>
                    <Badge color={provider.enabled ? 'green' : 'gray'}>
                      {provider.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack>
                    <Switch
                      label={`Enable ${provider.name}`}
                      checked={provider.enabled}
                      onChange={() => handleToggleProvider(provider.id)}
                    />

                    <TextInput
                      label="Provider Name"
                      value={provider.name}
                      onChange={(e) => handleUpdateProvider(provider.id, 'name', e.target.value)}
                    />

                    <PasswordInput
                      label="API Key"
                      description="Your API key for authentication"
                      value={provider.apiKey}
                      onChange={(e) => handleUpdateProvider(provider.id, 'apiKey', e.target.value)}
                    />

                    <Switch
                      label="Use Custom Endpoint"
                      checked={provider.customEndpoint}
                      onChange={(e) => handleUpdateProvider(provider.id, 'customEndpoint', e.currentTarget.checked)}
                    />

                    {provider.customEndpoint && (
                      <TextInput
                        label="API Endpoint"
                        description="Custom API endpoint URL"
                        value={provider.apiEndpoint}
                        onChange={(e) => handleUpdateProvider(provider.id, 'apiEndpoint', e.target.value)}
                      />
                    )}

                    <Divider my="sm" />

                    <Title order={5}>Available Models</Title>
                    <Text size="sm" c="dimmed">
                      Models are configured in the Models section after enabling the provider.
                    </Text>
                    <Group>
                      {provider.models.map((model) => (
                        <Badge key={model}>{model}</Badge>
                      ))}
                    </Group>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Grid.Col>
      </Grid>

      <Group justify="flex-end" mt="xl">
        <Button variant="outline">Reset Changes</Button>
        <Button onClick={handleSaveChanges}>Save Changes</Button>
      </Group>
    </>
  );
}