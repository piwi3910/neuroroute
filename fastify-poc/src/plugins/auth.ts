import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import createApiKeyService from '../services/api-key';

/**
 * Authentication plugin for Fastify
 * 
 * This plugin adds authentication middleware to protect routes.
 */
const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Create API key service
  const apiKeyService = createApiKeyService(fastify);
  
  // Decorate fastify instance with the API key service
  fastify.decorate('apiKeyService', apiKeyService);
  
  // Add authentication decorator
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Extract API key from request
      const apiKey = apiKeyService.extractKeyFromRequest(request);
      
      // If no API key is provided, return 401
      if (!apiKey) {
        reply.code(401).send({
          error: 'API key is required',
          code: 'UNAUTHORIZED',
          requestId: request.id,
        });
        return;
      }
      
      // Validate API key
      const { valid, keyInfo } = await apiKeyService.validateKey(apiKey);
      
      // If API key is invalid, return 401
      if (!valid) {
        reply.code(401).send({
          error: 'Invalid API key',
          code: 'UNAUTHORIZED',
          requestId: request.id,
        });
        return;
      }
      
      // Add API key info to request
      request.apiKey = keyInfo;
      
    } catch (error) {
      // Log error
      request.log.error(error, 'Authentication failed');
      
      // Return 500
      reply.code(500).send({
        error: 'Authentication failed',
        code: 'INTERNAL_ERROR',
        requestId: request.id,
      });
    }
  });
  
  // Add authorization decorator
  fastify.decorate('authorize', (requiredPermissions: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Check if request has API key info
        if (!request.apiKey) {
          reply.code(401).send({
            error: 'Authentication required',
            code: 'UNAUTHORIZED',
            requestId: request.id,
          });
          return;
        }
        
        // Check if API key has required permissions
        const hasPermission = requiredPermissions.every(permission =>
          request.apiKey?.permissions?.includes(permission) ?? false
        );
        
        // If API key doesn't have required permissions, return 403
        if (!hasPermission) {
          reply.code(403).send({
            error: 'Insufficient permissions',
            code: 'FORBIDDEN',
            requestId: request.id,
            requiredPermissions,
          });
          return;
        }
        
      } catch (error) {
        // Log error
        request.log.error(error, 'Authorization failed');
        
        // Return 500
        reply.code(500).send({
          error: 'Authorization failed',
          code: 'INTERNAL_ERROR',
          requestId: request.id,
        });
      }
    };
  });
  
  fastify.log.info('Authentication plugin registered');
};

// Add type declarations
declare module 'fastify' {
  interface FastifyInstance {
    apiKeyService: ReturnType<typeof createApiKeyService>;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (requiredPermissions: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  
  interface FastifyRequest {
    apiKey?: {
      id: string;
      name: string;
      permissions: string[];
    };
  }
}

export default authPlugin;