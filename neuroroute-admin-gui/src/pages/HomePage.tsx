import { useState, useEffect } from 'react';
import {
  Title,
  Text,
  Grid,
  Paper,
  Group,
  Badge,
  Table,
  ScrollArea,
  Card,
  RingProgress,
  Center,
  Stack,
  Divider,
  Box,
  ThemeIcon,
  Flex,
  Tooltip,
  rem,
  Container,
  Overlay,
  Button
} from '@mantine/core';
import {
  IconChartPie,
  IconChartLine,
  IconChartBar,
  IconServer,
  IconActivity,
  IconList,
  IconRefresh
} from '@tabler/icons-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

// Mock data for charts
const generateTimeData = (hours = 24, baseValue = 100, variance = 50) => {
  return Array.from({ length: hours }, (_, i) => {
    const hour = i;
    const hourLabel = `${hour}:00`;
    return {
      hour: hourLabel,
      value: Math.max(0, baseValue + Math.floor(Math.random() * variance * 2) - variance)
    };
  });
};

const generateModelData = () => {
  const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'llama-3'];
  return models.map(model => ({
    model,
    tokens: Math.floor(Math.random() * 1000000) + 100000,
    color: getModelColor(model)
  }));
};

const getModelColor = (model) => {
  const colors = {
    'gpt-4': '#4CAF50',
    'gpt-3.5-turbo': '#2196F3',
    'claude-3': '#9C27B0',
    'llama-3': '#FF9800'
  };
  return colors[model] || '#607D8B';
};

const generateLatencyData = () => {
  const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'llama-3'];
  return models.map(model => ({
    model,
    latency: Math.floor(Math.random() * 1000) + 100,
    color: getModelColor(model)
  }));
};

const generateSystemMetrics = () => {
  return {
    cpu: Math.floor(Math.random() * 100),
    memory: Math.floor(Math.random() * 100),
    disk: Math.floor(Math.random() * 100)
  };
};

// Mock data for flow architecture
const generateFlowLatencyData = () => {
  return {
    input: Math.floor(Math.random() * 20) + 5,
    preprocessor: Math.floor(Math.random() * 30) + 10,
    classifier: Math.floor(Math.random() * 50) + 20,
    router: Math.floor(Math.random() * 25) + 5,
    models: {
      'gpt-4': Math.floor(Math.random() * 500) + 200,
      'gpt-3.5-turbo': Math.floor(Math.random() * 300) + 100,
      'claude-3': Math.floor(Math.random() * 400) + 150,
      'llama-3': Math.floor(Math.random() * 350) + 120
    },
    output: Math.floor(Math.random() * 15) + 5
  };
};

// Mock data for real-time logs
const generateLogEntries = (count = 10) => {
  const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3', 'llama-3'];
  const classifiers = ['general', 'code', 'creative', 'factual'];
  const prompts = [
    'Explain quantum computing in simple terms',
    'Write a function to calculate Fibonacci numbers',
    'Create a short story about a robot learning to paint',
    'What are the main causes of climate change?',
    'How do I optimize a React application?',
    'Summarize the history of artificial intelligence',
    'Design a database schema for an e-commerce site',
    "What's the difference between REST and GraphQL?",
    'Explain the concept of neural networks',
    'How does blockchain technology work?'
  ];

  return Array.from({ length: count }, (_, i) => {
    const timestamp = new Date();
    timestamp.setMinutes(timestamp.getMinutes() - i * 5);
    
    return {
      id: `log-${i}`,
      timestamp: timestamp.toISOString(),
      prompt: prompts[Math.floor(Math.random() * prompts.length)],
      classifier: classifiers[Math.floor(Math.random() * classifiers.length)],
      model: models[Math.floor(Math.random() * models.length)],
      tokens: Math.floor(Math.random() * 1000) + 100,
      status: Math.random() > 0.1 ? 'success' : 'failure'
    };
  });
};

// Chart components
const PromptsPerHourChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={250}>
    <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="hour" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="value" name="Prompts" stroke="#8884d8" activeDot={{ r: 8 }} />
    </LineChart>
  </ResponsiveContainer>
);

const TokensPerHourChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={250}>
    <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="hour" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="value" name="Tokens" stroke="#82ca9d" activeDot={{ r: 8 }} />
    </LineChart>
  </ResponsiveContainer>
);

const TokensPerModelChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={250}>
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        labelLine={false}
        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
          const RADIAN = Math.PI / 180;
          // Calculate the position for the label
          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
          const x = cx + radius * Math.cos(-midAngle * RADIAN);
          const y = cy + radius * Math.sin(-midAngle * RADIAN);
          
          return (
            <text
              x={x}
              y={y}
              fill="white"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12"
              fontWeight="bold"
            >
              {`${(percent * 100).toFixed(0)}%`}
            </text>
          );
        }}
        outerRadius={80}
        fill="#8884d8"
        dataKey="tokens"
        nameKey="model"
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={entry.color} />
        ))}
      </Pie>
      <Tooltip formatter={(value) => `${value.toLocaleString()} tokens`} />
      <Legend />
    </PieChart>
  </ResponsiveContainer>
);

const LatencyPerModelChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={250}>
    <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="model" />
      <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
      <Tooltip />
      <Legend />
      <Bar dataKey="latency" name="Latency (ms)" fill="#8884d8">
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={entry.color} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

const SystemMetricsDisplay = ({ metrics }) => (
  <Grid gutter="xl">
    <Grid.Col span={{ base: 12, md: 4 }}>
      <Card withBorder p="lg" radius="lg" className="dashboard-card">
        <Center>
          <RingProgress
            size={180}
            thickness={16}
            roundCaps
            sections={[{
              value: metrics.cpu,
              color: metrics.cpu > 80 ? 'red' :
                     metrics.cpu > 60 ? 'orange' :
                     'var(--mantine-color-primary-5)'
            }]}
            label={
              <div>
                <Text ta="center" fw={700} size="2rem" color={
                  metrics.cpu > 80 ? 'red' :
                  metrics.cpu > 60 ? 'orange' :
                  'var(--mantine-color-primary-5)'
                }>
                  {metrics.cpu}%
                </Text>
                <Text ta="center" c="dimmed" size="xs">of 100%</Text>
              </div>
            }
          />
        </Center>
        <Group position="center" mt="md">
          <ThemeIcon size="md" radius="md" variant="light" color="primary">
            <IconServer size={16} />
          </ThemeIcon>
          <Text ta="center" fw={600} size="lg">
            CPU Usage
          </Text>
        </Group>
      </Card>
    </Grid.Col>
    
    <Grid.Col span={{ base: 12, md: 4 }}>
      <Card withBorder p="lg" radius="lg" className="dashboard-card">
        <Center>
          <RingProgress
            size={180}
            thickness={16}
            roundCaps
            sections={[{
              value: metrics.memory,
              color: metrics.memory > 80 ? 'red' :
                     metrics.memory > 60 ? 'orange' :
                     'var(--mantine-color-secondary-5)'
            }]}
            label={
              <div>
                <Text ta="center" fw={700} size="2rem" color={
                  metrics.memory > 80 ? 'red' :
                  metrics.memory > 60 ? 'orange' :
                  'var(--mantine-color-secondary-5)'
                }>
                  {metrics.memory}%
                </Text>
                <Text ta="center" c="dimmed" size="xs">of 100%</Text>
              </div>
            }
          />
        </Center>
        <Group position="center" mt="md">
          <ThemeIcon size="md" radius="md" variant="light" color="secondary">
            <IconServer size={16} />
          </ThemeIcon>
          <Text ta="center" fw={600} size="lg">
            Memory Usage
          </Text>
        </Group>
      </Card>
    </Grid.Col>
    
    <Grid.Col span={{ base: 12, md: 4 }}>
      <Card withBorder p="lg" radius="lg" className="dashboard-card">
        <Center>
          <RingProgress
            size={180}
            thickness={16}
            roundCaps
            sections={[{
              value: metrics.disk,
              color: metrics.disk > 80 ? 'red' :
                     metrics.disk > 60 ? 'orange' :
                     'var(--mantine-color-accent-5)'
            }]}
            label={
              <div>
                <Text ta="center" fw={700} size="2rem" color={
                  metrics.disk > 80 ? 'red' :
                  metrics.disk > 60 ? 'orange' :
                  'var(--mantine-color-accent-5)'
                }>
                  {metrics.disk}%
                </Text>
                <Text ta="center" c="dimmed" size="xs">of 100%</Text>
              </div>
            }
          />
        </Center>
        <Group position="center" mt="md">
          <ThemeIcon size="md" radius="md" variant="light" color="accent">
            <IconServer size={16} />
          </ThemeIcon>
          <Text ta="center" fw={600} size="lg">
            Disk Usage
          </Text>
        </Group>
      </Card>
    </Grid.Col>
  </Grid>
);

// Flow Architecture Diagram Component
const FlowArchitectureDiagram = ({ latencyData }) => {
  const boxStyle = {
    border: '2px solid var(--mantine-color-gray-3)',
    borderRadius: '10px',
    padding: '12px',
    textAlign: 'center' as const,
    position: 'relative' as const,
    minWidth: '130px',
    backgroundColor: 'white',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
    }
  };

  const arrowStyle = {
    position: 'relative' as const,
    height: '3px',
    background: 'linear-gradient(to right, var(--mantine-color-gray-3), var(--mantine-color-gray-5))',
    flex: 1,
    margin: '0 5px',
    minWidth: '30px'
  };

  const latencyBadgeStyle = {
    position: 'absolute' as const,
    top: '-12px',
    right: '-12px',
    background: 'linear-gradient(135deg, var(--mantine-color-primary-5), var(--mantine-color-primary-7))',
    color: 'white',
    borderRadius: '12px',
    padding: '3px 10px',
    fontSize: '12px',
    fontWeight: 'bold',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
  };

  const modelContainerStyle = {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '12px',
    border: '2px dashed var(--mantine-color-gray-4)',
    borderRadius: '12px',
    padding: '20px',
    backgroundColor: 'var(--mantine-color-gray-0)',
    boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.05)'
  };

  return (
    <Card withBorder p="lg" radius="lg" className="dashboard-card">
      <ScrollArea>
        <Box px="md">
          <Box mb="lg">
            <Group position="center" align="center" style={{ flexWrap: 'nowrap', overflowX: 'auto', padding: '20px 0' }}>
              {/* Input */}
              <Box style={boxStyle}>
                <ThemeIcon size="md" radius="md" color="primary" mb="xs">
                  <IconActivity size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">Input</Text>
                <div style={latencyBadgeStyle}>{latencyData.input} ms</div>
              </Box>
              
              {/* Arrow */}
              <div style={arrowStyle}>
                <div style={{ position: 'absolute', right: '-6px', top: '-6px', width: '0', height: '0', borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '6px solid var(--mantine-color-gray-5)' }}></div>
              </div>
              
              {/* Preprocessor */}
              <Box style={boxStyle}>
                <ThemeIcon size="md" radius="md" color="primary" mb="xs">
                  <IconActivity size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">Preprocessor</Text>
                <div style={latencyBadgeStyle}>{latencyData.preprocessor} ms</div>
              </Box>
              
              {/* Arrow */}
              <div style={arrowStyle}>
                <div style={{ position: 'absolute', right: '-6px', top: '-6px', width: '0', height: '0', borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '6px solid var(--mantine-color-gray-5)' }}></div>
              </div>
              
              {/* Classifier */}
              <Box style={boxStyle}>
                <ThemeIcon size="md" radius="md" color="secondary" mb="xs">
                  <IconActivity size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">Classifier</Text>
                <div style={latencyBadgeStyle}>{latencyData.classifier} ms</div>
              </Box>
              
              {/* Arrow */}
              <div style={arrowStyle}>
                <div style={{ position: 'absolute', right: '-6px', top: '-6px', width: '0', height: '0', borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '6px solid var(--mantine-color-gray-5)' }}></div>
              </div>
              
              {/* Router */}
              <Box style={boxStyle}>
                <ThemeIcon size="md" radius="md" color="secondary" mb="xs">
                  <IconActivity size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">Router</Text>
                <div style={latencyBadgeStyle}>{latencyData.router} ms</div>
              </Box>
              
              {/* Arrow */}
              <div style={arrowStyle}>
                <div style={{ position: 'absolute', right: '-6px', top: '-6px', width: '0', height: '0', borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '6px solid var(--mantine-color-gray-5)' }}></div>
              </div>
              
              {/* Models Container */}
              <Box style={modelContainerStyle}>
                <Text fw={600} ta="center" size="sm">Models</Text>
                <Group position="center" spacing="xs">
                  {Object.entries(latencyData.models).map(([model, latency]) => (
                    <Box key={model} style={{ ...boxStyle, minWidth: '110px' }}>
                      <ThemeIcon size="md" radius="md" color="accent" mb="xs">
                        <IconActivity size={16} />
                      </ThemeIcon>
                      <Text size="xs" fw={600}>{model}</Text>
                      <div style={latencyBadgeStyle}>{latency} ms</div>
                    </Box>
                  ))}
                </Group>
              </Box>
              
              {/* Arrow */}
              <div style={arrowStyle}>
                <div style={{ position: 'absolute', right: '-6px', top: '-6px', width: '0', height: '0', borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '6px solid var(--mantine-color-gray-5)' }}></div>
              </div>
              
              {/* Output */}
              <Box style={boxStyle}>
                <ThemeIcon size="md" radius="md" color="accent" mb="xs">
                  <IconActivity size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">Output</Text>
                <div style={latencyBadgeStyle}>{latencyData.output} ms</div>
              </Box>
            </Group>
          </Box>
          
          <Group position="apart">
            <Text size="sm" c="dimmed">Total pipeline latency: <Text component="span" fw={600} c="primary">{latencyData.input + latencyData.preprocessor + latencyData.classifier + latencyData.router + latencyData.output} ms</Text> (excluding model)</Text>
            <Badge size="lg" radius="md" color="primary" variant="light">Updated: {new Date().toLocaleTimeString()}</Badge>
          </Group>
        </Box>
      </ScrollArea>
    </Card>
  );
};

// Real-time log component
const RealTimeLog = ({ logs }) => (
  <Card withBorder p="lg" radius="lg">
    <Group position="apart" mb="md" px="md">
      <Text size="sm" c="dimmed">Latest activity</Text>
      <Badge size="lg" radius="md" variant="light">{logs.length} entries</Badge>
    </Group>
    
    <ScrollArea h={400} scrollbarSize={6}>
      <Table striped highlightOnHover horizontalSpacing="lg" verticalSpacing="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Time</Table.Th>
            <Table.Th>Prompt</Table.Th>
            <Table.Th>Classifier</Table.Th>
            <Table.Th>Model</Table.Th>
            <Table.Th>Tokens</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {logs.map((log) => (
            <Table.Tr key={log.id}>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </Text>
              </Table.Td>
              <Table.Td>
                <Tooltip label={log.prompt} multiline width={300}>
                  <Text lineClamp={1} size="sm" style={{ maxWidth: '300px' }}>
                    {log.prompt}
                  </Text>
                </Tooltip>
              </Table.Td>
              <Table.Td>
                <Badge
                  variant="dot"
                  color={
                    log.classifier === 'general' ? 'blue' :
                    log.classifier === 'code' ? 'green' :
                    'grape'
                  }
                >
                  {log.classifier}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {log.model}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {log.tokens.toLocaleString()}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge
                  variant="filled"
                  color={log.status === 'success' ? 'green' : 'red'}
                  radius="sm"
                >
                  {log.status}
                </Badge>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  </Card>
);

export function HomePage() {
  // State for all the data
  const [promptsData, setPromptsData] = useState(generateTimeData(24, 150, 100));
  const [tokensData, setTokensData] = useState(generateTimeData(24, 5000, 3000));
  const [modelData, setModelData] = useState(generateModelData());
  const [latencyData, setLatencyData] = useState(generateLatencyData());
  const [systemMetrics, setSystemMetrics] = useState(generateSystemMetrics());
  const [flowLatencyData, setFlowLatencyData] = useState(generateFlowLatencyData());
  const [logs, setLogs] = useState(generateLogEntries(20));

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Update with new data points
      const newPromptsData = [...promptsData];
      newPromptsData.shift();
      newPromptsData.push({
        hour: `${new Date().getHours()}:00`,
        value: Math.max(0, 150 + Math.floor(Math.random() * 200) - 100)
      });
      setPromptsData(newPromptsData);

      const newTokensData = [...tokensData];
      newTokensData.shift();
      newTokensData.push({
        hour: `${new Date().getHours()}:00`,
        value: Math.max(0, 5000 + Math.floor(Math.random() * 6000) - 3000)
      });
      setTokensData(newTokensData);

      // Update system metrics
      setSystemMetrics(generateSystemMetrics());
      
      // Update flow latency data
      setFlowLatencyData(generateFlowLatencyData());

      // Add a new log entry
      const newLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        prompt: ["How does quantum computing work?", "Write a React component", "Explain neural networks"][Math.floor(Math.random() * 3)],
        classifier: ["general", "code", "creative"][Math.floor(Math.random() * 3)],
        model: ["gpt-4", "gpt-3.5-turbo", "claude-3"][Math.floor(Math.random() * 3)],
        tokens: Math.floor(Math.random() * 1000) + 100,
        status: Math.random() > 0.1 ? "success" : "failure"
      };
      
      setLogs(prevLogs => [newLog, ...prevLogs.slice(0, 19)]);
    }, 5000);

    return () => clearInterval(interval);
  }, [promptsData, tokensData, logs]);

  return (
    <Container fluid px="lg" py="md">
      {/* Header with gradient background */}
      <Paper
        mb="xl"
        p="xl"
        radius="md"
        sx={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.8), rgba(33, 150, 243, 0.6))',
          color: 'white',
        }}
      >
        <Flex justify="space-between" align="center">
          <Box>
            <Title order={2} mb="xs">Neuroroute Dashboard</Title>
            <Text size="lg">Real-time monitoring of Neuroroute API performance and usage.</Text>
          </Box>
          <Tooltip label="Refresh data">
            <Button
              variant="white"
              radius="xl"
              leftSection={<IconRefresh size={16} />}
              onClick={() => {
                setModelData(generateModelData());
                setTokensData(generateTimeData(24, 5000, 3000));
                setPromptsData(generateTimeData(24, 150, 100));
                setSystemMetrics(generateSystemMetrics());
                setFlowLatencyData(generateFlowLatencyData());
              }}
            >
              Refresh
            </Button>
          </Tooltip>
        </Flex>
      </Paper>
      
      {/* First row: Tokens per Model, Tokens per Hour, Prompts per Hour */}
      <Grid gutter="xl" mb="xl">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p="lg" radius="lg" className="dashboard-card">
            <Group mb="md" position="apart">
              <Group>
                <ThemeIcon size="lg" radius="md" variant="light" color="primary">
                  <IconChartPie size={20} />
                </ThemeIcon>
                <Title order={4}>Tokens per Model</Title>
              </Group>
              <Badge size="lg" radius="md" color="primary">Live</Badge>
            </Group>
            <TokensPerModelChart data={modelData} />
          </Paper>
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p="lg" radius="lg" className="dashboard-card">
            <Group mb="md" position="apart">
              <Group>
                <ThemeIcon size="lg" radius="md" variant="light" color="secondary">
                  <IconChartLine size={20} />
                </ThemeIcon>
                <Title order={4}>Tokens per Hour</Title>
              </Group>
              <Badge size="lg" radius="md" color="secondary">Live</Badge>
            </Group>
            <TokensPerHourChart data={tokensData} />
          </Paper>
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p="lg" radius="lg" className="dashboard-card">
            <Group mb="md" position="apart">
              <Group>
                <ThemeIcon size="lg" radius="md" variant="light" color="accent">
                  <IconChartBar size={20} />
                </ThemeIcon>
                <Title order={4}>Prompts per Hour</Title>
              </Group>
              <Badge size="lg" radius="md" color="accent">Live</Badge>
            </Group>
            <PromptsPerHourChart data={promptsData} />
          </Paper>
        </Grid.Col>
      </Grid>
      
      {/* Second row: System Resources (spread across the screen) */}
      <Paper withBorder p="lg" radius="lg" mb="xl" className="dashboard-card">
        <Group mb="md" position="apart">
          <Group>
            <ThemeIcon size="lg" radius="md" variant="light" color="primary">
              <IconServer size={20} />
            </ThemeIcon>
            <Title order={4}>System Resources</Title>
          </Group>
          <Badge size="lg" radius="md" color="primary">Live</Badge>
        </Group>
        <SystemMetricsDisplay metrics={systemMetrics} />
      </Paper>
      
      {/* Third row: Flow Architecture Diagram (spread across the screen) */}
      <Paper withBorder p="lg" radius="lg" mb="xl" className="dashboard-card">
        <Group mb="md" position="apart">
          <Group>
            <ThemeIcon size="lg" radius="md" variant="light" color="secondary">
              <IconActivity size={20} />
            </ThemeIcon>
            <Title order={4}>Flow Architecture</Title>
          </Group>
          <Badge size="lg" radius="md" color="secondary">Live</Badge>
        </Group>
        <FlowArchitectureDiagram latencyData={flowLatencyData} />
      </Paper>
      
      {/* Fourth row: Prompts Log (spread across the screen) */}
      <Paper withBorder p="lg" radius="lg" mb="xl" className="dashboard-card">
        <Group mb="md" position="apart">
          <Group>
            <ThemeIcon size="lg" radius="md" variant="light" color="accent">
              <IconList size={20} />
            </ThemeIcon>
            <Title order={4}>Real-time Prompt Log</Title>
          </Group>
          <Badge size="lg" radius="md" color="accent">Live</Badge>
        </Group>
        <RealTimeLog logs={logs} />
      </Paper>
    </Container>
  );
}