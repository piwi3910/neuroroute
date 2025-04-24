import { Title, Text, Card, Switch, TextInput, NumberInput, Button, Group, Stack, Divider } from '@mantine/core';
import { useState } from 'react';

export function SettingsPage() {
  // Mock settings - in a real app, these would be fetched from and saved to the API
  const [settings, setSettings] = useState({
    apiRateLimit: 100,
    enableCaching: true,
    cacheExpiryMinutes: 30,
    defaultModel: 'gpt-4',
    logLevel: 'info',
  });

  // Handler for form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send the settings to the API
    console.log('Saving settings:', settings);
    // Show success notification or feedback
  };

  return (
    <>
      <Title order={2} mb="md">System Settings</Title>
      <Text mb="lg">Configure system-wide settings for the Neuroroute API.</Text>

      <form onSubmit={handleSubmit}>
        <Card withBorder shadow="sm" p="lg" radius="md">
          <Stack>
            <Title order={4}>API Settings</Title>
            
            <NumberInput
              label="API Rate Limit (requests per minute)"
              description="Maximum number of API requests allowed per minute per user"
              value={settings.apiRateLimit}
              onChange={(value) => setSettings({ ...settings, apiRateLimit: Number(value) })}
              min={1}
              max={1000}
              required
            />

            <Divider my="sm" />
            
            <Title order={4}>Cache Settings</Title>
            
            <Switch
              label="Enable Response Caching"
              description="Cache API responses to improve performance"
              checked={settings.enableCaching}
              onChange={(event) => setSettings({ ...settings, enableCaching: event.currentTarget.checked })}
            />
            
            {settings.enableCaching && (
              <NumberInput
                label="Cache Expiry (minutes)"
                description="Time in minutes before cached responses expire"
                value={settings.cacheExpiryMinutes}
                onChange={(value) => setSettings({ ...settings, cacheExpiryMinutes: Number(value) })}
                min={1}
                max={1440} // 24 hours
              />
            )}

            <Divider my="sm" />
            
            <Title order={4}>Model Settings</Title>
            
            <TextInput
              label="Default Model"
              description="Default AI model to use when not specified"
              value={settings.defaultModel}
              onChange={(event) => setSettings({ ...settings, defaultModel: event.target.value })}
              required
            />

            <Divider my="sm" />
            
            <Title order={4}>Logging</Title>
            
            <TextInput
              label="Log Level"
              description="Minimum log level to record (debug, info, warn, error)"
              value={settings.logLevel}
              onChange={(event) => setSettings({ ...settings, logLevel: event.target.value })}
              required
            />
          </Stack>

          <Group justify="flex-end" mt="xl">
            <Button variant="outline">Reset to Defaults</Button>
            <Button type="submit">Save Settings</Button>
          </Group>
        </Card>
      </form>
    </>
  );
}