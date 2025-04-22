import { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * API key service for validating and managing API keys
 */
export class ApiKeyService {
  private fastify: FastifyInstance;

  /**
   * Create a new API key service
   * 
   * @param fastify Fastify instance
   */
  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Validate an API key
   * 
   * @param apiKey API key to validate
   * @returns Validation result with key information if valid
   */
  async validateKey(apiKey: string): Promise<{ valid: boolean; keyInfo?: any }> {
    try {
      // Query the database for the API key
      const key = await this.fastify.prisma.apiKey.findUnique({
        where: { key: apiKey },
      });

      // Check if key exists and is enabled
      if (!key || !key.enabled) {
        return { valid: false };
      }

      // Check if key has expired
      if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
        return { valid: false };
      }

      // Update usage statistics
      await this.fastify.prisma.apiKey.update({
        where: { id: key.id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      // Return validation result
      return {
        valid: true,
        keyInfo: {
          id: key.id,
          name: key.name,
          permissions: key.permissions,
        },
      };
    } catch (error) {
      this.fastify.log.error(error, 'API key validation failed');
      return { valid: false };
    }
  }

  /**
   * Extract API key from request
   * 
   * @param request Fastify request
   * @returns API key or null if not found
   */
  extractKeyFromRequest(request: FastifyRequest): string | null {
    // Check header (preferred method)
    const headerKey = request.headers['x-api-key'];
    if (headerKey && typeof headerKey === 'string') {
      return headerKey;
    }

    // Check query parameter
    const queryKey = request.query as any;
    if (queryKey && queryKey.api_key && typeof queryKey.api_key === 'string') {
      return queryKey.api_key;
    }

    // No API key found
    return null;
  }

  /**
   * Create a new API key
   * 
   * @param name Key name
   * @param description Key description
   * @param permissions Key permissions
   * @param expiresAt Expiration date
   * @returns Created API key
   */
  async createKey(
    name: string,
    description?: string,
    permissions: string[] = ['read'],
    expiresAt?: Date
  ) {
    try {
      // Generate a random API key
      const key = this.generateApiKey();

      // Create the API key in the database
      const apiKey = await this.fastify.prisma.apiKey.create({
        data: {
          key,
          name,
          description,
          permissions,
          expiresAt,
        },
      });

      return {
        id: apiKey.id,
        key: apiKey.key,
        name: apiKey.name,
      };
    } catch (error) {
      this.fastify.log.error(error, 'API key creation failed');
      throw error;
    }
  }

  /**
   * Generate a random API key
   * 
   * @returns Random API key
   */
  private generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const segments = [16, 16, 16]; // Three segments of 16 characters
    
    const key = segments
      .map(length => {
        let segment = '';
        for (let i = 0; i < length; i++) {
          segment += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return segment;
      })
      .join('-');
    
    return `nr_${key}`;
  }

  /**
   * Get all API keys
   *
   * @returns Array of all API keys
   */
  async getAllApiKeys(): Promise<any[]> {
    try {
      const apiKeys = await this.fastify.prisma.apiKey.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          permissions: true,
          enabled: true,
          expiresAt: true,
          createdAt: true,
          lastUsedAt: true,
          usageCount: true
        }
      });
      
      return apiKeys.map((key: any) => ({
        ...key,
        // Don't include the actual key value for security
        key: key.id.substring(0, 8) + '...'
      }));
    } catch (error) {
      this.fastify.log.error(error, 'Error getting all API keys');
      return [];
    }
  }

  /**
   * Create a new API key with more options
   *
   * @param options API key creation options
   * @returns Created API key
   */
  async createApiKey(options: {
    name: string;
    description?: string;
    permissions?: string[];
    expiresAt?: Date;
  }) {
    return this.createKey(
      options.name,
      options.description,
      options.permissions,
      options.expiresAt
    );
  }

  /**
   * Revoke an API key
   *
   * @param id API key ID
   * @returns True if revocation was successful
   */
  async revokeApiKey(id: string): Promise<boolean> {
    try {
      await this.fastify.prisma.apiKey.update({
        where: { id },
        data: { enabled: false }
      });
      
      return true;
    } catch (error) {
      this.fastify.log.error(error, `Error revoking API key: ${id}`);
      return false;
    }
  }
}

/**
 * Factory function to create an API key service
 *
 * @param fastify Fastify instance
 * @returns API key service
 */
export function createApiKeyService(fastify: FastifyInstance): ApiKeyService {
  return new ApiKeyService(fastify);
}

export default createApiKeyService;