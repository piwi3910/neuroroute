import { Title, Paper, TextInput, PasswordInput, Button, Container, Group } from '@mantine/core';

export function LoginPage() {
  return (
    <Container size={420} my={40}>
      <Title ta="center">
        Welcome back!
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <TextInput label="Email" placeholder="you@mantine.dev" required />
        <PasswordInput label="Password" placeholder="Your password" required mt="md" />
        <Group justify="space-between" mt="lg">
          {/* Add Remember me checkbox if needed */}
        </Group>
        <Button fullWidth mt="xl">
          Sign in
        </Button>
      </Paper>
    </Container>
  );
}