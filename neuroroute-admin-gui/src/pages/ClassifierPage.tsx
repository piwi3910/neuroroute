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
  Tabs
} from '@mantine/core';
import { 
  IconCategory, 
  IconPlus, 
  IconTrash, 
  IconEdit,
  IconBrain,
  IconList,
  IconCode
} from '@tabler/icons-react';

// Mock classifier settings
const initialSettings = {
  activeClassifier: 'rules-based',
  rulesBasedClassifier: {
    enabled: true,
    rules: [
      { category: 'code', keywords: ['function', 'class', 'variable', 'code', 'programming', 'algorithm', 'debug'], priority: 1 },
      { category: 'creative', keywords: ['story', 'poem', 'creative', 'imagine', 'fiction', 'narrative', 'write'], priority: 2 },
      { category: 'factual', keywords: ['explain', 'what is', 'how does', 'facts', 'history', 'science', 'define'], priority: 3 },
      { category: 'general', keywords: [], priority: 10 } // Fallback category
    ],
    caseSensitive: false,
    matchThreshold: 2 // Number of keywords needed to match
  },
  mlBasedClassifier: {
    enabled: false,
    model: 'distilbert-base-uncased',
    confidenceThreshold: 0.7,
    categories: ['code', 'creative', 'factual', 'general'],
    batchSize: 16,
    maxLength: 512
  },
  llmBasedClassifier: {
    enabled: false,
    model: 'gpt-3.5-turbo',
    systemPrompt: 'You are a classifier that categorizes user queries into one of the following categories: code, creative, factual, or general. Respond with only the category name.',
    categories: ['code', 'creative', 'factual', 'general'],
    temperature: 0.3,
    maxTokens: 10
  }
};

// ML model options
const mlModels = [
  { value: 'distilbert-base-uncased', label: 'DistilBERT (Base Uncased)' },
  { value: 'bert-base-uncased', label: 'BERT (Base Uncased)' },
  { value: 'roberta-base', label: 'RoBERTa (Base)' },
  { value: 'custom-classifier', label: 'Custom Trained Classifier' }
];

// LLM model options
const llmModels = [
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' }
];

export function ClassifierPage() {
  const [settings, setSettings] = useState(initialSettings);
  const [editingRule, setEditingRule] = useState<number | null>(null);
  const [newRule, setNewRule] = useState({ category: '', keywords: '', priority: 1 });

  const updateSettings = (classifier: string, field: string, value: any) => {
    setSettings({
      ...settings,
      [classifier]: {
        ...settings[classifier as keyof typeof settings],
        [field]: value
      }
    });
  };

  const handleActiveClassifierChange = (value: string) => {
    setSettings({
      ...settings,
      activeClassifier: value
    });
  };

  const handleAddRule = () => {
    if (newRule.category && newRule.keywords) {
      const keywordsArray = newRule.keywords.split(',').map(k => k.trim());
      const updatedRules = [
        ...settings.rulesBasedClassifier.rules,
        { 
          category: newRule.category, 
          keywords: keywordsArray, 
          priority: newRule.priority 
        }
      ];
      
      updateSettings('rulesBasedClassifier', 'rules', updatedRules);
      setNewRule({ category: '', keywords: '', priority: 1 });
    }
  };

  const handleDeleteRule = (index: number) => {
    const updatedRules = settings.rulesBasedClassifier.rules.filter((_, i) => i !== index);
    updateSettings('rulesBasedClassifier', 'rules', updatedRules);
  };

  const handleEditRule = (index: number) => {
    const rule = settings.rulesBasedClassifier.rules[index];
    setEditingRule(index);
    setNewRule({
      category: rule.category,
      keywords: rule.keywords.join(', '),
      priority: rule.priority
    });
  };

  const handleSaveEdit = () => {
    if (editingRule !== null) {
      const keywordsArray = newRule.keywords.split(',').map(k => k.trim());
      const updatedRules = [...settings.rulesBasedClassifier.rules];
      updatedRules[editingRule] = {
        category: newRule.category,
        keywords: keywordsArray,
        priority: newRule.priority
      };
      
      updateSettings('rulesBasedClassifier', 'rules', updatedRules);
      setEditingRule(null);
      setNewRule({ category: '', keywords: '', priority: 1 });
    }
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
    setNewRule({ category: '', keywords: '', priority: 1 });
  };

  const handleSaveChanges = () => {
    // In a real app, this would send the updated settings to the API
    console.log('Saving classifier settings:', settings);
    // Show success notification or feedback
  };

  return (
    <>
      <Title order={2} mb="md">Classifier Settings</Title>
      <Text mb="lg">Configure how incoming prompts are classified to determine the appropriate model.</Text>

      <Card withBorder p="md" mb="xl">
        <Title order={4} mb="md">Active Classifier</Title>
        <Radio.Group
          value={settings.activeClassifier}
          onChange={handleActiveClassifierChange}
          name="activeClassifier"
        >
          <Group mt="xs">
            <Radio value="rules-based" label="Rules-based Classifier" />
            <Radio value="ml-based" label="ML-based Classifier" />
            <Radio value="llm-based" label="LLM-based Classifier" />
          </Group>
        </Radio.Group>
      </Card>

      <Tabs defaultValue={settings.activeClassifier}>
        <Tabs.List mb="md">
          <Tabs.Tab value="rules-based" leftSection={<IconList size={16} />}>
            Rules-based
          </Tabs.Tab>
          <Tabs.Tab value="ml-based" leftSection={<IconBrain size={16} />}>
            ML-based
          </Tabs.Tab>
          <Tabs.Tab value="llm-based" leftSection={<IconCode size={16} />}>
            LLM-based
          </Tabs.Tab>
        </Tabs.List>

        {/* Rules-based Classifier */}
        <Tabs.Panel value="rules-based">
          <Card withBorder p="md" mb="xl">
            <Stack>
              <Group position="apart">
                <div>
                  <Title order={4}>Rules-based Classifier</Title>
                  <Text size="sm" c="dimmed">Classify prompts based on keyword matching</Text>
                </div>
                <Switch
                  label="Enabled"
                  checked={settings.rulesBasedClassifier.enabled}
                  onChange={(e) => updateSettings('rulesBasedClassifier', 'enabled', e.currentTarget.checked)}
                />
              </Group>

              <Divider my="sm" />

              <Group align="flex-start">
                <Switch
                  label="Case Sensitive Matching"
                  checked={settings.rulesBasedClassifier.caseSensitive}
                  onChange={(e) => updateSettings('rulesBasedClassifier', 'caseSensitive', e.currentTarget.checked)}
                />
              </Group>

              <NumberInput
                label="Match Threshold"
                description="Minimum number of keywords needed to match a category"
                value={settings.rulesBasedClassifier.matchThreshold}
                onChange={(value) => updateSettings('rulesBasedClassifier', 'matchThreshold', Number(value))}
                min={1}
                max={10}
              />

              <Divider my="sm" />

              <Title order={5}>Classification Rules</Title>
              <Text size="sm" c="dimmed" mb="md">
                Define categories and their associated keywords for classification
              </Text>

              <Paper withBorder p="md">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Keywords</Table.Th>
                      <Table.Th>Priority</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {settings.rulesBasedClassifier.rules.map((rule, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>{rule.category}</Table.Td>
                        <Table.Td>
                          <Text size="sm" lineClamp={2}>
                            {rule.keywords.join(', ')}
                          </Text>
                        </Table.Td>
                        <Table.Td>{rule.priority}</Table.Td>
                        <Table.Td>
                          <Group spacing={5}>
                            <Tooltip label="Edit Rule">
                              <ActionIcon 
                                variant="subtle" 
                                color="blue"
                                onClick={() => handleEditRule(index)}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Delete Rule">
                              <ActionIcon 
                                variant="subtle" 
                                color="red"
                                onClick={() => handleDeleteRule(index)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>

              <Card withBorder p="md" mt="md">
                <Title order={5} mb="md">
                  {editingRule !== null ? 'Edit Rule' : 'Add New Rule'}
                </Title>
                <Stack>
                  <TextInput
                    label="Category"
                    description="Name of the category (e.g., code, creative, factual)"
                    value={newRule.category}
                    onChange={(e) => setNewRule({...newRule, category: e.target.value})}
                    required
                  />
                  
                  <Textarea
                    label="Keywords"
                    description="Comma-separated list of keywords that trigger this category"
                    value={newRule.keywords}
                    onChange={(e) => setNewRule({...newRule, keywords: e.target.value})}
                    minRows={3}
                    required
                  />
                  
                  <NumberInput
                    label="Priority"
                    description="Lower numbers have higher priority when multiple categories match"
                    value={newRule.priority}
                    onChange={(value) => setNewRule({...newRule, priority: Number(value)})}
                    min={1}
                    max={10}
                  />
                  
                  <Group position="right" mt="md">
                    {editingRule !== null ? (
                      <>
                        <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                        <Button onClick={handleSaveEdit}>Save Changes</Button>
                      </>
                    ) : (
                      <Button 
                        leftSection={<IconPlus size={16} />}
                        onClick={handleAddRule}
                        disabled={!newRule.category || !newRule.keywords}
                      >
                        Add Rule
                      </Button>
                    )}
                  </Group>
                </Stack>
              </Card>
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* ML-based Classifier */}
        <Tabs.Panel value="ml-based">
          <Card withBorder p="md" mb="xl">
            <Stack>
              <Group position="apart">
                <div>
                  <Title order={4}>ML-based Classifier</Title>
                  <Text size="sm" c="dimmed">Classify prompts using machine learning models</Text>
                </div>
                <Switch
                  label="Enabled"
                  checked={settings.mlBasedClassifier.enabled}
                  onChange={(e) => updateSettings('mlBasedClassifier', 'enabled', e.currentTarget.checked)}
                />
              </Group>

              <Divider my="sm" />

              <Select
                label="Classification Model"
                description="Machine learning model used for classification"
                data={mlModels}
                value={settings.mlBasedClassifier.model}
                onChange={(value) => updateSettings('mlBasedClassifier', 'model', value || 'distilbert-base-uncased')}
              />

              <NumberInput
                label="Confidence Threshold"
                description="Minimum confidence score required for classification (0.0 - 1.0)"
                value={settings.mlBasedClassifier.confidenceThreshold}
                onChange={(value) => updateSettings('mlBasedClassifier', 'confidenceThreshold', Number(value))}
                min={0}
                max={1}
                step={0.05}
                precision={2}
              />

              <Textarea
                label="Categories"
                description="Comma-separated list of categories the model can classify into"
                value={settings.mlBasedClassifier.categories.join(', ')}
                onChange={(e) => {
                  const categories = e.target.value.split(',').map(c => c.trim());
                  updateSettings('mlBasedClassifier', 'categories', categories);
                }}
              />

              <Divider my="sm" />

              <Title order={5}>Advanced Settings</Title>

              <NumberInput
                label="Batch Size"
                description="Number of prompts to process in a single batch"
                value={settings.mlBasedClassifier.batchSize}
                onChange={(value) => updateSettings('mlBasedClassifier', 'batchSize', Number(value))}
                min={1}
                max={64}
              />

              <NumberInput
                label="Max Length"
                description="Maximum token length for input prompts"
                value={settings.mlBasedClassifier.maxLength}
                onChange={(value) => updateSettings('mlBasedClassifier', 'maxLength', Number(value))}
                min={64}
                max={2048}
                step={64}
              />
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* LLM-based Classifier */}
        <Tabs.Panel value="llm-based">
          <Card withBorder p="md" mb="xl">
            <Stack>
              <Group position="apart">
                <div>
                  <Title order={4}>LLM-based Classifier</Title>
                  <Text size="sm" c="dimmed">Classify prompts using a language model</Text>
                </div>
                <Switch
                  label="Enabled"
                  checked={settings.llmBasedClassifier.enabled}
                  onChange={(e) => updateSettings('llmBasedClassifier', 'enabled', e.currentTarget.checked)}
                />
              </Group>

              <Divider my="sm" />

              <Select
                label="Classification Model"
                description="Language model used for classification"
                data={llmModels}
                value={settings.llmBasedClassifier.model}
                onChange={(value) => updateSettings('llmBasedClassifier', 'model', value || 'gpt-3.5-turbo')}
              />

              <Textarea
                label="System Prompt"
                description="Instructions for the LLM on how to classify prompts"
                value={settings.llmBasedClassifier.systemPrompt}
                onChange={(e) => updateSettings('llmBasedClassifier', 'systemPrompt', e.target.value)}
                minRows={3}
              />

              <Textarea
                label="Categories"
                description="Comma-separated list of categories the model can classify into"
                value={settings.llmBasedClassifier.categories.join(', ')}
                onChange={(e) => {
                  const categories = e.target.value.split(',').map(c => c.trim());
                  updateSettings('llmBasedClassifier', 'categories', categories);
                }}
              />

              <Divider my="sm" />

              <Title order={5}>Advanced Settings</Title>

              <NumberInput
                label="Temperature"
                description="Controls randomness in the model's output (0.0 - 1.0)"
                value={settings.llmBasedClassifier.temperature}
                onChange={(value) => updateSettings('llmBasedClassifier', 'temperature', Number(value))}
                min={0}
                max={1}
                step={0.1}
                precision={1}
              />

              <NumberInput
                label="Max Tokens"
                description="Maximum number of tokens in the model's response"
                value={settings.llmBasedClassifier.maxTokens}
                onChange={(value) => updateSettings('llmBasedClassifier', 'maxTokens', Number(value))}
                min={1}
                max={100}
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