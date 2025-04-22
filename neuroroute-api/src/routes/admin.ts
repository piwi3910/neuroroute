import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { validateWithSchema } from '../schemas/admin.js';
import { paginationSchema, apiKeyFilterSchema } from '../schemas/admin.js';
import { createAuditLogService } from '../services/audit-log.js';

/**
 * Admin API routes
 * 
 * These routes are used for managing API keys, model configurations,
 * and audit logs.
 */
const adminRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
  // Create audit log service
  const auditLogService = createAuditLogService(fastify);

  // Middleware to check admin permissions
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Skip auth check for OPTIONS requests (CORS preflight)
      if (request.method === 'OPTIONS') {
        return;
      }

      // Check if user is authenticated
      if (!request.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      // Check if user has admin role
      if (!request.user.roles?.includes('admin')) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Admin access required',
          code: 'FORBIDDEN',
        });
      }
    } catch (error) {
      fastify.log.error(error, 'Error in admin auth middleware');
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'An error occurred while checking admin permissions',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  // Rate limiting for admin routes
  // Commented out until @fastify/rate-limit is installed
  /*
  fastify.register(import('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request: FastifyRequest) => {
      return request.user?.sub ?? request.ip;
    },
    errorResponseBuilder: () => ({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
    }),
  });
  */

  /**
   * API Key Management Routes
   */

  // Get all API keys with pagination, filtering, and sorting
  fastify.get('/api-keys', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate query parameters
      const query = validateWithSchema(paginationSchema, request.query);
      const filter = validateWithSchema(apiKeyFilterSchema, request.query);

      // Get API keys from database
      const { apiKeys, total } = await fastify.prisma.$transaction(async (tx: any) => {
        // Build where clause
        const where: Record<string, any> = {};
        
        if (filter.name) where.name = { contains: filter.name, mode: 'insensitive' };
        if (filter.enabled !== undefined) where.enabled = filter.enabled;
        if (filter.permissions) where.permissions = { hasEvery: filter.permissions };
        
        // Date filters
        if (filter.createdAfter || filter.createdBefore) {
          where.createdAt = {};
          if (filter.createdAfter) where.createdAt.gte = new Date(filter.createdAfter as string);
          if (filter.createdBefore) where.createdAt.lte = new Date(filter.createdBefore as string);
        }
        
        if (filter.expiresAfter || filter.expiresBefore) {
          where.expiresAt = {};
          if (filter.expiresAfter) where.expiresAt.gte = new Date(filter.expiresAfter as string);
          if (filter.expiresBefore) where.expiresAt.lte = new Date(filter.expiresBefore as string);
        }

        // Get total count
        const total = await tx.apiKey.count({ where });

        // Get paginated results
        const apiKeys = await tx.apiKey.findMany({
          where,
          orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          select: {
            id: true,
            name: true,
            description: true,
            permissions: true,
            enabled: true,
            createdAt: true,
            updatedAt: true,
            expiresAt: true,
            lastUsedAt: true,
            rateLimit: true,
            // Don't include the actual key for security
          },
        });

        return { apiKeys, total };
      });

      // Log audit event
      await auditLogService.log({
        userId: request.user?.sub ?? 'unknown',
        username: request.user?.name ?? 'unknown',
        action: 'list',
        resource: 'api_keys',
        status: 'success',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? 'unknown',
      });

      // Return response
      return reply.send({
        data: apiKeys,
        meta: {
          total,
          page: query.page,
          limit: query.limit,
          pages: Math.ceil(total / query.limit),
        },
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error(err, 'Error getting API keys');
      
      // Log audit event
      await auditLogService.log({
        userId: request.user?.sub ?? 'unknown',
        username: request.user?.name ?? 'unknown',
        action: 'list',
        resource: 'api_keys',
        status: 'failure',
        errorMessage: err.message,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? 'unknown',
      });

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'An error occurred while getting API keys',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  // More routes will be added here for API key management and model configuration

};

// Add type declaration for user property in FastifyRequest
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      sub: string;
      name: string;
      email: string;
      roles: string[];
      iat: number;
      exp: number;
    };
  }
}

export default adminRoutes;
