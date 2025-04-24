import { Title, Text } from '@mantine/core';

export function HomePage() {
  return (
    <>
      <Title order={2}>Dashboard</Title>
      <Text mt="md">Welcome to the Neuroroute Admin Dashboard.</Text>
      {/* Add dashboard widgets or content here */}
    </>
  );
}