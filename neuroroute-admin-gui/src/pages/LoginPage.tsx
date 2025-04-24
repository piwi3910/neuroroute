import { useState } from 'react';
import { 
  Title, 
  Paper, 
  TextInput, 
  PasswordInput, 
  Button, 
  Container, 
  Group,
  Text,
  Alert
} from '@mantine/core';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { IconAlertCircle } from '@tabler/icons-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const { login, isAuthenticated, isLoading, error } = useAuth();

  // If already authenticated, redirect to home
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Basic validation
    if (!email.trim()) {
      setFormError('Email is required');
      return;
    }
    if (!password.trim()) {
      setFormError('Password is required');
      return;
    }

    try {
      await login({ email, password });
    } catch (err) {
      // Error is handled by the auth context
      console.error('Login error:', err);
    }
  };

  return (
    <Container size={420} my={40}>
      <Title ta="center">
        Neuroroute Admin
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Enter your credentials to access the admin panel
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={handleSubmit}>
          {(formError || error) && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
              {formError || error}
            </Alert>
          )}

          <TextInput
            label="Email"
            placeholder="admin@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          
          <PasswordInput
            label="Password"
            placeholder="Your password"
            required
            mt="md"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          
          <Button 
            fullWidth 
            mt="xl" 
            type="submit"
            loading={isLoading}
          >
            Sign in
          </Button>
        </form>
      </Paper>
    </Container>
  );
}