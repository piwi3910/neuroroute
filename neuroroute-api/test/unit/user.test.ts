import { FastifyInstance } from 'fastify';
import { UserService, createUserService, UserData, UserCreateData } from '../../src/services/user';

describe('UserService', () => {
  let fastifyMock: FastifyInstance;
  let userService: UserService;
  
  beforeEach(() => {
    // Create a mock Fastify instance
    fastifyMock = {
      log: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
      jwt: {
        sign: jest.fn().mockReturnValue('mock-jwt-token'),
      },
      prisma: {
        user: {
          findUnique: jest.fn(),
          create: jest.fn(),
        },
        role: {
          findMany: jest.fn(),
        },
        permission: {
          findMany: jest.fn(),
        },
        userRole: {
          create: jest.fn(),
        },
        userPermission: {
          create: jest.fn(),
        },
      },
    } as unknown as FastifyInstance;
    
    // Create the user service
    userService = createUserService(fastifyMock);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getUserById', () => {
    it('should return user data when user exists', async () => {
      // Mock user data
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        userRoles: [
          {
            role: {
              name: 'admin',
            },
          },
          {
            role: {
              name: 'user',
            },
          },
        ],
        userPermissions: [
          {
            permission: {
              name: 'read',
            },
          },
          {
            permission: {
              name: 'write',
            },
          },
        ],
      };
      
      // Mock prisma response
      (fastifyMock.prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      
      // Call the method
      const result = await userService.getUserById('user-1');
      
      // Check the result
      expect(result).toEqual({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['admin', 'user'],
        permissions: ['read', 'write'],
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      
      // Check that prisma was called correctly
      expect(fastifyMock.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
          userPermissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });
    
    it('should return null when user does not exist', async () => {
      // Mock prisma response
      (fastifyMock.prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      // Call the method
      const result = await userService.getUserById('nonexistent-user');
      
      // Check the result
      expect(result).toBeNull();
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock prisma error
      (fastifyMock.prisma.user.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
      
      // Call the method
      const result = await userService.getUserById('user-1');
      
      // Check the result
      expect(result).toBeNull();
      expect(fastifyMock.log.error).toHaveBeenCalled();
    });
  });
  
  describe('getUserByUsername', () => {
    it('should return user data when user exists', async () => {
      // Mock user data
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
        passwordSalt: 'salt',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        userRoles: [
          {
            role: {
              name: 'admin',
            },
          },
        ],
        userPermissions: [
          {
            permission: {
              name: 'read',
            },
          },
        ],
      };
      
      // Mock prisma response
      (fastifyMock.prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      
      // Call the method
      const result = await userService.getUserByUsername('testuser');
      
      // Check the result
      expect(result).toEqual({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['admin'],
        permissions: ['read'],
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      
      // Check that prisma was called correctly
      expect(fastifyMock.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
          userPermissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });
  });
  
  describe('createUser', () => {
    it('should create a user with default role', async () => {
      // Mock user data
      const userData: UserCreateData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      };
      
      // Mock prisma responses
      (fastifyMock.prisma.user.create as jest.Mock).mockResolvedValueOnce({
        id: 'new-user-id',
        username: 'newuser',
        email: 'new@example.com',
      });
      
      (fastifyMock.prisma.role.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 'role-user', name: 'user' },
      ]);
      
      // Mock getUserById to return user data
      jest.spyOn(userService, 'getUserById').mockResolvedValueOnce({
        id: 'new-user-id',
        username: 'newuser',
        email: 'new@example.com',
        roles: ['user'],
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserData);
      
      // Call the method
      const result = await userService.createUser(userData);
      
      // Check the result
      expect(result).toEqual({
        id: 'new-user-id',
        username: 'newuser',
        email: 'new@example.com',
        roles: ['user'],
        permissions: [],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      
      // Check that prisma was called correctly
      expect(fastifyMock.prisma.user.create).toHaveBeenCalledWith({
        data: {
          username: 'newuser',
          email: 'new@example.com',
          passwordHash: expect.any(String),
          passwordSalt: expect.any(String),
        },
      });
      
      // Check that role assignment was called
      expect(fastifyMock.prisma.role.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            in: ['user'],
          },
        },
      });
      
      expect(fastifyMock.prisma.userRole.create).toHaveBeenCalled();
    });
    
    it('should create a user with specified roles and permissions', async () => {
      // Mock user data
      const userData: UserCreateData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        roles: ['admin', 'editor'],
        permissions: ['read', 'write'],
      };
      
      // Mock prisma responses
      (fastifyMock.prisma.user.create as jest.Mock).mockResolvedValueOnce({
        id: 'new-user-id',
        username: 'newuser',
        email: 'new@example.com',
      });
      
      (fastifyMock.prisma.role.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 'role-admin', name: 'admin' },
        { id: 'role-editor', name: 'editor' },
      ]);
      
      (fastifyMock.prisma.permission.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 'perm-read', name: 'read' },
        { id: 'perm-write', name: 'write' },
      ]);
      
      // Mock getUserById to return user data
      jest.spyOn(userService, 'getUserById').mockResolvedValueOnce({
        id: 'new-user-id',
        username: 'newuser',
        email: 'new@example.com',
        roles: ['admin', 'editor'],
        permissions: ['read', 'write'],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserData);
      
      // Call the method
      const result = await userService.createUser(userData);
      
      // Check the result
      expect(result).toEqual({
        id: 'new-user-id',
        username: 'newuser',
        email: 'new@example.com',
        roles: ['admin', 'editor'],
        permissions: ['read', 'write'],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      
      // Check that role and permission assignments were called
      expect(fastifyMock.prisma.role.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            in: ['admin', 'editor'],
          },
        },
      });
      
      expect(fastifyMock.prisma.permission.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            in: ['read', 'write'],
          },
        },
      });
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock user data
      const userData: UserCreateData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      };
      
      // Mock prisma error
      (fastifyMock.prisma.user.create as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
      
      // Call the method
      const result = await userService.createUser(userData);
      
      // Check the result
      expect(result).toBeNull();
      expect(fastifyMock.log.error).toHaveBeenCalled();
    });
  });
  
  describe('authenticateUser', () => {
    it('should return user data when credentials are valid', async () => {
      // Create a password hash and salt
      const password = 'password123';
      const salt = 'test-salt';
      const hash = userService['hashPassword'](password).hash;
      
      // Mock user data
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: hash,
        passwordSalt: salt,
      };
      
      // Mock prisma responses
      (fastifyMock.prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      
      // Mock getUserById to return user data
      jest.spyOn(userService, 'getUserById').mockResolvedValueOnce({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
        permissions: ['read'],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserData);
      
      // Call the method with correct password
      const result = await userService.authenticateUser('testuser', password);
      
      // Check the result
      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-1');
    });
    
    it('should return null when user does not exist', async () => {
      // Mock prisma response
      (fastifyMock.prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      // Call the method
      const result = await userService.authenticateUser('nonexistent', 'password');
      
      // Check the result
      expect(result).toBeNull();
    });
    
    it('should return null when password is incorrect', async () => {
      // Create a password hash and salt
      const correctPassword = 'password123';
      const salt = 'test-salt';
      const hash = userService['hashPassword'](correctPassword).hash;
      
      // Mock user data
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: hash,
        passwordSalt: salt,
      };
      
      // Mock prisma response
      (fastifyMock.prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
      
      // Call the method with incorrect password
      const result = await userService.authenticateUser('testuser', 'wrongpassword');
      
      // Check the result
      expect(result).toBeNull();
    });
  });
  
  describe('generateToken', () => {
    it('should generate a JWT token for a user', () => {
      // Mock user data
      const userData: UserData = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['admin'],
        permissions: ['read', 'write'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Call the method
      const token = userService.generateToken(userData);
      
      // Check the result
      expect(token).toBe('mock-jwt-token');
      expect(fastifyMock.jwt.sign).toHaveBeenCalledWith(
        {
          sub: 'user-1',
          name: 'testuser',
          email: 'test@example.com',
          roles: ['admin'],
        },
        { expiresIn: '1h' }
      );
    });
    
    it('should use custom expiration time if provided', () => {
      // Mock user data
      const userData: UserData = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['admin'],
        permissions: ['read', 'write'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Call the method with custom expiration
      const token = userService.generateToken(userData, '7d');
      
      // Check the result
      expect(token).toBe('mock-jwt-token');
      expect(fastifyMock.jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        { expiresIn: '7d' }
      );
    });
  });
  
  describe('password handling', () => {
    it('should hash passwords securely', () => {
      // Get the private hashPassword method
      const hashPassword = userService['hashPassword'].bind(userService);
      
      // Hash a password
      const { hash, salt } = hashPassword('password123');
      
      // Check the result
      expect(hash).toBeTruthy();
      expect(salt).toBeTruthy();
      expect(hash.length).toBeGreaterThan(32); // Should be a long hash
      expect(salt.length).toBeGreaterThan(16); // Should be a decent salt
    });
    
    it('should verify passwords correctly', () => {
      // Get the private methods
      const hashPassword = userService['hashPassword'].bind(userService);
      const verifyPassword = userService['verifyPassword'].bind(userService);
      
      // Hash a password
      const password = 'password123';
      const { hash, salt } = hashPassword(password);
      
      // Verify the password
      const isValid = verifyPassword(password, hash, salt);
      const isInvalid = verifyPassword('wrongpassword', hash, salt);
      
      // Check the results
      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });
  });
});