import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createUserService } from '../services/user';
import { createConfigManagerService } from '../services/config-manager';
import { createApiKeyService } from '../services/api-key';

interface UserCreateRequest {
  username: string;
  email: string;
  password: string;
  role: string;
}

interface UserUpdateRequest {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  active?: boolean;
}

interface ConfigUpdateRequest {
  key: string;
  value: string | number | boolean;
}

interface ApiKeyCreateRequest {
  name: string;
  expiresAt?: string;
  permissions?: string[];
}

interface RoleCreateRequest {
  name: string;
  permissions: string[];
}

/**
 * Admin API routes
 * 
 * These routes provide administrative functionality for managing users,
 * system configuration, monitoring, API keys, and roles/permissions.
 */
export default async function adminRoutes(fastify: FastifyInstance) {
  // Create services
  const userService = createUserService(fastify);
  const configService = createConfigManagerService(fastify);
  const apiKeyService = createApiKeyService(fastify);

  // Middleware to ensure admin access
  fastify.addHook('onRequest', async (request, reply) => {
    // Get user from request (set by auth plugin)
    const user = request.user;
    
    // Check if user exists and has admin role
    if (!user || !user.roles.includes('admin')) {
      reply.code(403).send({ error: 'Forbidden: Admin access required' });
      return reply;
    }
  });

  // User Management Endpoints
  
  // Get all users
  fastify.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const users = await userService.getAllUsers();
      return reply.send(users);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to retrieve users' });
    }
  });

  // Get user by ID
  fastify.get('/users/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const user = await userService.getUserById(id);
      
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
      
      return reply.send(user);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to retrieve user' });
    }
  });

  // Create new user
  fastify.post('/users', async (request: FastifyRequest<{ Body: UserCreateRequest }>, reply: FastifyReply) => {
    try {
      const userData = request.body;
      
      // Validate required fields
      if (!userData.username || !userData.email || !userData.password) {
        return reply.code(400).send({ error: 'Username, email, and password are required' });
      }
      
      const newUser = await userService.createUser(userData);
      return reply.code(201).send(newUser);
    } catch (error) {
      fastify.log.error(error);
      
      // Handle duplicate email/username
      if ((error as any).code === 'P2002') {
        return reply.code(409).send({ error: 'User with this email or username already exists' });
      }
      
      return reply.code(500).send({ error: 'Failed to create user' });
    }
  });

  // Update user
  fastify.put('/users/:id', async (request: FastifyRequest<{ Params: { id: string }, Body: UserUpdateRequest }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userData = request.body;
      
      const updatedUser = await userService.updateUser(id, userData);
      
      if (!updatedUser) {
        return reply.code(404).send({ error: 'User not found' });
      }
      
      return reply.send(updatedUser);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to update user' });
    }
  });

  // Delete user
  fastify.delete('/users/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      // Prevent deleting the current user
      if (id === request.user.sub) {
        return reply.code(400).send({ error: 'Cannot delete your own account' });
      }
      
      const deleted = await userService.deleteUser(id);
      
      if (!deleted) {
        return reply.code(404).send({ error: 'User not found' });
      }
      
      return reply.code(204).send();
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to delete user' });
    }
  });

  // System Configuration Endpoints
  
  // Get all configuration
  fastify.get('/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = await configService.getAllConfig();
      return reply.send(config);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to retrieve configuration' });
    }
  });

  // Get configuration by key
  fastify.get('/config/:key', async (request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) => {
    try {
      const { key } = request.params;
      // Use type assertion for dynamic config keys
      const value = await configService.getConfig(key as any);
      
      if (value === undefined) {
        return reply.code(404).send({ error: 'Configuration key not found' });
      }
      
      return reply.send({ key, value });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to retrieve configuration' });
    }
  });

  // Update configuration
  fastify.put('/config', async (request: FastifyRequest<{ Body: ConfigUpdateRequest }>, reply: FastifyReply) => {
    try {
      const { key, value } = request.body;
      
      if (!key) {
        return reply.code(400).send({ error: 'Configuration key is required' });
      }
      
      // Use type assertion for dynamic config keys
      const updated = await configService.setConfig(key as any, value);
      return reply.send(updated);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to update configuration' });
    }
  });

  // System Monitoring Endpoints
  
  // Get system health
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check database connection
      let dbStatus = 'ok';
      try {
        await fastify.prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        dbStatus = 'error';
      }
      
      // Check Redis connection if enabled
      let redisStatus = 'disabled';
      if (fastify.config.ENABLE_CACHE) {
        try {
          await fastify.redis.ping();
          redisStatus = 'ok';
        } catch (error) {
          redisStatus = 'error';
        }
      }
      
      // Get system metrics
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      return reply.send({
        status: dbStatus === 'ok' && (redisStatus === 'ok' || redisStatus === 'disabled') ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        uptime,
        services: {
          database: dbStatus,
          redis: redisStatus,
        },
        metrics: {
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
          },
          uptime,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to retrieve system health' });
    }
  });

  // Get system metrics
  fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get system metrics
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Get database metrics
      const dbConnectionCount = await fastify.prisma.$executeRaw`SELECT count(*) FROM pg_stat_activity`;
      
      // Get Redis metrics if enabled
      let redisInfo = null;
      if (fastify.config.ENABLE_CACHE) {
        try {
          const info = await fastify.redis.info();
          redisInfo = info;
        } catch (error) {
          fastify.log.error(error);
        }
      }
      
      return reply.send({
        timestamp: new Date().toISOString(),
        system: {
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
            external: Math.round(memoryUsage.external / 1024 / 1024), // MB
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
          },
          uptime: process.uptime(),
        },
        database: {
          connections: dbConnectionCount,
        },
        redis: redisInfo,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to retrieve system metrics' });
    }
  });

  // API Key Management Endpoints
  
  // Get all API keys
  fastify.get('/api-keys', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const apiKeys = await apiKeyService.getAllApiKeys();
      return reply.send(apiKeys);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to retrieve API keys' });
    }
  });

  // Create new API key
  fastify.post('/api-keys', async (request: FastifyRequest<{ Body: ApiKeyCreateRequest }>, reply: FastifyReply) => {
    try {
      const { name, expiresAt, permissions } = request.body;
      
      if (!name) {
        return reply.code(400).send({ error: 'API key name is required' });
      }
      
      const newApiKey = await apiKeyService.createApiKey({
        name,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        permissions,
      });
      
      return reply.code(201).send(newApiKey);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to create API key' });
    }
  });

  // Revoke API key
  fastify.delete('/api-keys/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      const revoked = await apiKeyService.revokeApiKey(id);
      
      if (!revoked) {
        return reply.code(404).send({ error: 'API key not found' });
      }
      
      return reply.code(204).send();
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to revoke API key' });
    }
  });

  // Role and Permission Management Endpoints
  
  // Get all roles
  fastify.get('/roles', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const roles = await userService.getAllRoles();
      return reply.send(roles);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to retrieve roles' });
    }
  });

  // Create new role
  fastify.post('/roles', async (request: FastifyRequest<{ Body: RoleCreateRequest }>, reply: FastifyReply) => {
    try {
      const { name, permissions } = request.body;
      
      if (!name || !permissions || !Array.isArray(permissions)) {
        return reply.code(400).send({ error: 'Role name and permissions array are required' });
      }
      
      const newRole = await userService.createRole(name, permissions);
      return reply.code(201).send(newRole);
    } catch (error) {
      fastify.log.error(error);
      
      // Handle duplicate role name
      if ((error as any).code === 'P2002') {
        return reply.code(409).send({ error: 'Role with this name already exists' });
      }
      
      return reply.code(500).send({ error: 'Failed to create role' });
    }
  });

  // Update role
  fastify.put('/roles/:id', async (request: FastifyRequest<{ Params: { id: string }, Body: { name?: string, permissions?: string[] } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { name, permissions } = request.body;
      
      const updatedRole = await userService.updateRole(id, { name, permissions });
      
      if (!updatedRole) {
        return reply.code(404).send({ error: 'Role not found' });
      }
      
      return reply.send(updatedRole);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to update role' });
    }
  });

  // Delete role
  fastify.delete('/roles/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      // Prevent deleting built-in roles
      const role = await userService.getRoleById(id);
      if (role && ['admin', 'user'].includes(role.name)) {
        return reply.code(400).send({ error: 'Cannot delete built-in roles' });
      }
      
      const deleted = await userService.deleteRole(id);
      
      if (!deleted) {
        return reply.code(404).send({ error: 'Role not found' });
      }
      
      return reply.code(204).send();
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to delete role' });
    }
  });

  // Get all permissions
  fastify.get('/permissions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const permissions = await userService.getAllPermissions();
      return reply.send(permissions);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to retrieve permissions' });
    }
  });
}
