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
  Slider,
  NumberInput,
  Select,
  Accordion,
  Badge,
  Tooltip,
  ThemeIcon
} from '@mantine/core';
import { IconFilter, IconInfoCircle } from '@tabler/icons-react';

// Mock preprocessor settings
const initialSettings = {
  caching: {
    enabled: true,
    ttlMinutes: 60,
    maxCacheSize: 1000,
    strategy: 'lru'
  },
  compression: {
    enabled: true,
    method: 'semantic',
    compressionRatio: 0.7,
    preserveKeyInfo: true
  },
  sanitization: {
    enabled: true,
    removePersonalInfo: true,
    removeSensitiveData: true,
    customPatterns: [
      'api_key=[^&]*',
      'password=[^&]*',
      '\\b(?:\\d[ -]*?){13,16}\\b' // Credit card pattern
    ]
  },
  replacement: {
    enabled: false,
    patterns: [
      { pattern: 'foo', replacement: 'bar' },
      { pattern: 'hello', replacement: 'hi' }
    ]
  }
};

// Cache strategy options
const cacheStrategies = [
  { value: 'lru', label: 'Least Recently Used (LRU)' },
  { value: 'lfu', label: 'Least Frequently Used (LFU)' },
  { value: 'fifo', label: 'First In First Out (FIFO)' }
];

// Compression method options
const compressionMethods = [
  { value: 'semantic', label: 'Semantic Compression' },
  { value: 'token', label: 'Token-based Compression' },
  { value: 'hybrid', label: 'Hybrid Approach' }
];

export function PreprocessorPage() {
  const [settings, setSettings] = useState(initialSettings);

  const updateSettings = (category: string, field: string, value: any) => {
    setSettings({
      ...settings,
      [category]: {
        ...settings[category as keyof typeof settings],
        [field]: value
      }
    });
  };

  const handleSaveChanges = () => {
    // In a real app, this would send the updated settings to the API
    console.log('Saving preprocessor settings:', settings);
    // Show success notification or feedback
  };

  return (
    <>
      <Title order={2} mb="md">Preprocessor Settings</Title>
      <Text mb="lg">Configure how incoming prompts are preprocessed before being sent to LLM models.</Text>

      <Accordion defaultValue="caching">
        {/* Caching Section */}
        <Accordion.Item value="caching">
          <Accordion.Control>
            <Group>
              <ThemeIcon color="blue" variant="light" size="lg">
                <IconFilter size={20} />
              </ThemeIcon>
              <div>
                <Text fw={500}>Caching</Text>
                <Text size="sm" c="dimmed">Store and reuse responses for similar prompts</Text>
              </div>
              <Badge color={settings.caching.enabled ? 'green' : 'gray'}>
                {settings.caching.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Card withBorder p="md">
              <Stack>
                <Switch
                  label="Enable Caching"
                  description="Store responses to similar prompts to improve response time and reduce costs"
                  checked={settings.caching.enabled}
                  onChange={(e) => updateSettings('caching', 'enabled', e.currentTarget.checked)}
                />

                {settings.caching.enabled && (
                  <>
                    <NumberInput
                      label="Cache TTL (Time to Live)"
                      description="Time in minutes before cached items expire"
                      value={settings.caching.ttlMinutes}
                      onChange={(value) => updateSettings('caching', 'ttlMinutes', Number(value))}
                      min={1}
                      max={10080} // 1 week
                    />

                    <NumberInput
                      label="Maximum Cache Size"
                      description="Maximum number of items to store in cache"
                      value={settings.caching.maxCacheSize}
                      onChange={(value) => updateSettings('caching', 'maxCacheSize', Number(value))}
                      min={10}
                      max={10000}
                    />

                    <Select
                      label="Cache Eviction Strategy"
                      description="Method used to determine which items to remove when cache is full"
                      data={cacheStrategies}
                      value={settings.caching.strategy}
                      onChange={(value) => updateSettings('caching', 'strategy', value || 'lru')}
                    />
                  </>
                )}
              </Stack>
            </Card>
          </Accordion.Panel>
        </Accordion.Item>

        {/* Compression Section */}
        <Accordion.Item value="compression">
          <Accordion.Control>
            <Group>
              <ThemeIcon color="green" variant="light" size="lg">
                <IconFilter size={20} />
              </ThemeIcon>
              <div>
                <Text fw={500}>Context Compression</Text>
                <Text size="sm" c="dimmed">Reduce token usage while preserving meaning</Text>
              </div>
              <Badge color={settings.compression.enabled ? 'green' : 'gray'}>
                {settings.compression.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Card withBorder p="md">
              <Stack>
                <Group align="flex-start">
                  <Switch
                    label="Enable Context Compression"
                    description="Compress prompts to reduce token usage while preserving meaning"
                    checked={settings.compression.enabled}
                    onChange={(e) => updateSettings('compression', 'enabled', e.currentTarget.checked)}
                  />
                  <Tooltip label="Context compression can significantly reduce token usage and costs, but may slightly impact response quality for complex prompts.">
                    <ThemeIcon color="gray" variant="light" size="sm" style={{ cursor: 'help' }}>
                      <IconInfoCircle size={16} />
                    </ThemeIcon>
                  </Tooltip>
                </Group>

                {settings.compression.enabled && (
                  <>
                    <Select
                      label="Compression Method"
                      description="Technique used to compress context"
                      data={compressionMethods}
                      value={settings.compression.method}
                      onChange={(value) => updateSettings('compression', 'method', value || 'semantic')}
                    />

                    <Stack spacing={5}>
                      <Text size="sm" fw={500}>Compression Ratio: {settings.compression.compressionRatio}</Text>
                      <Text size="xs" c="dimmed">Higher values compress more aggressively (0.1 = minimal, 0.9 = maximum)</Text>
                      <Slider
                        min={0.1}
                        max={0.9}
                        step={0.1}
                        value={settings.compression.compressionRatio}
                        onChange={(value) => updateSettings('compression', 'compressionRatio', value)}
                        marks={[
                          { value: 0.1, label: 'Minimal' },
                          { value: 0.5, label: 'Balanced' },
                          { value: 0.9, label: 'Maximum' }
                        ]}
                      />
                    </Stack>

                    <Switch
                      label="Preserve Key Information"
                      description="Ensure critical information is not lost during compression"
                      checked={settings.compression.preserveKeyInfo}
                      onChange={(e) => updateSettings('compression', 'preserveKeyInfo', e.currentTarget.checked)}
                    />
                  </>
                )}
              </Stack>
            </Card>
          </Accordion.Panel>
        </Accordion.Item>

        {/* Sanitization Section */}
        <Accordion.Item value="sanitization">
          <Accordion.Control>
            <Group>
              <ThemeIcon color="orange" variant="light" size="lg">
                <IconFilter size={20} />
              </ThemeIcon>
              <div>
                <Text fw={500}>Input Sanitization</Text>
                <Text size="sm" c="dimmed">Remove sensitive or personal information</Text>
              </div>
              <Badge color={settings.sanitization.enabled ? 'green' : 'gray'}>
                {settings.sanitization.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Card withBorder p="md">
              <Stack>
                <Switch
                  label="Enable Input Sanitization"
                  description="Remove sensitive information from prompts before processing"
                  checked={settings.sanitization.enabled}
                  onChange={(e) => updateSettings('sanitization', 'enabled', e.currentTarget.checked)}
                />

                {settings.sanitization.enabled && (
                  <>
                    <Switch
                      label="Remove Personal Information"
                      description="Detect and redact names, addresses, and other personal identifiers"
                      checked={settings.sanitization.removePersonalInfo}
                      onChange={(e) => updateSettings('sanitization', 'removePersonalInfo', e.currentTarget.checked)}
                    />

                    <Switch
                      label="Remove Sensitive Data"
                      description="Detect and redact credit card numbers, API keys, and other sensitive data"
                      checked={settings.sanitization.removeSensitiveData}
                      onChange={(e) => updateSettings('sanitization', 'removeSensitiveData', e.currentTarget.checked)}
                    />

                    <Title order={5} mt="md">Custom Sanitization Patterns</Title>
                    <Text size="sm" c="dimmed" mb="sm">
                      Add custom regex patterns to detect and redact specific information
                    </Text>

                    {settings.sanitization.customPatterns.map((pattern, index) => (
                      <Group key={index} position="apart">
                        <TextInput
                          style={{ flex: 1 }}
                          value={pattern}
                          onChange={(e) => {
                            const newPatterns = [...settings.sanitization.customPatterns];
                            newPatterns[index] = e.target.value;
                            updateSettings('sanitization', 'customPatterns', newPatterns);
                          }}
                        />
                        <Button 
                          variant="subtle" 
                          color="red"
                          onClick={() => {
                            const newPatterns = settings.sanitization.customPatterns.filter((_, i) => i !== index);
                            updateSettings('sanitization', 'customPatterns', newPatterns);
                          }}
                        >
                          Remove
                        </Button>
                      </Group>
                    ))}

                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const newPatterns = [...settings.sanitization.customPatterns, ''];
                        updateSettings('sanitization', 'customPatterns', newPatterns);
                      }}
                    >
                      Add Pattern
                    </Button>
                  </>
                )}
              </Stack>
            </Card>
          </Accordion.Panel>
        </Accordion.Item>

        {/* Replacement Section */}
        <Accordion.Item value="replacement">
          <Accordion.Control>
            <Group>
              <ThemeIcon color="grape" variant="light" size="lg">
                <IconFilter size={20} />
              </ThemeIcon>
              <div>
                <Text fw={500}>Text Replacement</Text>
                <Text size="sm" c="dimmed">Replace specific text patterns in prompts</Text>
              </div>
              <Badge color={settings.replacement.enabled ? 'green' : 'gray'}>
                {settings.replacement.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Card withBorder p="md">
              <Stack>
                <Switch
                  label="Enable Text Replacement"
                  description="Replace specific text patterns in prompts before processing"
                  checked={settings.replacement.enabled}
                  onChange={(e) => updateSettings('replacement', 'enabled', e.currentTarget.checked)}
                />

                {settings.replacement.enabled && (
                  <>
                    <Title order={5} mt="md">Replacement Patterns</Title>
                    <Text size="sm" c="dimmed" mb="sm">
                      Define patterns to find and their replacements
                    </Text>

                    {settings.replacement.patterns.map((item, index) => (
                      <Card key={index} withBorder p="sm" mb="sm">
                        <Stack>
                          <TextInput
                            label="Find"
                            value={item.pattern}
                            onChange={(e) => {
                              const newPatterns = [...settings.replacement.patterns];
                              newPatterns[index] = { ...item, pattern: e.target.value };
                              updateSettings('replacement', 'patterns', newPatterns);
                            }}
                          />
                          <TextInput
                            label="Replace with"
                            value={item.replacement}
                            onChange={(e) => {
                              const newPatterns = [...settings.replacement.patterns];
                              newPatterns[index] = { ...item, replacement: e.target.value };
                              updateSettings('replacement', 'patterns', newPatterns);
                            }}
                          />
                          <Button 
                            variant="subtle" 
                            color="red"
                            onClick={() => {
                              const newPatterns = settings.replacement.patterns.filter((_, i) => i !== index);
                              updateSettings('replacement', 'patterns', newPatterns);
                            }}
                          >
                            Remove
                          </Button>
                        </Stack>
                      </Card>
                    ))}

                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const newPatterns = [...settings.replacement.patterns, { pattern: '', replacement: '' }];
                        updateSettings('replacement', 'patterns', newPatterns);
                      }}
                    >
                      Add Replacement Pattern
                    </Button>
                  </>
                )}
              </Stack>
            </Card>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <Group justify="flex-end" mt="xl">
        <Button variant="outline">Reset to Defaults</Button>
        <Button onClick={handleSaveChanges}>Save Changes</Button>
      </Group>
    </>
  );
}