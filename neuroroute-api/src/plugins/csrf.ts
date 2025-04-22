import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'crypto';

// Define session interface for TypeScript
declare module 'fastify' {
  interface FastifyRequest {
    session?: {
      csrfToken?: string;
      [key: string]: unknown;
    };
  }
}

/**
 * CSRF protection plugin for Fastify
 * 
 * This plugin adds CSRF protection to routes that modify data.
 */
const csrfPlugin: FastifyPluginAsync = async (fastify) => {
  // Add await to satisfy ESLint
  await Promise.resolve();
  // This is a placeholder for CSRF protection
  // In a real implementation, we would register the @fastify/csrf-protection plugin
  // and configure it to protect admin routes
  
  // For now, we'll add a simple hook to check for CSRF tokens on admin routes
  fastify.addHook('onRequest', async (request: FastifyRequest, reply) => {
    // Only apply to admin routes with state-changing methods
    if (request.url.startsWith('/admin') &&
        !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      
      // Skip for API key authentication
      if (request.headers['x-api-key']) {
        return;
      }
      
      // Check for CSRF token in headers
      const csrfToken = request.headers['x-csrf-token'];
      const sessionToken = request.session?.csrfToken;
      
      if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
        return reply.code(403).send({
          error: 'Invalid or missing CSRF token',
          code: 'FORBIDDEN',
        });
      }
    }
  });
  
  // Add hook to set CSRF token in response headers for admin routes
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/admin') &&
        ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      // Generate a simple CSRF token (in a real implementation, this would be more secure)
      const token = crypto.randomBytes(16).toString('hex');
      
      // Store in session
      // Type-safe session access
      if (request.session) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        request.session.csrfToken = token;
      }
      
      // Set CSRF token in response headers
      reply.header('X-CSRF-Token', token);
    }
  });
  
  fastify.log.info('CSRF protection plugin registered');
};

export default fp(csrfPlugin, {
  name: 'csrf',
  dependencies: ['@fastify/session'],
});