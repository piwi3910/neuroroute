import { FastifyInstance } from 'fastify';
import { ConfigManager, createConfigManager } from '../../src/services/config-manager.js';
import { AppConfig } from '../../src/config.js';

describe('ConfigManager', () => {
  let fastifyMock: FastifyInstance;
  let configManager: ConfigManager;
  
  beforeEach(() => {
    // Create a mock Fastify instance
    fastifyMock = {
      log: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
      config: {
        ENABLE_DYNAMIC_CONFIG: true,
        PORT: 3000,
        HOST: 'localhost',
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/neuroroute_test',
        REDIS_URL: 'redis://localhost:6379',
        REDIS_CACHE_TTL: 300,
        LOG_LEVEL: 'info',
        API_RATE_LIMIT: 200,
        API_TIMEOUT: 30000,
        ENABLE_CACHE: true,
        ENABLE_SWAGGER: true,
        JWT_SECRET: 'test-jwt-secret',
        JWT_EXPIRATION: '1h',
        ENABLE_JWT_AUTH: true,
      } as AppConfig,
      prisma: {
        config: {
          findUnique: jest.fn(),
          upsert: jest.fn(),
          delete: jest.fn(),
        },
      },
    } as unknown as FastifyInstance;
    
    // Create the config manager
    configManager = createConfigManager(fastifyMock);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('get', () => {
    it('should return config value from environment when cache is disabled', async () => {
      // Disable cache
      configManager.setCacheEnabled(false);
      
      const result = await configManager.get('PORT');
      
      expect(result).toBe(3000);
      expect(fastifyMock.prisma.config.findUnique).not.toHaveBeenCalled();
    });
    
    it('should return config value from database when available', async () => {
      // Mock database response
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      const result = await configManager.get('PORT');
      
      expect(result).toBe(4000);
      expect(fastifyMock.prisma.config.findUnique).toHaveBeenCalledWith({
        where: { key: 'PORT' },
      });
    });
    
    it('should return config value from environment when not in database', async () => {
      // Mock database response
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      const result = await configManager.get('PORT');
      
      expect(result).toBe(3000);
      expect(fastifyMock.prisma.config.findUnique).toHaveBeenCalledWith({
        where: { key: 'PORT' },
      });
    });
    
    it('should return default value when config key not found', async () => {
      // Mock database response
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      const result = await configManager.get('UNKNOWN_KEY' as any, 'default');
      
      expect(result).toBe('default');
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock database error
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
      
      const result = await configManager.get('PORT');
      
      expect(result).toBe(3000);
      expect(fastifyMock.log.error).toHaveBeenCalled();
    });
    
    it('should parse JSON values from database', async () => {
      // Mock database response with JSON string
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce({
        key: 'COMPLEX_SETTING',
        value: '{"foo":"bar","baz":123}',
      });
      
      const result = await configManager.get('COMPLEX_SETTING' as any);
      
      expect(result).toEqual({ foo: 'bar', baz: 123 });
    });
    
    it('should use cache for subsequent calls', async () => {
      // Mock database response
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      // First call should hit the database
      const result1 = await configManager.get('PORT');
      expect(result1).toBe(4000);
      expect(fastifyMock.prisma.config.findUnique).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      const result2 = await configManager.get('PORT');
      expect(result2).toBe(4000);
      expect(fastifyMock.prisma.config.findUnique).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('set', () => {
    it('should update config value in database', async () => {
      // Mock database response
      (fastifyMock.prisma.config.upsert as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      const result = await configManager.set('PORT', 4000);
      
      expect(result).toBe(true);
      expect(fastifyMock.prisma.config.upsert).toHaveBeenCalledWith({
        where: { key: 'PORT' },
        update: { value: '4000' },
        create: { key: 'PORT', value: '4000' },
      });
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock database error
      (fastifyMock.prisma.config.upsert as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
      
      const result = await configManager.set('PORT', 4000);
      
      expect(result).toBe(false);
      expect(fastifyMock.log.error).toHaveBeenCalled();
    });
    
    it('should stringify complex objects', async () => {
      // Mock database response
      (fastifyMock.prisma.config.upsert as jest.Mock).mockResolvedValueOnce({
        key: 'COMPLEX_SETTING',
        value: '{"foo":"bar","baz":123}',
      });
      
      const result = await configManager.set('COMPLEX_SETTING' as any, { foo: 'bar', baz: 123 });
      
      expect(result).toBe(true);
      expect(fastifyMock.prisma.config.upsert).toHaveBeenCalledWith({
        where: { key: 'COMPLEX_SETTING' },
        update: { value: '{"foo":"bar","baz":123}' },
        create: { key: 'COMPLEX_SETTING', value: '{"foo":"bar","baz":123}' },
      });
    });
    
    it('should update cache after setting value', async () => {
      // Mock database response
      (fastifyMock.prisma.config.upsert as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      // Set the value
      await configManager.set('PORT', 4000);
      
      // Get should use cache and not hit database
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockClear();
      const result = await configManager.get('PORT');
      
      expect(result).toBe(4000);
      expect(fastifyMock.prisma.config.findUnique).not.toHaveBeenCalled();
    });
  });
  
  describe('reset', () => {
    it('should reset config value to default', async () => {
      // Mock database response
      (fastifyMock.prisma.config.delete as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      const result = await configManager.reset('PORT');
      
      expect(result).toBe(true);
      expect(fastifyMock.prisma.config.delete).toHaveBeenCalledWith({
        where: { key: 'PORT' },
      });
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock database error
      (fastifyMock.prisma.config.delete as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
      
      const result = await configManager.reset('PORT');
      
      expect(result).toBe(false);
      expect(fastifyMock.log.error).toHaveBeenCalled();
    });
    
    it('should update cache after resetting value', async () => {
      // Mock database response
      (fastifyMock.prisma.config.delete as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      // Reset the value
      await configManager.reset('PORT');
      
      // Get should use cache with default value and not hit database
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockClear();
      const result = await configManager.get('PORT');
      
      expect(result).toBe(3000);
      expect(fastifyMock.prisma.config.findUnique).not.toHaveBeenCalled();
    });
  });
  
  describe('listeners', () => {
    it('should notify listeners when config changes', async () => {
      // Create a mock listener
      const listener = jest.fn();
      
      // Add listener
      configManager.addListener('PORT', listener);
      
      // Mock database responses
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (fastifyMock.prisma.config.upsert as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      // Set the value
      await configManager.set('PORT', 4000);
      
      // Listener should be called
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        key: 'PORT',
        oldValue: 3000,
        newValue: 4000,
      }));
    });
    
    it('should notify global listeners for any config change', async () => {
      // Create a mock listener
      const listener = jest.fn();
      
      // Add global listener
      configManager.addListener('*', listener);
      
      // Mock database responses
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (fastifyMock.prisma.config.upsert as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      // Set the value
      await configManager.set('PORT', 4000);
      
      // Listener should be called
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        key: 'PORT',
        oldValue: 3000,
        newValue: 4000,
      }));
    });
    
    it('should remove listeners correctly', async () => {
      // Create a mock listener
      const listener = jest.fn();
      
      // Add listener
      configManager.addListener('PORT', listener);
      
      // Remove listener
      configManager.removeListener('PORT', listener);
      
      // Mock database responses
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (fastifyMock.prisma.config.upsert as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      // Set the value
      await configManager.set('PORT', 4000);
      
      // Listener should not be called
      expect(listener).not.toHaveBeenCalled();
    });
  });
  
  describe('cache management', () => {
    it('should clear cache correctly', async () => {
      // Mock database response
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      // First call should hit the database
      await configManager.get('PORT');
      expect(fastifyMock.prisma.config.findUnique).toHaveBeenCalledTimes(1);
      
      // Clear cache
      configManager.clearCache();
      
      // Mock database response again
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      // Next call should hit the database again
      await configManager.get('PORT');
      expect(fastifyMock.prisma.config.findUnique).toHaveBeenCalledTimes(2);
    });
    
    it('should respect cache TTL', async () => {
      // Set a short cache TTL
      configManager.setCacheTtl(10); // 10ms
      
      // Mock database response
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      // First call should hit the database
      await configManager.get('PORT');
      expect(fastifyMock.prisma.config.findUnique).toHaveBeenCalledTimes(1);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Mock database response again
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      // Next call should hit the database again
      await configManager.get('PORT');
      expect(fastifyMock.prisma.config.findUnique).toHaveBeenCalledTimes(2);
    });
  });
});