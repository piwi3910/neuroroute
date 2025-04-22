import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import createCacheService, { CacheService } from '../../src/services/cache';

describe('Cache Service', () => {
  let app: FastifyInstance;
  let cacheService: CacheService;
  let mockRedis: any;

  beforeEach(() => {
    // Create a Fastify instance
    app = Fastify({
      logger: false
    });

    // Mock Redis
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      info: jest.fn()
    };

    // Mock config
    app.decorate('config', {
      ENABLE_CACHE: true,
      REDIS_CACHE_TTL: 300
    });

    // Decorate app with Redis
    app.decorate('redis', mockRedis);

    // Create cache service with default options
    cacheService = createCacheService(app);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('generateKey', () => {
    it('should generate a key with namespace', () => {
      const customCache = createCacheService(app, { namespace: 'test' });
      const key = customCache.generateKey('foo', 'bar');
      
      // Should contain namespace
      expect(key).toContain('test');
      
      // Should be hashed if hashKeys is true (default)
      expect(key.length).toBeLessThan(50); // Hashed keys are shorter
    });

    it('should generate a key without hashing if specified', () => {
      const customCache = createCacheService(app, { 
        namespace: 'test',
        hashKeys: false
      });
      
      const key = customCache.generateKey('foo', 'bar');
      
      // Should contain the original parts
      expect(key).toContain('foo');
      expect(key).toContain('bar');
    });
  });

  describe('get', () => {
    it('should return null if caching is disabled', async () => {
      // Create cache with disabled caching
      const disabledCache = createCacheService(app, { 
        namespace: 'test',
        hashKeys: false
      });
      
      // Disable cache
      (app as any).config.ENABLE_CACHE = false;
      
      const result = await disabledCache.get('test-key');
      
      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should return null if Redis is not available', async () => {
      // Remove Redis
      delete (app as any).redis;
      
      const result = await cacheService.get('test-key');
      
      expect(result).toBeNull();
    });

    it('should return null if key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      const result = await cacheService.get('test-key');
      
      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return value if key exists and is not expired', async () => {
      const now = Date.now();
      const cacheEntry = {
        value: { foo: 'bar' },
        createdAt: now - 1000, // 1 second ago
        expiresAt: now + 60000 // 1 minute in the future
      };
      
      mockRedis.get.mockResolvedValue(JSON.stringify(cacheEntry));
      
      const result = await cacheService.get('test-key');
      
      expect(result).toEqual({ foo: 'bar' });
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should delete and return null if key exists but is expired', async () => {
      const now = Date.now();
      const cacheEntry = {
        value: { foo: 'bar' },
        createdAt: now - 120000, // 2 minutes ago
        expiresAt: now - 60000 // 1 minute ago (expired)
      };
      
      mockRedis.get.mockResolvedValue(JSON.stringify(cacheEntry));
      mockRedis.del.mockResolvedValue(1);
      
      const result = await cacheService.get('test-key');
      
      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    it('should handle errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.get('test-key');
      
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should return false if caching is disabled', async () => {
      // Disable cache
      (app as any).config.ENABLE_CACHE = false;
      
      const result = await cacheService.set('test-key', { foo: 'bar' });
      
      expect(result).toBe(false);
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should return false if Redis is not available', async () => {
      // Remove Redis
      delete (app as any).redis;
      
      const result = await cacheService.set('test-key', { foo: 'bar' });
      
      expect(result).toBe(false);
    });

    it('should set value with default TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');
      
      const result = await cacheService.set('test-key', { foo: 'bar' });
      
      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(String),
        'EX',
        300 // Default TTL from config
      );
      
      // Verify the serialized value contains the correct data
      const serializedArg = mockRedis.set.mock.calls[0][1];
      const parsed = JSON.parse(serializedArg);
      
      expect(parsed).toHaveProperty('value', { foo: 'bar' });
      expect(parsed).toHaveProperty('createdAt');
      expect(parsed).toHaveProperty('expiresAt');
    });

    it('should set value with custom TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');
      
      const result = await cacheService.set('test-key', { foo: 'bar' }, 600);
      
      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'test-key',
        expect.any(String),
        'EX',
        600 // Custom TTL
      );
    });

    it('should include metadata if provided', async () => {
      mockRedis.set.mockResolvedValue('OK');
      
      const metadata = { source: 'test', timestamp: Date.now() };
      const result = await cacheService.set('test-key', { foo: 'bar' }, undefined, metadata);
      
      expect(result).toBe(true);
      
      // Verify the serialized value contains the metadata
      const serializedArg = mockRedis.set.mock.calls[0][1];
      const parsed = JSON.parse(serializedArg);
      
      expect(parsed).toHaveProperty('metadata', metadata);
    });

    it('should handle errors gracefully', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.set('test-key', { foo: 'bar' });
      
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should return false if caching is disabled', async () => {
      // Disable cache
      (app as any).config.ENABLE_CACHE = false;
      
      const result = await cacheService.delete('test-key');
      
      expect(result).toBe(false);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should return false if Redis is not available', async () => {
      // Remove Redis
      delete (app as any).redis;
      
      const result = await cacheService.delete('test-key');
      
      expect(result).toBe(false);
    });

    it('should delete key and return true', async () => {
      mockRedis.del.mockResolvedValue(1);
      
      const result = await cacheService.delete('test-key');
      
      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    it('should handle errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.delete('test-key');
      
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should return false if caching is disabled', async () => {
      // Disable cache
      (app as any).config.ENABLE_CACHE = false;
      
      const result = await cacheService.clear();
      
      expect(result).toBe(false);
      expect(mockRedis.keys).not.toHaveBeenCalled();
    });

    it('should return false if Redis is not available', async () => {
      // Remove Redis
      delete (app as any).redis;
      
      const result = await cacheService.clear();
      
      expect(result).toBe(false);
    });

    it('should clear all keys with prefix and return true', async () => {
      mockRedis.keys.mockResolvedValue(['key1', 'key2', 'key3']);
      mockRedis.del.mockResolvedValue(3);
      
      const result = await cacheService.clear();
      
      expect(result).toBe(true);
      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should handle case with no keys to clear', async () => {
      mockRedis.keys.mockResolvedValue([]);
      
      const result = await cacheService.clear();
      
      expect(result).toBe(true);
      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.clear();
      
      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return empty stats if caching is disabled', async () => {
      // Disable cache
      (app as any).config.ENABLE_CACHE = false;
      
      const result = await cacheService.getStats();
      
      expect(result).toEqual({
        enabled: false,
        count: 0,
        keys: [],
        memory: 0
      });
      expect(mockRedis.keys).not.toHaveBeenCalled();
    });

    it('should return stats with error if Redis is not available', async () => {
      // Remove Redis
      delete (app as any).redis;
      
      const result = await cacheService.getStats();
      
      expect(result).toHaveProperty('enabled', true);
      expect(result).toHaveProperty('error', 'Redis not available');
    });

    it('should return cache stats', async () => {
      mockRedis.keys.mockResolvedValue(['key1', 'key2', 'key3']);
      mockRedis.info.mockResolvedValue('used_memory:1024\r\nother_stat:value');
      
      const result = await cacheService.getStats();
      
      expect(result).toHaveProperty('enabled', true);
      expect(result).toHaveProperty('count', 3);
      expect(result).toHaveProperty('keys', ['key1', 'key2', 'key3']);
      expect(result).toHaveProperty('memory', 1024);
      expect(result).toHaveProperty('prefix');
      expect(result).toHaveProperty('ttl', 300);
    });

    it('should handle errors gracefully', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));
      
      const result = await cacheService.getStats();
      
      expect(result).toHaveProperty('enabled', true);
      expect(result).toHaveProperty('count', 0);
      expect(result).toHaveProperty('error', 'Redis error');
    });
  });
});