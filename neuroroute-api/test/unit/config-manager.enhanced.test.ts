import { FastifyInstance } from 'fastify';
import { ConfigManager, createConfigManager, ModelConfiguration } from '../../src/services/config-manager.js';
import { AppConfig } from '../../src/config.js';

describe('ConfigManager Enhanced Tests', () => {
  let fastifyMock: FastifyInstance;
  let configManager: ConfigManager;
  
  beforeEach(() => {
    // Create a mock Fastify instance
    fastifyMock = {
      log: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
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
        OPENAI_API_KEY: 'test-openai-key',
        ANTHROPIC_API_KEY: 'test-anthropic-key',
      } as AppConfig,
      prisma: {
        config: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
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
  
  describe('API Key Management', () => {
    it('should get API key from database', async () => {
      // Mock database response with encrypted API key
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce({
        key: 'api_key.openai',
        value: 'iv:encrypted', // Simplified for testing
      });
      
      // Mock decrypt method to return a known value
      jest.spyOn(configManager as unknown as { decrypt: (value: string) => string }, 'decrypt')
        .mockReturnValueOnce('sk-test-api_key');
      
      const apiKey = await configManager.getApiKey('openai');
      
      expect(apiKey).toBe('sk-test-api_key');
      expect(fastifyMock.prisma.config.findUnique).toHaveBeenCalledWith({
        where: { key: 'api_key.openai' }
      });
    });
    
    it('should fall back to environment variable if API key not in database', async () => {
      // Mock database response with no API key
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      const apiKey = await configManager.getApiKey('openai');
      
      expect(apiKey).toBe('test-openai-key');
    });
    
    it('should set API key in database with encryption', async () => {
      // Mock encrypt method to return a known value
      jest.spyOn(configManager as unknown as { encrypt: (value: string) => string }, 'encrypt')
        .mockReturnValueOnce('iv:encrypted');
      
      // Mock database upsert
      (fastifyMock.prisma.config.upsert as jest.Mock).mockResolvedValueOnce({
        key: 'api_key.openai',
        value: 'iv:encrypted',
      });
      
      const result = await configManager.setApiKey('openai', 'sk-new-api-key');
      
      expect(result).toBe(true);
      expect(fastifyMock.prisma.config.upsert).toHaveBeenCalledWith({
        where: { key: 'api_key.openai' },
        update: { value: 'iv:encrypted' },
        create: { key: 'api_key.openai', value: 'iv:encrypted' }
      });
    });
    
    it('should get all API keys', async () => {
      // Mock database response with multiple API keys
      (fastifyMock.prisma.config.findMany as jest.Mock).mockResolvedValueOnce([
        { key: 'api_key.openai', value: 'iv:encrypted1' },
        { key: 'api_key.anthropic', value: 'iv:encrypted2' },
      ]);
      
      // Mock decrypt method to return known values
      const decryptSpy = jest.spyOn(configManager as unknown as { decrypt: (value: string) => string }, 'decrypt');
      decryptSpy.mockReturnValueOnce('sk-openai-key');
      decryptSpy.mockReturnValueOnce('sk-anthropic-key');
      
      const apiKeys = await configManager.getAllApiKeys();
      
      expect(apiKeys.size).toBe(2);
      expect(apiKeys.get('openai')).toBe('sk-openai-key');
      expect(apiKeys.get('anthropic')).toBe('sk-anthropic-key');
      expect(fastifyMock.prisma.config.findMany).toHaveBeenCalledWith({
        where: {
          key: {
            startsWith: 'api_key.'
          }
        }
      });
    });
    
    it('should handle database errors when getting API keys', async () => {
      // Mock database error
      (fastifyMock.prisma.config.findMany as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
      
      const apiKeys = await configManager.getAllApiKeys();
      
      expect(apiKeys.size).toBe(0);
      expect(fastifyMock.log.error).toHaveBeenCalled();
    });
  });
  
  describe('Model Configuration Management', () => {
    it('should get model configuration from database', async () => {
      // Mock database response
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce({
        key: 'model.gpt-4',
        value: JSON.stringify({
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          enabled: true,
          priority: 3,
          capabilities: ['text-generation', 'code-generation'],
          config: {
            cost: 0.03,
            quality: 0.95,
            maxTokens: 8192
          }
        }),
      });
      
      const modelConfig = await configManager.getModelConfig('gpt-4');
      
      expect(modelConfig).toEqual({
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        enabled: true,
        priority: 3,
        capabilities: ['text-generation', 'code-generation'],
        config: {
          cost: 0.03,
          quality: 0.95,
          maxTokens: 8192
        }
      });
    });
    
    it('should return null if model configuration not found', async () => {
      // Mock database response
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce(null);
      
      const modelConfig = await configManager.getModelConfig('unknown-model');
      
      expect(modelConfig).toBeNull();
    });
    
    it('should set model configuration in database', async () => {
      // Mock database upsert
      (fastifyMock.prisma.config.upsert as jest.Mock).mockResolvedValueOnce({
        key: 'model.gpt-4',
        value: JSON.stringify({
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          enabled: true,
          priority: 3,
          capabilities: ['text-generation', 'code-generation'],
          config: {
            cost: 0.03,
            quality: 0.95,
            maxTokens: 8192
          }
        }),
      });
      
      const modelConfig: ModelConfiguration = {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        enabled: true,
        priority: 3,
        capabilities: ['text-generation', 'code-generation'],
        config: {
          cost: 0.03,
          quality: 0.95,
          maxTokens: 8192
        }
      };
      
      const result = await configManager.setModelConfig(modelConfig);
      
      expect(result).toBe(true);
      expect(fastifyMock.prisma.config.upsert).toHaveBeenCalledWith({
        where: { key: 'model.gpt-4' },
        update: { value: expect.any(String) },
        create: { key: 'model.gpt-4', value: expect.any(String) }
      });
    });
    
    it('should get all model configurations', async () => {
      // Mock database response
      (fastifyMock.prisma.config.findMany as jest.Mock).mockResolvedValueOnce([
        {
          key: 'model.gpt-4',
          value: JSON.stringify({
            id: 'gpt-4',
            name: 'GPT-4',
            provider: 'openai',
            enabled: true,
            priority: 3,
            capabilities: ['text-generation', 'code-generation'],
            config: {
              cost: 0.03,
              quality: 0.95,
              maxTokens: 8192
            }
          })
        },
        {
          key: 'model.claude-3-opus',
          value: JSON.stringify({
            id: 'claude-3-opus',
            name: 'Claude 3 Opus',
            provider: 'anthropic',
            enabled: true,
            priority: 3,
            capabilities: ['text-generation', 'code-generation'],
            config: {
              cost: 0.025,
              quality: 0.93,
              maxTokens: 100000
            }
          })
        }
      ]);
      
      const modelConfigs = await configManager.getAllModelConfigs();
      
      expect(modelConfigs.length).toBe(2);
      expect(modelConfigs[0].id).toBe('gpt-4');
      expect(modelConfigs[1].id).toBe('claude-3-opus');
      expect(fastifyMock.prisma.config.findMany).toHaveBeenCalledWith({
        where: {
          key: {
            startsWith: 'model.'
          }
        }
      });
    });
    
    it('should handle database errors when getting model configurations', async () => {
      // Mock database error
      (fastifyMock.prisma.config.findMany as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
      
      const modelConfigs = await configManager.getAllModelConfigs();
      
      expect(modelConfigs.length).toBe(0);
      expect(fastifyMock.log.error).toHaveBeenCalled();
    });
  });
  
  describe('Encryption and Decryption', () => {
    it('should encrypt and decrypt values correctly', async () => {
      const originalValue = 'sensitive-data';
      
      // Get access to private methods
      const privateConfigManager = configManager as unknown as {
        encrypt: (value: string) => string;
        decrypt: (encrypted: string) => string;
      };
      
      // Encrypt the value
      const encrypted = privateConfigManager.encrypt(originalValue);
      
      // Decrypt the value
      const decrypted = privateConfigManager.decrypt(encrypted);
      
      // Check that the decrypted value matches the original
      expect(decrypted).toBe(originalValue);
      
      // Check that the encrypted value is different from the original
      expect(encrypted).not.toBe(originalValue);
      
      // Check that the encrypted value contains a colon (IV separator)
      expect(encrypted).toContain(':');
    });
    
    it('should handle decryption errors gracefully', async () => {
      // Get access to private methods
      const privateConfigManager = configManager as unknown as {
        decrypt: (encrypted: string) => string;
      };
      
      // Try to decrypt an invalid value
      const decrypted = privateConfigManager.decrypt('invalid-encrypted-value');
      
      // Should return empty string on error
      expect(decrypted).toBe('');
      expect(fastifyMock.log.error).toHaveBeenCalled();
    });
  });
  
  describe('Event Listeners', () => {
    it('should notify multiple listeners for the same key', async () => {
      // Create mock listeners
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      // Add listeners
      configManager.addListener('PORT', listener1);
      configManager.addListener('PORT', listener2);
      
      // Mock database responses
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (fastifyMock.prisma.config.upsert as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      // Set the value
      await configManager.set('PORT', 4000);
      
      // Both listeners should be called
      expect(listener1).toHaveBeenCalledWith(expect.objectContaining({
        key: 'PORT',
        oldValue: 3000,
        newValue: 4000,
      }));
      expect(listener2).toHaveBeenCalledWith(expect.objectContaining({
        key: 'PORT',
        oldValue: 3000,
        newValue: 4000,
      }));
    });
    
    it('should handle listener errors gracefully', async () => {
      // Create a listener that throws an error
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      
      // Add listener
      configManager.addListener('PORT', errorListener);
      
      // Mock database responses
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (fastifyMock.prisma.config.upsert as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      // Set the value - should not throw
      await configManager.set('PORT', 4000);
      
      // Listener should be called
      expect(errorListener).toHaveBeenCalled();
      
      // Error should be logged
      expect(fastifyMock.log.error).toHaveBeenCalled();
    });
    
    it('should remove listeners correctly', async () => {
      // Create mock listeners
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      // Add listeners
      configManager.addListener('PORT', listener1);
      configManager.addListener('PORT', listener2);
      
      // Remove one listener
      configManager.removeListener('PORT', listener1);
      
      // Mock database responses
      (fastifyMock.prisma.config.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (fastifyMock.prisma.config.upsert as jest.Mock).mockResolvedValueOnce({
        key: 'PORT',
        value: '4000',
      });
      
      // Set the value
      await configManager.set('PORT', 4000);
      
      // Only listener2 should be called
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });
  
  describe('Performance and Edge Cases', () => {
    it('should handle large configuration values', async () => {
      // Create a large object
      const largeObject = {
        data: Array(1000).fill(0).map((_, i) => ({ id: i, value: `value-${i}` }))
      };
      
      // Mock database responses
      (fastifyMock.prisma.config.upsert as jest.Mock).mockResolvedValueOnce({
        key: 'LARGE_CONFIG',
        value: JSON.stringify(largeObject),
      });
      
      // Set the value
      const result = await configManager.set('LARGE_CONFIG' as keyof AppConfig, largeObject);
      
      expect(result).toBe(true);
      expect(fastifyMock.prisma.config.upsert).toHaveBeenCalledWith({
        where: { key: 'LARGE_CONFIG' },
        update: { value: expect.any(String) },
        create: { key: 'LARGE_CONFIG', value: expect.any(String) }
      });
    });
    
    it('should handle concurrent operations correctly', async () => {
      // Mock database responses
      (fastifyMock.prisma.config.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // First get
        .mockResolvedValueOnce(null); // Second get
      
      (fastifyMock.prisma.config.upsert as jest.Mock)
        .mockResolvedValueOnce({
          key: 'CONFIG1',
          value: '1',
        })
        .mockResolvedValueOnce({
          key: 'CONFIG2',
          value: '2',
        });
      
      // Start two operations concurrently
      const promise1 = configManager.set('CONFIG1' as keyof AppConfig, 1);
      const promise2 = configManager.set('CONFIG2' as keyof AppConfig, 2);
      
      // Wait for both to complete
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      
      // Both operations should have completed
      expect(fastifyMock.prisma.config.upsert).toHaveBeenCalledTimes(2);
    });
  });
});