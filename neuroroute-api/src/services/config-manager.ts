import { FastifyInstance } from 'fastify';
import { AppConfig } from '../config.js';
import crypto from 'crypto';

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

/**
 * Model configuration interface
 */
export interface ModelConfiguration {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  priority: number;
  capabilities: string[];
  config: Record<string, any>;
}

/**
 * Configuration manager service
 * 
 * This service provides dynamic configuration management with caching,
 * validation, and event-based updates. It also handles secure storage
 * and retrieval of API keys and model configurations.
 */
export class ConfigManager {
  private fastify: FastifyInstance;
  private configCache = new Map<string, any>();
  private modelConfigCache = new Map<string, ModelConfiguration>();
  private listeners = new Map<string, Function[]>();
  private cacheEnabled: boolean;
  private cacheTtl: number; // milliseconds
  private encryptionKey: Buffer;

  /**
   * Create a new configuration manager
   * 
   * @param fastify Fastify instance
   */
  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.cacheEnabled = fastify.config.ENABLE_DYNAMIC_CONFIG;
    this.cacheTtl = 60000; // Default 1 minute
    
    // Initialize encryption key from JWT secret
    // In a production environment, this should use a dedicated encryption key
    const jwtSecret = fastify.config.JWT_SECRET;
    this.encryptionKey = crypto.createHash('sha256').update(jwtSecret).digest();
    
    // Initialize cache with current config
    this.initializeCache();
  }

  /**
   * Initialize the configuration cache
   */
  private initializeCache(): void {
    // Cache all configuration values
    const config = this.fastify.config;
    Object.entries(config).forEach(([key, value]) => {
      this.configCache.set(key, {
        value,
        timestamp: Date.now(),
        expires: Date.now() + this.cacheTtl
      });
    });
  }

  /**
   * Get a configuration value
   * 
   * @param key Configuration key
   * @param defaultValue Default value if key not found
   * @returns Configuration value
   */
  async get<T>(key: keyof AppConfig, defaultValue?: T): Promise<T> {
    // Check if dynamic config is enabled
    if (!this.cacheEnabled) {
      return (this.fastify.config[key] as unknown as T) || defaultValue as T;
    }
    
    // Check cache first
    const cached = this.configCache.get(key as string);
    if (cached && cached.expires > Date.now()) {
      return cached.value as T;
    }
    
    try {
      // Try to get from database
      const dbConfig = await this.fastify.prisma.config.findUnique({
        where: { key: key as string }
      });
      
      if (dbConfig) {
        // Parse the value based on type
        let parsedValue: any;
        try {
          parsedValue = JSON.parse(dbConfig.value);
        } catch (e) {
          // If not valid JSON, use as string
          parsedValue = dbConfig.value;
        }
        
        // Update cache
        this.configCache.set(key as string, {
          value: parsedValue,
          timestamp: Date.now(),
          expires: Date.now() + this.cacheTtl
        });
        
        return parsedValue as T;
      }
      
      // Fall back to environment config
      const envValue = (this.fastify.config[key] as unknown as T) || defaultValue as T;
      
      // Cache the environment value
      this.configCache.set(key as string, {
        value: envValue,
        timestamp: Date.now(),
        expires: Date.now() + this.cacheTtl
      });
      
      return envValue;
    } catch (error) {
      this.fastify.log.error(error, `Error getting config value for ${String(key)}`);
      return (this.fastify.config[key] as unknown as T) || defaultValue as T;
    }
  }

  /**
   * Set a configuration value
   * 
   * @param key Configuration key
   * @param value Configuration value
   * @returns True if successful
   */
  async set<T>(key: keyof AppConfig, value: T): Promise<boolean> {
    try {
      const oldValue = await this.get(key);
      
      // Store in database
      await this.fastify.prisma.config.upsert({
        where: { key: key as string },
        update: { value: JSON.stringify(value) },
        create: { key: key as string, value: JSON.stringify(value) }
      });
      
      // Update cache
      this.configCache.set(key as string, {
        value,
        timestamp: Date.now(),
        expires: Date.now() + this.cacheTtl
      });
      
      // Notify listeners
      this.notifyListeners(key as string, oldValue, value);
      
      return true;
    } catch (error) {
      this.fastify.log.error(error, `Error setting config value for ${String(key)}`);
      return false;
    }
  }

  /**
   * Reset a configuration value to its default
   * 
   * @param key Configuration key
   * @returns True if successful
   */
  async reset(key: keyof AppConfig): Promise<boolean> {
    try {
      const oldValue = await this.get(key);
      
      // Remove from database
      await this.fastify.prisma.config.delete({
        where: { key: key as string }
      }).catch(() => {
        // Ignore if not found
      });
      
      // Get default value
      const defaultValue = this.fastify.config[key];
      
      // Update cache
      this.configCache.set(key as string, {
        value: defaultValue,
        timestamp: Date.now(),
        expires: Date.now() + this.cacheTtl
      });
      
      // Notify listeners
      this.notifyListeners(key as string, oldValue, defaultValue);
      
      return true;
    } catch (error) {
      this.fastify.log.error(error, `Error resetting config value for ${String(key)}`);
      return false;
    }
  }

  /**
   * Clear the configuration cache
   */
  clearCache(): void {
    this.configCache.clear();
    this.initializeCache();
  }

  /**
   * Set the cache TTL
   * 
   * @param ttl Cache TTL in milliseconds
   */
  setCacheTtl(ttl: number): void {
    this.cacheTtl = ttl;
  }

  /**
   * Enable or disable the cache
   * 
   * @param enabled Whether to enable the cache
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
  }

  /**
   * Add a configuration change listener
   * 
   * @param key Configuration key to listen for (or '*' for all)
   * @param listener Listener function
   */
  addListener(key: string | '*', listener: (event: ConfigChangeEvent) => void): void {
    const listeners = this.listeners.get(key) || [];
    listeners.push(listener);
    this.listeners.set(key, listeners);
  }

  /**
   * Remove a configuration change listener
   * 
   * @param key Configuration key
   * @param listener Listener function
   */
  removeListener(key: string, listener: Function): void {
    const listeners = this.listeners.get(key) || [];
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
      this.listeners.set(key, listeners);
    }
  }

  /**
   * Notify listeners of a configuration change
   * 
   * @param key Configuration key
   * @param oldValue Old value
   * @param newValue New value
   */
  private notifyListeners(key: string, oldValue: any, newValue: any): void {
    const event: ConfigChangeEvent = {
      key,
      oldValue,
      newValue,
      timestamp: new Date()
    };
    
    // Notify key-specific listeners
    const keyListeners = this.listeners.get(key) || [];
    keyListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        this.fastify.log.error(error, `Error in config listener for ${key}`);
      }
    });
    
    // Notify global listeners
    const globalListeners = this.listeners.get('*') || [];
    globalListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        this.fastify.log.error(error, `Error in global config listener`);
      }
    });
  }

  /**
   * Get all configuration values
   *
   * @returns All configuration values
   */
  async getAllConfig(): Promise<Record<string, any>> {
    try {
      // Get all config from database
      const dbConfigs = await this.fastify.prisma.config.findMany();
      
      // Start with environment config
      const config: Record<string, any> = { ...this.fastify.config };
      
      // Override with database config
      for (const dbConfig of dbConfigs) {
        try {
          config[dbConfig.key] = JSON.parse(dbConfig.value);
        } catch (e) {
          config[dbConfig.key] = dbConfig.value;
        }
      }
      
      return config;
    } catch (error) {
      this.fastify.log.error(error, 'Error getting all config');
      return { ...this.fastify.config };
    }
  }

  /**
   * Encrypt a sensitive value
   * 
   * @param value Value to encrypt
   * @returns Encrypted value
   */
  private encrypt(value: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt a sensitive value
   * 
   * @param encrypted Encrypted value
   * @returns Decrypted value
   */
  private decrypt(encrypted: string): string {
    try {
      const [ivHex, encryptedValue] = encrypted.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      let decrypted = decipher.update(encryptedValue, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this.fastify.log.error(error, 'Error decrypting value');
      return '';
    }
  }

  /**
   * Get an API key from the database
   * 
   * @param provider Provider name (e.g., 'openai', 'anthropic')
   * @returns API key
   */
  async getApiKey(provider: string): Promise<string | null> {
    try {
      const key = `api_key.${provider.toLowerCase()}`;
      
      // Check cache first
      const cached = this.configCache.get(key);
      if (cached && cached.expires > Date.now()) {
        return this.decrypt(cached.value);
      }
      
      // Try to get from database
      const dbConfig = await this.fastify.prisma.config.findUnique({
        where: { key }
      });
      
      if (dbConfig) {
        // Decrypt the value
        const decrypted = this.decrypt(dbConfig.value);
        
        // Update cache
        this.configCache.set(key, {
          value: dbConfig.value, // Store encrypted value in cache
          timestamp: Date.now(),
          expires: Date.now() + this.cacheTtl
        });
        
        return decrypted;
      }
      
      // Fall back to environment variable
      const envKey = `${provider.toUpperCase()}_API_KEY`;
      const envValue = (this.fastify.config as any)[envKey];
      
      if (envValue) {
        // Store in database for future use
        const encrypted = this.encrypt(envValue);
        await this.setApiKey(provider, envValue);
        return envValue;
      }
      
      return null;
    } catch (error) {
      this.fastify.log.error(error, `Error getting API key for ${provider}`);
      
      // Fall back to environment variable on error
      const envKey = `${provider.toUpperCase()}_API_KEY`;
      return (this.fastify.config as any)[envKey] || null;
    }
  }

  /**
   * Set an API key in the database
   * 
   * @param provider Provider name (e.g., 'openai', 'anthropic')
   * @param apiKey API key
   * @returns True if successful
   */
  async setApiKey(provider: string, apiKey: string): Promise<boolean> {
    try {
      const key = `api_key.${provider.toLowerCase()}`;
      
      // Encrypt the API key
      const encrypted = this.encrypt(apiKey);
      
      // Store in database
      await this.fastify.prisma.config.upsert({
        where: { key },
        update: { value: encrypted },
        create: { key, value: encrypted }
      });
      
      // Update cache
      this.configCache.set(key, {
        value: encrypted,
        timestamp: Date.now(),
        expires: Date.now() + this.cacheTtl
      });
      
      return true;
    } catch (error) {
      this.fastify.log.error(error, `Error setting API key for ${provider}`);
      return false;
    }
  }

  /**
   * Get all API keys
   * 
   * @returns Map of provider names to API keys
   */
  async getAllApiKeys(): Promise<Map<string, string>> {
    try {
      const apiKeys = new Map<string, string>();
      
      // Get all API keys from database
      const dbConfigs = await this.fastify.prisma.config.findMany({
        where: {
          key: {
            startsWith: 'api_key.'
          }
        }
      });
      
      // Process each API key
      for (const dbConfig of dbConfigs) {
        const provider = dbConfig.key.replace('api_key.', '');
        const decrypted = this.decrypt(dbConfig.value);
        apiKeys.set(provider, decrypted);
      }
      
      return apiKeys;
    } catch (error) {
      this.fastify.log.error(error, 'Error getting all API keys');
      return new Map();
    }
  }

  /**
   * Get a model configuration from the database
   * 
   * @param modelId Model ID
   * @returns Model configuration
   */
  async getModelConfig(modelId: string): Promise<ModelConfiguration | null> {
    try {
      // Check cache first
      if (this.modelConfigCache.has(modelId)) {
        return this.modelConfigCache.get(modelId) || null;
      }
      
      // Try to get from database
      const dbConfig = await this.fastify.prisma.modelConfig.findUnique({
        where: { id: modelId }
      });
      
      if (dbConfig) {
        const modelConfig: ModelConfiguration = {
          id: dbConfig.id,
          name: dbConfig.name,
          provider: dbConfig.provider,
          enabled: dbConfig.enabled,
          priority: dbConfig.priority,
          capabilities: dbConfig.capabilities,
          config: dbConfig.config as Record<string, any>
        };
        
        // Update cache
        this.modelConfigCache.set(modelId, modelConfig);
        
        return modelConfig;
      }
      
      return null;
    } catch (error) {
      this.fastify.log.error(error, `Error getting model config for ${modelId}`);
      return null;
    }
  }

  /**
   * Set a model configuration in the database
   * 
   * @param modelConfig Model configuration
   * @returns True if successful
   */
  async setModelConfig(modelConfig: ModelConfiguration): Promise<boolean> {
    try {
      // Store in database
      await this.fastify.prisma.modelConfig.upsert({
        where: { id: modelConfig.id },
        update: {
          name: modelConfig.name,
          provider: modelConfig.provider,
          enabled: modelConfig.enabled,
          priority: modelConfig.priority,
          capabilities: modelConfig.capabilities,
          config: modelConfig.config
        },
        create: {
          id: modelConfig.id,
          name: modelConfig.name,
          provider: modelConfig.provider,
          enabled: modelConfig.enabled,
          priority: modelConfig.priority,
          capabilities: modelConfig.capabilities,
          config: modelConfig.config
        }
      });
      
      // Update cache
      this.modelConfigCache.set(modelConfig.id, modelConfig);
      
      return true;
    } catch (error) {
      this.fastify.log.error(error, `Error setting model config for ${modelConfig.id}`);
      return false;
    }
  }

  /**
   * Get all model configurations
   * 
   * @returns Array of model configurations
   */
  async getAllModelConfigs(): Promise<ModelConfiguration[]> {
    try {
      // Get all model configs from database
      const dbConfigs = await this.fastify.prisma.modelConfig.findMany({
        where: {
          enabled: true
        }
      });
      
      // Process each model config
      const modelConfigs: ModelConfiguration[] = dbConfigs.map(config => ({
        id: config.id,
        name: config.name,
        provider: config.provider,
        enabled: config.enabled,
        priority: config.priority,
        capabilities: config.capabilities,
        config: config.config as Record<string, any>
      }));
      
      // Update cache
      for (const config of modelConfigs) {
        this.modelConfigCache.set(config.id, config);
      }
      
      return modelConfigs;
    } catch (error) {
      this.fastify.log.error(error, 'Error getting all model configs');
      return [];
    }
  }

  /**
   * Clear the model configuration cache
   */
  clearModelConfigCache(): void {
    this.modelConfigCache.clear();
  }

  /**
   * Alias for get method to match naming in admin.ts
   */
  async getConfig<T>(key: keyof AppConfig, defaultValue?: T): Promise<T> {
    return this.get(key, defaultValue);
  }

  /**
   * Alias for set method to match naming in admin.ts
   */
  async setConfig<T>(key: keyof AppConfig, value: T): Promise<boolean> {
    return this.set(key, value);
  }
}

/**
 * Factory function to create a configuration manager
 *
 * @param fastify Fastify instance
 * @returns Configuration manager
 */
export function createConfigManager(fastify: FastifyInstance): ConfigManager {
  return new ConfigManager(fastify);
}

/**
 * Alias for createConfigManager to match naming in admin.ts
 */
export const createConfigManagerService = createConfigManager;

export default createConfigManager;