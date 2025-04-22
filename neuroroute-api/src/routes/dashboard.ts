import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getMetrics, resetMetrics, traces } from '../utils/logger';
import os from 'os';

/**
 * Dashboard routes for monitoring and metrics
 */
export default async function dashboardRoutes(fastify: FastifyInstance) {
  // Middleware to ensure admin access
  fastify.addHook('onRequest', async (request, reply) => {
    // Get user from request (set by auth plugin)
    const user = request.user;
    
    // Check if user exists and has admin role
    if (!user || !user.roles.includes('admin')) {
      reply.code(403).send({ error: 'Forbidden: Admin access required' });
      return reply;
    }
  });

  /**
   * Get system metrics
   */
  fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get current metrics
      const metrics = getMetrics();
      
      // Get system metrics
      const systemMetrics = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: {
          cores: os.cpus().length,
          load: os.loadavg(),
          model: os.cpus()[0].model,
        },
        platform: {
          type: os.type(),
          release: os.release(),
          arch: os.arch(),
        },
        network: os.networkInterfaces(),
      };
      
      // Get process metrics
      const processMetrics = {
        pid: process.pid,
        ppid: process.ppid,
        title: process.title,
        argv: process.argv,
        execPath: process.execPath,
        nodeVersion: process.version,
        versions: process.versions,
      };
      
      // Return all metrics
      return reply.send({
        timestamp: new Date().toISOString(),
        application: metrics,
        system: systemMetrics,
        process: processMetrics,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get metrics');
      return reply.code(500).send({ error: 'Failed to get metrics' });
    }
  });

  /**
   * Reset metrics
   */
  fastify.post('/metrics/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Reset metrics
      resetMetrics();
      
      return reply.send({ success: true, message: 'Metrics reset successfully' });
    } catch (error) {
      fastify.log.error(error, 'Failed to reset metrics');
      return reply.code(500).send({ error: 'Failed to reset metrics' });
    }
  });

  /**
   * Get active traces
   */
  fastify.get('/traces', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get all traces
      const allTraces = Object.values(traces);
      
      // Filter by query parameters
      const { type, status, limit } = request.query as any;
      
      let filteredTraces = allTraces;
      
      if (type) {
        filteredTraces = filteredTraces.filter(trace => trace.name === type);
      }
      
      if (status === 'active') {
        filteredTraces = filteredTraces.filter(trace => !trace.endTime);
      } else if (status === 'completed') {
        filteredTraces = filteredTraces.filter(trace => trace.endTime);
      }
      
      // Sort by start time (newest first)
      filteredTraces.sort((a, b) => b.startTime - a.startTime);
      
      // Limit results
      if (limit && !isNaN(parseInt(limit))) {
        filteredTraces = filteredTraces.slice(0, parseInt(limit));
      }
      
      return reply.send({
        count: filteredTraces.length,
        traces: filteredTraces,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get traces');
      return reply.code(500).send({ error: 'Failed to get traces' });
    }
  });

  /**
   * Get model usage metrics
   */
  fastify.get('/models/usage', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get metrics
      const metrics = getMetrics();
      
      // Calculate additional metrics
      const modelMetrics = Object.entries(metrics.models).map(([modelId, data]) => {
        return {
          modelId,
          count: data.count,
          tokensTotal: data.tokensTotal,
          tokensAvg: data.count > 0 ? Math.round(data.tokensTotal / data.count) : 0,
          responseTimeTotal: data.responseTimeTotal,
          responseTimeAvg: data.count > 0 ? Math.round(data.responseTimeTotal / data.count) : 0,
          estimatedCost: 0, // Would calculate based on model pricing
        };
      });
      
      return reply.send({
        timestamp: new Date().toISOString(),
        models: modelMetrics,
        totalModels: modelMetrics.length,
        totalRequests: modelMetrics.reduce((sum, model) => sum + model.count, 0),
        totalTokens: modelMetrics.reduce((sum, model) => sum + model.tokensTotal, 0),
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get model usage metrics');
      return reply.code(500).send({ error: 'Failed to get model usage metrics' });
    }
  });

  /**
   * Get endpoint performance metrics
   */
  fastify.get('/endpoints/performance', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get metrics
      const metrics = getMetrics();
      
      // Calculate additional metrics
      const endpointMetrics = Object.entries(metrics.endpoints).map(([endpoint, data]) => {
        return {
          endpoint,
          count: data.count,
          responseTimeTotal: data.responseTimeTotal,
          responseTimeAvg: data.responseTimeAvg,
          errors: data.errors,
          errorRate: data.count > 0 ? (data.errors / data.count) * 100 : 0,
        };
      });
      
      // Sort by count (descending)
      endpointMetrics.sort((a, b) => b.count - a.count);
      
      return reply.send({
        timestamp: new Date().toISOString(),
        endpoints: endpointMetrics,
        totalEndpoints: endpointMetrics.length,
        totalRequests: metrics.requestCount,
        totalErrors: metrics.errorCount,
        errorRate: metrics.requestCount > 0 ? (metrics.errorCount / metrics.requestCount) * 100 : 0,
        avgResponseTime: metrics.responseTimeAvg,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get endpoint performance metrics');
      return reply.code(500).send({ error: 'Failed to get endpoint performance metrics' });
    }
  });

  /**
   * Get real-time alerts
   */
  fastify.get('/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get metrics
      const metrics = getMetrics();
      
      // Define alert thresholds
      const thresholds = {
        errorRate: 5, // 5% error rate
        responseTime: 1000, // 1000ms response time
        memoryUsage: 80, // 80% memory usage
      };
      
      // Check for alerts
      const alerts = [];
      
      // Check error rate
      const errorRate = metrics.requestCount > 0 ? (metrics.errorCount / metrics.requestCount) * 100 : 0;
      if (errorRate > thresholds.errorRate) {
        alerts.push({
          type: 'error_rate',
          level: 'warning',
          message: `Error rate is ${errorRate.toFixed(2)}%, which is above the threshold of ${thresholds.errorRate}%`,
          value: errorRate,
          threshold: thresholds.errorRate,
        });
      }
      
      // Check response time
      if (metrics.responseTimeAvg > thresholds.responseTime) {
        alerts.push({
          type: 'response_time',
          level: 'warning',
          message: `Average response time is ${metrics.responseTimeAvg.toFixed(2)}ms, which is above the threshold of ${thresholds.responseTime}ms`,
          value: metrics.responseTimeAvg,
          threshold: thresholds.responseTime,
        });
      }
      
      // Check memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      if (memoryUsagePercent > thresholds.memoryUsage) {
        alerts.push({
          type: 'memory_usage',
          level: 'warning',
          message: `Memory usage is ${memoryUsagePercent.toFixed(2)}%, which is above the threshold of ${thresholds.memoryUsage}%`,
          value: memoryUsagePercent,
          threshold: thresholds.memoryUsage,
        });
      }
      
      // Check endpoint error rates
      Object.entries(metrics.endpoints).forEach(([endpoint, data]) => {
        const endpointErrorRate = data.count > 0 ? (data.errors / data.count) * 100 : 0;
        if (endpointErrorRate > thresholds.errorRate) {
          alerts.push({
            type: 'endpoint_error_rate',
            level: 'warning',
            message: `Endpoint ${endpoint} has an error rate of ${endpointErrorRate.toFixed(2)}%, which is above the threshold of ${thresholds.errorRate}%`,
            endpoint,
            value: endpointErrorRate,
            threshold: thresholds.errorRate,
          });
        }
      });
      
      return reply.send({
        timestamp: new Date().toISOString(),
        alerts,
        count: alerts.length,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get alerts');
      return reply.code(500).send({ error: 'Failed to get alerts' });
    }
  });
}