import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import adminRoutes from '../../src/routes/admin.js';
import { createUserService } from '../../src/services/user.js';
import { createConfigManager } from '../../src/services/config-manager.js';
import { createApiKeyService } from '../../src/services/api-key.js';

describe('Admin API Endpoints', () => {
  let app: FastifyInstance;
  let mockUser: any;
  let mockToken: string;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    
    // Mock config
    app.decorate('config', {
      ENABLE_CACHE: true,
      ENABLE_SWAGGER: true,
      NODE_ENV: 'test',
      REDIS_CACHE_TTL: 300,
      JWT_SECRET: 'test-secret',
      JWT_EXPIRATION: '1h',
      ENABLE_JWT_AUTH: true
    } as any);
    
    // Mock Redis
    app.decorate('redis', {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1)
    } as any);
    
    // Mock Prisma
    app.decorate('prisma', {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      role: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      permission: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn()
      },
      userRole: {
        create: jest.fn(),
        deleteMany: jest.fn()
      },
      userPermission: {
        create: jest.fn(),
        deleteMany: jest.fn()
      },
      rolePermission: {
        create: jest.fn(),
        deleteMany: jest.fn()
      },
      apiKey: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      config: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn()
      },
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }])
    } as any);
    
    // Mock JWT
    app.decorate('jwt', {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn()
    } as any);
    
    // Create mock user with admin role
    mockUser = {
      id: '1',
      sub: '1',
      name: 'Admin User',
      email: 'admin@example.com',
      roles: ['admin'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    
    // Mock token
    mockToken = 'mock-token';
    
    // Mock request.user
    app.addHook('onRequest', (request, reply, done) => {
      request.user = mockUser;
      done();
    });
    
    // Register admin routes
    await app.register(adminRoutes);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('User Management Endpoints', () => {
    it('should get all users', async () => {
      // Mock user service
      const mockUsers = [
        {
          id: '1',
          username: 'admin',
          email: 'admin@example.com',
          roles: ['admin'],
          permissions: ['read', 'write', 'admin'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          username: 'user',
          email: 'user@example.com',
          roles: ['user'],
          permissions: ['read'],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      // Mock prisma response
      app.prisma.user.findMany.mockResolvedValue(mockUsers.map(user => ({
        ...user,
        userRoles: user.roles.map(role => ({ role: { name: role } })),
        userPermissions: user.permissions.map(perm => ({ permission: { name: perm } }))
      })));
      
      const response = await app.inject({
        method: 'GET',
        url: '/users',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(2);
    });
    
    it('should get a user by ID', async () => {
      // Mock user
      const mockUser = {
        id: '1',
        username: 'admin',
        email: 'admin@example.com',
        userRoles: [{ role: { name: 'admin' } }],
        userPermissions: [{ permission: { name: 'read' } }, { permission: { name: 'write' } }],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Mock prisma response
      app.prisma.user.findUnique.mockResolvedValue(mockUser);
      
      const response = await app.inject({
        method: 'GET',
        url: '/users/1',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveProperty('id', '1');
    });
    
    it('should create a new user', async () => {
      // Mock user
      const newUser = {
        id: '3',
        username: 'newuser',
        email: 'newuser@example.com',
        userRoles: [{ role: { name: 'user' } }],
        userPermissions: [{ permission: { name: 'read' } }],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Mock prisma responses
      app.prisma.user.create.mockResolvedValue({ ...newUser });
      app.prisma.user.findUnique.mockResolvedValue(newUser);
      app.prisma.role.findMany.mockResolvedValue([{ id: '2', name: 'user' }]);
      
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'password123',
          role: 'user'
        }
      });
      
      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toHaveProperty('id', '3');
    });
  });
  
  describe('System Configuration Endpoints', () => {
    it('should get all configuration', async () => {
      // Mock config
      const mockConfigs = [
        { key: 'ENABLE_CACHE', value: 'true' },
        { key: 'API_RATE_LIMIT', value: '100' }
      ];
      
      // Mock prisma response
      app.prisma.config.findMany.mockResolvedValue(mockConfigs);
      
      const response = await app.inject({
        method: 'GET',
        url: '/config',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveProperty('ENABLE_CACHE');
    });
    
    it('should update configuration', async () => {
      // Mock prisma response
      app.prisma.config.upsert.mockResolvedValue({ key: 'API_RATE_LIMIT', value: '200' });
      
      const response = await app.inject({
        method: 'PUT',
        url: '/config',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          key: 'API_RATE_LIMIT',
          value: 200
        }
      });
      
      expect(response.statusCode).toBe(200);
      expect(app.prisma.config.upsert).toHaveBeenCalled();
    });
  });
  
  describe('System Monitoring Endpoints', () => {
    it('should get system health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveProperty('status', 'ok');
      expect(JSON.parse(response.payload)).toHaveProperty('services');
    });
    
    it('should get system metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveProperty('system');
      expect(JSON.parse(response.payload)).toHaveProperty('database');
    });
  });
  
  describe('API Key Management Endpoints', () => {
    it('should get all API keys', async () => {
      // Mock API keys
      const mockApiKeys = [
        {
          id: '1',
          name: 'Test API Key',
          description: 'For testing',
          permissions: ['read'],
          enabled: true,
          expiresAt: null,
          createdAt: new Date(),
          lastUsedAt: null,
          usageCount: 0
        }
      ];
      
      // Mock prisma response
      app.prisma.apiKey.findMany.mockResolvedValue(mockApiKeys);
      
      const response = await app.inject({
        method: 'GET',
        url: '/api-keys',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(1);
    });
    
    it('should create a new API key', async () => {
      // Mock API key
      const mockApiKey = {
        id: '2',
        key: 'nr_abcdefghijklmnop-abcdefghijklmnop-abcdefghijklmnop',
        name: 'New API Key',
        description: 'For testing',
        permissions: ['read'],
        enabled: true,
        expiresAt: null,
        createdAt: new Date(),
        lastUsedAt: null,
        usageCount: 0
      };
      
      // Mock prisma response
      app.prisma.apiKey.create.mockResolvedValue(mockApiKey);
      
      const response = await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          name: 'New API Key',
          permissions: ['read']
        }
      });
      
      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toHaveProperty('key');
    });
  });
  
  describe('Role Management Endpoints', () => {
    it('should get all roles', async () => {
      // Mock roles
      const mockRoles = [
        {
          id: '1',
          name: 'admin',
          rolePermissions: [
            { permission: { name: 'read' } },
            { permission: { name: 'write' } },
            { permission: { name: 'admin' } }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          name: 'user',
          rolePermissions: [
            { permission: { name: 'read' } }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      // Mock prisma response
      app.prisma.role.findMany.mockResolvedValue(mockRoles);
      
      const response = await app.inject({
        method: 'GET',
        url: '/roles',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toHaveLength(2);
    });
    
    it('should create a new role', async () => {
      // Mock role
      const mockRole = {
        id: '3',
        name: 'editor',
        rolePermissions: [
          { permission: { name: 'read' } },
          { permission: { name: 'write' } }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Mock prisma responses
      app.prisma.role.create.mockResolvedValue({ id: '3', name: 'editor' });
      app.prisma.role.findUnique.mockResolvedValue(mockRole);
      app.prisma.permission.findMany.mockResolvedValue([
        { id: '1', name: 'read' },
        { id: '2', name: 'write' }
      ]);
      
      const response = await app.inject({
        method: 'POST',
        url: '/roles',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        },
        payload: {
          name: 'editor',
          permissions: ['read', 'write']
        }
      });
      
      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toHaveProperty('name', 'editor');
    });
  });
  
  describe('Access Control', () => {
    it('should deny access to non-admin users', async () => {
      // Change user role to non-admin
      mockUser.roles = ['user'];
      
      const response = await app.inject({
        method: 'GET',
        url: '/users',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      });
      
      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload)).toHaveProperty('error', 'Forbidden: Admin access required');
    });
  });
});