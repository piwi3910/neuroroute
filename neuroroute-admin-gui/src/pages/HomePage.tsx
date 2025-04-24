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
  Box
} from '@mantine/core';
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
        label={({ model, percent }) => `${model} ${(percent * 100).toFixed(0)}%`}
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
  <Group grow>
    <Card withBorder p="md">
      <Center>
        <RingProgress
          sections={[{ value: metrics.cpu, color: metrics.cpu > 80 ? 'red' : metrics.cpu > 60 ? 'orange' : 'teal' }]}
          label={
            <Text ta="center" fw={700} size="xl">
              {metrics.cpu}%
            </Text>
          }
        />
      </Center>
      <Text ta="center" fw={500} mt="md">
        CPU Usage
      </Text>
    </Card>
    
    <Card withBorder p="md">
      <Center>
        <RingProgress
          sections={[{ value: metrics.memory, color: metrics.memory > 80 ? 'red' : metrics.memory > 60 ? 'orange' : 'blue' }]}
          label={
            <Text ta="center" fw={700} size="xl">
              {metrics.memory}%
            </Text>
          }
        />
      </Center>
      <Text ta="center" fw={500} mt="md">
        Memory Usage
      </Text>
    </Card>
    
    <Card withBorder p="md">
      <Center>
        <RingProgress
          sections={[{ value: metrics.disk, color: metrics.disk > 80 ? 'red' : metrics.disk > 60 ? 'orange' : 'green' }]}
          label={
            <Text ta="center" fw={700} size="xl">
              {metrics.disk}%
            </Text>
          }
        />
      </Center>
      <Text ta="center" fw={500} mt="md">
        Disk Usage
      </Text>
    </Card>
  </Group>
);

// Flow Architecture Diagram Component
const FlowArchitectureDiagram = ({ latencyData }) => {
  const boxStyle = {
    border: '2px solid #ccc',
    borderRadius: '8px',
    padding: '10px',
    textAlign: 'center' as const,
    position: 'relative' as const,
    minWidth: '120px',
    backgroundColor: '#f9f9f9'
  };

  const arrowStyle = {
    position: 'relative' as const,
    height: '2px',
    backgroundColor: '#ccc',
    flex: 1,
    margin: '0 5px',
    minWidth: '30px'
  };

  const latencyBadgeStyle = {
    position: 'absolute' as const,
    top: '-12px',
    right: '-12px',
    backgroundColor: '#2196F3',
    color: 'white',
    borderRadius: '12px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 'bold'
  };

  const modelContainerStyle = {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '10px',
    border: '2px dashed #ccc',
    borderRadius: '8px',
    padding: '15px',
    backgroundColor: '#f0f0f0'
  };

  return (
    <Card withBorder p="md">
      <Title order={4} mb="md">Flow Architecture</Title>
      <Text mb="lg">End-to-end request flow with component latencies (ms)</Text>
      
      <Box mb="lg">
        <Group position="center" align="center" style={{ flexWrap: 'nowrap' }}>
          {/* Input */}
          <Box style={boxStyle}>
            <Text fw={500}>Input</Text>
            <div style={latencyBadgeStyle}>{latencyData.input} ms</div>
          </Box>
          
          {/* Arrow */}
          <div style={arrowStyle}>
            <div style={{ position: 'absolute', right: '-5px', top: '-5px', width: '0', height: '0', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '5px solid #ccc' }}></div>
          </div>
          
          {/* Preprocessor */}
          <Box style={boxStyle}>
            <Text fw={500}>Preprocessor</Text>
            <div style={latencyBadgeStyle}>{latencyData.preprocessor} ms</div>
          </Box>
          
          {/* Arrow */}
          <div style={arrowStyle}>
            <div style={{ position: 'absolute', right: '-5px', top: '-5px', width: '0', height: '0', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '5px solid #ccc' }}></div>
          </div>
          
          {/* Classifier */}
          <Box style={boxStyle}>
            <Text fw={500}>Classifier</Text>
            <div style={latencyBadgeStyle}>{latencyData.classifier} ms</div>
          </Box>
          
          {/* Arrow */}
          <div style={arrowStyle}>
            <div style={{ position: 'absolute', right: '-5px', top: '-5px', width: '0', height: '0', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '5px solid #ccc' }}></div>
          </div>
          
          {/* Router */}
          <Box style={boxStyle}>
            <Text fw={500}>Router</Text>
            <div style={latencyBadgeStyle}>{latencyData.router} ms</div>
          </Box>
          
          {/* Arrow */}
          <div style={arrowStyle}>
            <div style={{ position: 'absolute', right: '-5px', top: '-5px', width: '0', height: '0', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '5px solid #ccc' }}></div>
          </div>
          
          {/* Models Container */}
          <Box style={modelContainerStyle}>
            <Text fw={500} ta="center">Models</Text>
            <Group position="center" spacing="xs">
              {Object.entries(latencyData.models).map(([model, latency]) => (
                <Box key={model} style={{ ...boxStyle, minWidth: '100px' }}>
                  <Text size="sm">{model}</Text>
                  <div style={latencyBadgeStyle}>{latency} ms</div>
                </Box>
              ))}
            </Group>
          </Box>
          
          {/* Arrow */}
          <div style={arrowStyle}>
            <div style={{ position: 'absolute', right: '-5px', top: '-5px', width: '0', height: '0', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '5px solid #ccc' }}></div>
          </div>
          
          {/* Output */}
          <Box style={boxStyle}>
            <Text fw={500}>Output</Text>
            <div style={latencyBadgeStyle}>{latencyData.output} ms</div>
          </Box>
        </Group>
      </Box>
      
      <Group position="apart">
        <Text size="sm" c="dimmed">Total processing pipeline latency (excluding model): {latencyData.input + latencyData.preprocessor + latencyData.classifier + latencyData.router + latencyData.output} ms</Text>
        <Badge color="blue">Updated: {new Date().toLocaleTimeString()}</Badge>
      </Group>
    </Card>
  );
};

// Real-time log component
const RealTimeLog = ({ logs }) => (
  <Card withBorder p="md">
    <Group position="apart" mb="md">
      <Title order={4}>Real-time Prompt Log</Title>
      <Badge>{logs.length} entries</Badge>
    </Group>
    
    <ScrollArea h={300}>
      <Table striped highlightOnHover>
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
              <Table.Td>{new Date(log.timestamp).toLocaleTimeString()}</Table.Td>
              <Table.Td>
                <Text lineClamp={1} style={{ maxWidth: '300px' }}>
                  {log.prompt}
                </Text>
              </Table.Td>
              <Table.Td>{log.classifier}</Table.Td>
              <Table.Td>{log.model}</Table.Td>
              <Table.Td>{log.tokens}</Table.Td>
              <Table.Td>
                <Badge color={log.status === 'success' ? 'green' : 'red'}>
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
    <Stack spacing="lg">
      <Title order={2}>Dashboard</Title>
      <Text>Real-time monitoring of Neuroroute API performance and usage.</Text>
      
      <Grid gutter="md">
        <Grid.Col span={6}>
          <Paper withBorder p="md" radius="md">
            <Title order={4} mb="md">Prompts per Hour</Title>
            <PromptsPerHourChart data={promptsData} />
          </Paper>
        </Grid.Col>
        
        <Grid.Col span={6}>
          <Paper withBorder p="md" radius="md">
            <Title order={4} mb="md">Tokens per Hour</Title>
            <TokensPerHourChart data={tokensData} />
          </Paper>
        </Grid.Col>
      </Grid>
      
      <Grid gutter="md">
        <Grid.Col span={4}>
          <Paper withBorder p="md" radius="md">
            <Title order={4} mb="md">System Resources</Title>
            <SystemMetricsDisplay metrics={systemMetrics} />
          </Paper>
        </Grid.Col>
        
        <Grid.Col span={8}>
          <Paper withBorder p="md" radius="md">
            <Title order={4} mb="md">Tokens per Model</Title>
            <TokensPerModelChart data={modelData} />
          </Paper>
        </Grid.Col>
      </Grid>
      
      <Divider my="sm" />
      
      {/* Flow Architecture Diagram */}
      <FlowArchitectureDiagram latencyData={flowLatencyData} />
      
      <Divider my="sm" />
      
      <RealTimeLog logs={logs} />
    </Stack>
  );
}