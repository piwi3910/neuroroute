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
  Radio,
  Accordion,
  Badge,
  ThemeIcon,
  Textarea,
  Select,
  Table,
  ActionIcon,
  Tooltip,
  NumberInput,
  Tabs,
  Slider,
  MultiSelect,
  Checkbox
} from '@mantine/core';
import { 
  IconRoute, 
  IconClock, 
  IconCoin, 
  IconServer,
  IconArrowsShuffle,
  IconBrain,
  IconInfoCircle
} from '@tabler/icons-react';

// Mock routing settings
const initialSettings = {
  strategy: 'lowest-latency',
  lowestLatency: {
    enabled: true,
    maxLatencyMs: 5000,
    fallbackStrategy: 'lowest-cost',
    excludedModels: ['local-model-1'],
    considerHistoricalPerformance: true,
    performanceWindowHours: 24
  },
  lowestCost: {
    enabled: true,
    maxCostPer1kTokens: 0.05,
    fallbackStrategy: 'best-model',
    excludedModels: [],
    prioritizeFreeModels: true
  },
  bestModel: {
    enabled: true,
    modelRankings: [
      { model: 'gpt-4', score: 10 },
      { model: 'claude-3-opus', score: 9 },
      { model: 'claude-3-sonnet', score: 8 },
      { model: 'gpt-3.5-turbo', score: 7 },
      { model: 'local-model-1', score: 5 }
    ],
    fallbackStrategy: 'lowest-latency',
    contextSizeAware: true
  },
  redundancy: {
    enabled: false,
    primaryModel: 'gpt-4',
    backupModels: ['claude-3-sonnet', 'gpt-3.5-turbo'],
    failoverThresholdMs: 3000,
    compareResponses: false,
    votingEnabled: false
  },
  categoryBased: {
    enabled: true,
    mappings: [
      { category: 'code', model: 'gpt-4' },
      { category: 'creative', model: 'claude-3-opus' },
      { category: 'factual', model: 'gpt-4' },
      { category: 'general', model: 'gpt-3.5-turbo' }
    ],
    fallbackStrategy: 'lowest-cost'
  }
};

// Mock models for dropdowns
const availableModels = [
  { value: 'gpt-4', label: 'GPT-4 (OpenAI)' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (OpenAI)' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus (Anthropic)' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet (Anthropic)' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku (Anthropic)' },
  { value: 'local-model-1', label: 'Local Model 1 (LM Studio)' }
];

// Mock categories for dropdowns
const availableCategories = [
  { value: 'code', label: 'Code & Programming' },
  { value: 'creative', label: 'Creative Writing' },
  { value: 'factual', label: 'Factual Information' },
  { value: 'general', label: 'General Purpose' }
];

// Fallback strategies
const fallbackStrategies = [
  { value: 'lowest-latency', label: 'Lowest Latency' },
  { value: 'lowest-cost', label: 'Lowest Cost' },
  { value: 'best-model', label: 'Best Model Available' },
  { value: 'none', label: 'No Fallback (Fail Request)' }
];

export function RoutingPage() {
  const [settings, setSettings] = useState(initialSettings);
  const [editingMapping, setEditingMapping] = useState<number | null>(null);
  const [newMapping, setNewMapping] = useState({ category: '', model: '' });

  const updateSettings = (strategy: string, field: string, value: any) => {
    setSettings({
      ...settings,
      [strategy]: {
        ...settings[strategy as keyof typeof settings],
        [field]: value
      }
    });
  };

  const handleStrategyChange = (value: string) => {
    setSettings({
      ...settings,
      strategy: value
    });
  };

  const handleAddMapping = () => {
    if (newMapping.category && newMapping.model) {
      const updatedMappings = [
        ...settings.categoryBased.mappings,
        { category: newMapping.category, model: newMapping.model }
      ];
      
      updateSettings('categoryBased', 'mappings', updatedMappings);
      setNewMapping({ category: '', model: '' });
    }
  };

  const handleDeleteMapping = (index: number) => {
    const updatedMappings = settings.categoryBased.mappings.filter((_, i) => i !== index);
    updateSettings('categoryBased', 'mappings', updatedMappings);
  };

  const handleEditMapping = (index: number) => {
    const mapping = settings.categoryBased.mappings[index];
    setEditingMapping(index);
    setNewMapping({
      category: mapping.category,
      model: mapping.model
    });
  };

  const handleSaveEdit = () => {
    if (editingMapping !== null) {
      const updatedMappings = [...settings.categoryBased.mappings];
      updatedMappings[editingMapping] = {
        category: newMapping.category,
        model: newMapping.model
      };
      
      updateSettings('categoryBased', 'mappings', updatedMappings);
      setEditingMapping(null);
      setNewMapping({ category: '', model: '' });
    }
  };

  const handleCancelEdit = () => {
    setEditingMapping(null);
    setNewMapping({ category: '', model: '' });
  };

  const handleSaveChanges = () => {
    // In a real app, this would send the updated settings to the API
    console.log('Saving routing settings:', settings);
    // Show success notification or feedback
  };

  return (
    <>
      <Title order={2} mb="md">Routing Settings</Title>
      <Text mb="lg">Configure how prompts are routed to different LLM models based on various strategies.</Text>

      <Card withBorder p="md" mb="xl">
        <Title order={4} mb="md">Active Routing Strategy</Title>
        <Radio.Group
          value={settings.strategy}
          onChange={handleStrategyChange}
          name="routingStrategy"
        >
          <Stack spacing="xs">
            <Radio 
              value="lowest-latency" 
              label={
                <Group>
                  <Text>Lowest Latency</Text>
                  <Badge color="blue">Performance</Badge>
                </Group>
              }
            />
            <Radio 
              value="lowest-cost" 
              label={
                <Group>
                  <Text>Lowest Cost</Text>
                  <Badge color="green">Economy</Badge>
                </Group>
              }
            />
            <Radio 
              value="best-model" 
              label={
                <Group>
                  <Text>Best Model Available</Text>
                  <Badge color="violet">Quality</Badge>
                </Group>
              }
            />
            <Radio 
              value="redundancy" 
              label={
                <Group>
                  <Text>Redundancy</Text>
                  <Badge color="orange">Reliability</Badge>
                </Group>
              }
            />
            <Radio 
              value="category-based" 
              label={
                <Group>
                  <Text>Category-Based</Text>
                  <Badge color="grape">Specialized</Badge>
                </Group>
              }
            />
          </Stack>
        </Radio.Group>
      </Card>

      <Tabs defaultValue={settings.strategy}>
        <Tabs.List mb="md">
          <Tabs.Tab 
            value="lowest-latency" 
            leftSection={<IconClock size={16} />}
          >
            Lowest Latency
          </Tabs.Tab>
          <Tabs.Tab 
            value="lowest-cost" 
            leftSection={<IconCoin size={16} />}
          >
            Lowest Cost
          </Tabs.Tab>
          <Tabs.Tab 
            value="best-model" 
            leftSection={<IconBrain size={16} />}
          >
            Best Model
          </Tabs.Tab>
          <Tabs.Tab 
            value="redundancy" 
            leftSection={<IconArrowsShuffle size={16} />}
          >
            Redundancy
          </Tabs.Tab>
          <Tabs.Tab 
            value="category-based" 
            leftSection={<IconRoute size={16} />}
          >
            Category-Based
          </Tabs.Tab>
        </Tabs.List>

        {/* Lowest Latency Strategy */}
        <Tabs.Panel value="lowest-latency">
          <Card withBorder p="md" mb="xl">
            <Stack>
              <Group position="apart">
                <div>
                  <Title order={4}>Lowest Latency Strategy</Title>
                  <Text size="sm" c="dimmed">Route to the model with the lowest response time</Text>
                </div>
                <Switch
                  label="Enabled"
                  checked={settings.lowestLatency.enabled}
                  onChange={(e) => updateSettings('lowestLatency', 'enabled', e.currentTarget.checked)}
                />
              </Group>

              <Divider my="sm" />

              <NumberInput
                label="Maximum Acceptable Latency (ms)"
                description="Maximum response time before falling back to another strategy"
                value={settings.lowestLatency.maxLatencyMs}
                onChange={(value) => updateSettings('lowestLatency', 'maxLatencyMs', Number(value))}
                min={100}
                max={30000}
                step={100}
              />

              <Select
                label="Fallback Strategy"
                description="Strategy to use if no model meets the latency requirement"
                data={fallbackStrategies}
                value={settings.lowestLatency.fallbackStrategy}
                onChange={(value) => updateSettings('lowestLatency', 'fallbackStrategy', value || 'lowest-cost')}
              />

              <MultiSelect
                label="Excluded Models"
                description="Models to exclude from latency-based routing"
                data={availableModels}
                value={settings.lowestLatency.excludedModels}
                onChange={(value) => updateSettings('lowestLatency', 'excludedModels', value)}
              />

              <Divider my="sm" />

              <Title order={5}>Advanced Settings</Title>

              <Switch
                label="Consider Historical Performance"
                description="Use historical latency data instead of just the most recent measurements"
                checked={settings.lowestLatency.considerHistoricalPerformance}
                onChange={(e) => updateSettings('lowestLatency', 'considerHistoricalPerformance', e.currentTarget.checked)}
              />

              {settings.lowestLatency.considerHistoricalPerformance && (
                <NumberInput
                  label="Performance Window (hours)"
                  description="Time window for considering historical performance data"
                  value={settings.lowestLatency.performanceWindowHours}
                  onChange={(value) => updateSettings('lowestLatency', 'performanceWindowHours', Number(value))}
                  min={1}
                  max={168} // 1 week
                />
              )}
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Lowest Cost Strategy */}
        <Tabs.Panel value="lowest-cost">
          <Card withBorder p="md" mb="xl">
            <Stack>
              <Group position="apart">
                <div>
                  <Title order={4}>Lowest Cost Strategy</Title>
                  <Text size="sm" c="dimmed">Route to the most cost-effective model</Text>
                </div>
                <Switch
                  label="Enabled"
                  checked={settings.lowestCost.enabled}
                  onChange={(e) => updateSettings('lowestCost', 'enabled', e.currentTarget.checked)}
                />
              </Group>

              <Divider my="sm" />

              <NumberInput
                label="Maximum Cost per 1K Tokens ($)"
                description="Maximum cost before falling back to another strategy"
                value={settings.lowestCost.maxCostPer1kTokens}
                onChange={(value) => updateSettings('lowestCost', 'maxCostPer1kTokens', Number(value))}
                min={0}
                max={1}
                step={0.001}
                precision={3}
              />

              <Select
                label="Fallback Strategy"
                description="Strategy to use if no model meets the cost requirement"
                data={fallbackStrategies}
                value={settings.lowestCost.fallbackStrategy}
                onChange={(value) => updateSettings('lowestCost', 'fallbackStrategy', value || 'best-model')}
              />

              <MultiSelect
                label="Excluded Models"
                description="Models to exclude from cost-based routing"
                data={availableModels}
                value={settings.lowestCost.excludedModels}
                onChange={(value) => updateSettings('lowestCost', 'excludedModels', value)}
              />

              <Divider my="sm" />

              <Title order={5}>Advanced Settings</Title>

              <Switch
                label="Prioritize Free Models"
                description="Always use free models when available, regardless of other factors"
                checked={settings.lowestCost.prioritizeFreeModels}
                onChange={(e) => updateSettings('lowestCost', 'prioritizeFreeModels', e.currentTarget.checked)}
              />
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Best Model Strategy */}
        <Tabs.Panel value="best-model">
          <Card withBorder p="md" mb="xl">
            <Stack>
              <Group position="apart">
                <div>
                  <Title order={4}>Best Model Strategy</Title>
                  <Text size="sm" c="dimmed">Route to the highest quality model available</Text>
                </div>
                <Switch
                  label="Enabled"
                  checked={settings.bestModel.enabled}
                  onChange={(e) => updateSettings('bestModel', 'enabled', e.currentTarget.checked)}
                />
              </Group>

              <Divider my="sm" />

              <Title order={5}>Model Rankings</Title>
              <Text size="sm" c="dimmed" mb="md">
                Rank models by quality score (higher is better)
              </Text>

              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Model</Table.Th>
                    <Table.Th>Quality Score (1-10)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {settings.bestModel.modelRankings.map((ranking, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>
                        {availableModels.find(m => m.value === ranking.model)?.label || ranking.model}
                      </Table.Td>
                      <Table.Td>
                        <Slider
                          value={ranking.score}
                          onChange={(value) => {
                            const updatedRankings = [...settings.bestModel.modelRankings];
                            updatedRankings[index] = { ...ranking, score: value };
                            updateSettings('bestModel', 'modelRankings', updatedRankings);
                          }}
                          min={1}
                          max={10}
                          step={1}
                          marks={[
                            { value: 1, label: '1' },
                            { value: 5, label: '5' },
                            { value: 10, label: '10' }
                          ]}
                          styles={{ root: { width: '200px' } }}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Select
                label="Fallback Strategy"
                description="Strategy to use if the best models are unavailable"
                data={fallbackStrategies}
                value={settings.bestModel.fallbackStrategy}
                onChange={(value) => updateSettings('bestModel', 'fallbackStrategy', value || 'lowest-latency')}
              />

              <Divider my="sm" />

              <Title order={5}>Advanced Settings</Title>

              <Switch
                label="Context Size Aware"
                description="Automatically select models based on prompt size and context window"
                checked={settings.bestModel.contextSizeAware}
                onChange={(e) => updateSettings('bestModel', 'contextSizeAware', e.currentTarget.checked)}
              />
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Redundancy Strategy */}
        <Tabs.Panel value="redundancy">
          <Card withBorder p="md" mb="xl">
            <Stack>
              <Group position="apart">
                <div>
                  <Title order={4}>Redundancy Strategy</Title>
                  <Text size="sm" c="dimmed">Use multiple models for reliability and failover</Text>
                </div>
                <Switch
                  label="Enabled"
                  checked={settings.redundancy.enabled}
                  onChange={(e) => updateSettings('redundancy', 'enabled', e.currentTarget.checked)}
                />
              </Group>

              <Divider my="sm" />

              <Select
                label="Primary Model"
                description="Main model to use for all requests"
                data={availableModels}
                value={settings.redundancy.primaryModel}
                onChange={(value) => updateSettings('redundancy', 'primaryModel', value || 'gpt-4')}
              />

              <MultiSelect
                label="Backup Models"
                description="Models to use if the primary model fails or times out"
                data={availableModels}
                value={settings.redundancy.backupModels}
                onChange={(value) => updateSettings('redundancy', 'backupModels', value)}
              />

              <NumberInput
                label="Failover Threshold (ms)"
                description="Time to wait for primary model before trying backup models"
                value={settings.redundancy.failoverThresholdMs}
                onChange={(value) => updateSettings('redundancy', 'failoverThresholdMs', Number(value))}
                min={100}
                max={30000}
                step={100}
              />

              <Divider my="sm" />

              <Title order={5}>Advanced Settings</Title>

              <Switch
                label="Compare Responses"
                description="Run multiple models in parallel and compare their responses"
                checked={settings.redundancy.compareResponses}
                onChange={(e) => updateSettings('redundancy', 'compareResponses', e.currentTarget.checked)}
              />

              <Switch
                label="Enable Voting"
                description="Use majority voting when multiple models provide different answers"
                checked={settings.redundancy.votingEnabled}
                onChange={(e) => updateSettings('redundancy', 'votingEnabled', e.currentTarget.checked)}
              />
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Category-Based Strategy */}
        <Tabs.Panel value="category-based">
          <Card withBorder p="md" mb="xl">
            <Stack>
              <Group position="apart">
                <div>
                  <Title order={4}>Category-Based Strategy</Title>
                  <Text size="sm" c="dimmed">Route to different models based on prompt category</Text>
                </div>
                <Switch
                  label="Enabled"
                  checked={settings.categoryBased.enabled}
                  onChange={(e) => updateSettings('categoryBased', 'enabled', e.currentTarget.checked)}
                />
              </Group>

              <Divider my="sm" />

              <Title order={5}>Category to Model Mappings</Title>
              <Text size="sm" c="dimmed" mb="md">
                Define which model to use for each prompt category
              </Text>

              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Category</Table.Th>
                    <Table.Th>Model</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {settings.categoryBased.mappings.map((mapping, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>
                        {availableCategories.find(c => c.value === mapping.category)?.label || mapping.category}
                      </Table.Td>
                      <Table.Td>
                        {availableModels.find(m => m.value === mapping.model)?.label || mapping.model}
                      </Table.Td>
                      <Table.Td>
                        <Group spacing={5}>
                          <Tooltip label="Edit Mapping">
                            <ActionIcon 
                              variant="subtle" 
                              color="blue"
                              onClick={() => handleEditMapping(index)}
                            >
                              <IconRoute size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete Mapping">
                            <ActionIcon 
                              variant="subtle" 
                              color="red"
                              onClick={() => handleDeleteMapping(index)}
                            >
                              <IconRoute size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Card withBorder p="md" mt="md">
                <Title order={5} mb="md">
                  {editingMapping !== null ? 'Edit Mapping' : 'Add New Mapping'}
                </Title>
                <Stack>
                  <Select
                    label="Category"
                    description="Prompt category to route"
                    data={availableCategories}
                    value={newMapping.category}
                    onChange={(value) => setNewMapping({...newMapping, category: value || ''})}
                    required
                  />
                  
                  <Select
                    label="Model"
                    description="Model to use for this category"
                    data={availableModels}
                    value={newMapping.model}
                    onChange={(value) => setNewMapping({...newMapping, model: value || ''})}
                    required
                  />
                  
                  <Group position="right" mt="md">
                    {editingMapping !== null ? (
                      <>
                        <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                        <Button onClick={handleSaveEdit}>Save Changes</Button>
                      </>
                    ) : (
                      <Button 
                        onClick={handleAddMapping}
                        disabled={!newMapping.category || !newMapping.model}
                      >
                        Add Mapping
                      </Button>
                    )}
                  </Group>
                </Stack>
              </Card>

              <Select
                label="Fallback Strategy"
                description="Strategy to use if no category mapping matches"
                data={fallbackStrategies}
                value={settings.categoryBased.fallbackStrategy}
                onChange={(value) => updateSettings('categoryBased', 'fallbackStrategy', value || 'lowest-cost')}
              />
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>

      <Group justify="flex-end" mt="xl">
        <Button variant="outline">Reset to Defaults</Button>
        <Button onClick={handleSaveChanges}>Save Changes</Button>
      </Group>
    </>
  );
}