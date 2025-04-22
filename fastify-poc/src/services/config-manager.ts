import { FastifyInstance } from 'fastify';
import { AppConfig } from '../config';

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
 * Configuration manager service
 * 
 * This service provides dynamic configuration management with caching,
 * validation, and event-based updates.
 */
export class ConfigManager {
  private fastify: FastifyInstance;
  private configCache: Map<string, any> = new Map();
  private listeners: Map<string, Function[]> = new Map();
  private cacheEnabled: boolean;
  private cacheTtl: number; // milliseconds

  /**
   * Create a new configuration manager
   * 
   * @param fastify Fastify instance
   */
  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.cacheEnabled = fastify.config.ENABLE_DYNAMIC_CONFIG;
    this.cacheTtl = 60000; // Default 1 minute
    
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
      this.fastify.log.error(error, `Error getting config value for ${key}`);
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
      this.fastify.log.error(error, `Error setting config value for ${key}`);
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
      this.fastify.log.error(error, `Error resetting config value for ${key}`);
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