import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import createApiKeyService from '../services/api-key.js';
import createUserService from '../services/user.js';

/**
 * Authentication plugin for Fastify
 * 
 * This plugin adds authentication middleware to protect routes.
 */
const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Get JWT secret from config
  const jwtSecret = fastify.config.JWT_SECRET ?? 'default-jwt-secret-for-development';
  
  // Register JWT plugin
  await fastify.register(fastifyJwt, {
    secret: jwtSecret,
    sign: {
      expiresIn: '1h' // Default token expiration
    }
  });
  
  // Create services
  const apiKeyService = createApiKeyService(fastify);
  const userService = createUserService(fastify);
  
  // Decorate fastify instance with services
  fastify.decorate('apiKeyService', apiKeyService);
  fastify.decorate('userService', userService);
  
  // Add authentication decorator
  // API key authentication
  fastify.decorate('authenticateApiKey', async (request: FastifyRequest, reply: FastifyReply) => {
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
      request.log.error(error, 'API key authentication failed');
      
      // Return 500
      reply.code(500).send({
        error: 'Authentication failed',
        code: 'INTERNAL_ERROR',
        requestId: request.id,
      });
    }
  });
  
  // JWT authentication
  fastify.decorate('authenticateJwt', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Verify JWT token
      await request.jwtVerify();
      
      // Token is valid, user info is now available in request.user
      
      // Optionally fetch additional user data
      if (request.user && request.user.sub) {
        const userId = request.user.sub as string;
        const userData = await userService.getUserById(userId);
        
        if (!userData) {
          reply.code(401).send({
            error: 'User not found',
            code: 'UNAUTHORIZED',
            requestId: request.id,
          });
          return;
        }
        
        // Add user data to request
        request.userData = userData;
      }
      
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
  
  // Combined authentication (tries JWT first, then API key)
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check for JWT token
      const authHeader = request.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          // Try JWT authentication
          await request.jwtVerify();
          
          // JWT is valid, fetch user data
          if (request.user && request.user.sub) {
            const userId = request.user.sub as string;
            const userData = await userService.getUserById(userId);
            
            if (userData) {
              request.userData = userData;
              return; // Authentication successful
            }
          }
        } catch (jwtError) {
          // JWT authentication failed, try API key next
          request.log.debug(jwtError, 'JWT authentication failed, trying API key');
        }
      }
      
      // Try API key authentication
      const apiKey = apiKeyService.extractKeyFromRequest(request);
      
      if (!apiKey) {
        reply.code(401).send({
          error: 'Authentication required (API key or JWT)',
          code: 'UNAUTHORIZED',
          requestId: request.id,
        });
        return;
      }
      
      // Validate API key
      const { valid, keyInfo } = await apiKeyService.validateKey(apiKey);
      
      if (!valid) {
        reply.code(401).send({
          error: 'Invalid authentication',
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
  
  // Role-based authorization
  fastify.decorate('authorize', (requiredRoles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Check if request has user data or API key info
        const hasUserData = !!request.userData;
        const hasApiKey = !!request.apiKey;
        
        if (!hasUserData && !hasApiKey) {
          reply.code(401).send({
            error: 'Authentication required',
            code: 'UNAUTHORIZED',
            requestId: request.id,
          });
          return;
        }
        
        // Check permissions based on authentication type
        let hasPermission = false;
        
        if (hasUserData) {
          // Check user roles
          hasPermission = requiredRoles.some(role =>
            request.userData?.roles?.includes(role) ?? false
          );
        } else if (hasApiKey) {
          // Check API key permissions
          hasPermission = requiredRoles.every(role =>
            request.apiKey?.permissions?.includes(role) ?? false
          );
        }
        
        // If user doesn't have required roles/permissions, return 403
        if (!hasPermission) {
          reply.code(403).send({
            error: 'Insufficient permissions',
            code: 'FORBIDDEN',
            requestId: request.id,
            requiredRoles,
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
  
  // Permission-based authorization
  fastify.decorate('authorizePermission', (requiredPermissions: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Check if request has user data or API key info
        const hasUserData = !!request.userData;
        const hasApiKey = !!request.apiKey;
        
        if (!hasUserData && !hasApiKey) {
          reply.code(401).send({
            error: 'Authentication required',
            code: 'UNAUTHORIZED',
            requestId: request.id,
          });
          return;
        }
        
        // Check permissions based on authentication type
        let hasPermission = false;
        
        if (hasUserData) {
          // Check user permissions
          hasPermission = requiredPermissions.every(permission =>
            request.userData?.permissions?.includes(permission) ?? false
          );
        } else if (hasApiKey) {
          // Check API key permissions
          hasPermission = requiredPermissions.every(permission =>
            request.apiKey?.permissions?.includes(permission) ?? false
          );
        }
        
        // If user doesn't have required permissions, return 403
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
    userService: ReturnType<typeof createUserService>;
    authenticateApiKey: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateJwt: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (requiredRoles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorizePermission: (requiredPermissions: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  
  interface FastifyRequest {
    apiKey?: {
      id: string;
      name: string;
      permissions: string[];
    };
    userData?: {
      id: string;
      username: string;
      email: string;
      roles: string[];
      permissions: string[];
    };
  }
}

// Add JWT type declarations
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      name: string;
      email: string;
      roles: string[];
      iat: number;
      exp: number;
    };
    user: {
      sub: string;
      name: string;
      email: string;
      roles: string[];
      iat: number;
      exp: number;
    };
  }
}

export default authPlugin;