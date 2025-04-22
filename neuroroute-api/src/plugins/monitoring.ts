import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { performance } from 'perf_hooks';
import os from 'os';

interface MonitoringOptions {
  enableMetrics?: boolean;
  metricsPath?: string;
  collectDefaultMetrics?: boolean;
  enableTracing?: boolean;
  sampleRate?: number;
  alertThresholds?: {
    memoryUsage?: number; // percentage
    cpuUsage?: number; // percentage
    responseTime?: number; // milliseconds
    errorRate?: number; // percentage
  };
  exporters?: {
    prometheus?: boolean;
    console?: boolean;
    custom?: (metrics: any) => void;
  };
}

interface SystemMetrics {
  uptime: number;
  memoryUsage: {
    total: number;
    free: number;
    used: number;
    percentUsed: number;
  };
  cpuUsage: {
    loadAvg: number[];
    percentUsed: number;
  };
  processMemory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

interface RequestMetrics {
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  contentLength?: number;
  userAgent?: string;
  timestamp: number;
}

// Default options
const defaultOptions: MonitoringOptions = {
  enableMetrics: true,
  metricsPath: '/metrics',
  collectDefaultMetrics: true,
  enableTracing: true,
  sampleRate: 1.0, // 100% of requests
  alertThresholds: {
    memoryUsage: 90, // 90% memory usage
    cpuUsage: 80, // 80% CPU usage
    responseTime: 1000, // 1 second
    errorRate: 5, // 5% error rate
  },
  exporters: {
    prometheus: true,
    console: false,
  },
};

// Metrics storage
const requestMetrics: RequestMetrics[] = [];
let errorCount = 0;
let requestCount = 0;
let lastMetricsCheck = Date.now();

// Get system metrics
function getSystemMetrics(): SystemMetrics {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  return {
    uptime: os.uptime(),
    memoryUsage: {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      percentUsed: (usedMemory / totalMemory) * 100,
    },
    cpuUsage: {
      loadAvg: os.loadavg(),
      percentUsed: os.loadavg()[0] * 100 / os.cpus().length,
    },
    processMemory: process.memoryUsage(),
  };
}

// Check for alerts based on thresholds
function checkAlerts(metrics: SystemMetrics, options: MonitoringOptions, log: any): void {
  const { alertThresholds } = options;
  
  if (!alertThresholds) return;
  
  // Check memory usage
  if (alertThresholds.memoryUsage && metrics.memoryUsage.percentUsed > alertThresholds.memoryUsage) {
    log.warn({
      msg: 'Memory usage alert',
      current: metrics.memoryUsage.percentUsed.toFixed(2) + '%',
      threshold: alertThresholds.memoryUsage + '%',
    });
  }
  
  // Check CPU usage
  if (alertThresholds.cpuUsage && metrics.cpuUsage.percentUsed > alertThresholds.cpuUsage) {
    log.warn({
      msg: 'CPU usage alert',
      current: metrics.cpuUsage.percentUsed.toFixed(2) + '%',
      threshold: alertThresholds.cpuUsage + '%',
    });
  }
  
  // Check error rate
  if (alertThresholds.errorRate && requestCount > 0) {
    const currentErrorRate = (errorCount / requestCount) * 100;
    if (currentErrorRate > alertThresholds.errorRate) {
      log.warn({
        msg: 'Error rate alert',
        current: currentErrorRate.toFixed(2) + '%',
        threshold: alertThresholds.errorRate + '%',
        errors: errorCount,
        requests: requestCount,
      });
    }
  }
  
  // Reset counters periodically
  const now = Date.now();
  if (now - lastMetricsCheck > 60000) { // Reset every minute
    errorCount = 0;
    requestCount = 0;
    lastMetricsCheck = now;
  }
}

// Format metrics for Prometheus
function formatPrometheusMetrics(systemMetrics: SystemMetrics, requestMetrics: RequestMetrics[]): string {
  let output = '';
  
  // System metrics
  output += '# HELP system_memory_usage_bytes Memory usage in bytes.\n';
  output += '# TYPE system_memory_usage_bytes gauge\n';
  output += `system_memory_usage_bytes{type="total"} ${systemMetrics.memoryUsage.total}\n`;
  output += `system_memory_usage_bytes{type="free"} ${systemMetrics.memoryUsage.free}\n`;
  output += `system_memory_usage_bytes{type="used"} ${systemMetrics.memoryUsage.used}\n`;
  
  output += '# HELP system_cpu_load_percent CPU load in percent.\n';
  output += '# TYPE system_cpu_load_percent gauge\n';
  output += `system_cpu_load_percent ${systemMetrics.cpuUsage.percentUsed}\n`;
  
  output += '# HELP process_memory_bytes Process memory usage in bytes.\n';
  output += '# TYPE process_memory_bytes gauge\n';
  output += `process_memory_bytes{type="rss"} ${systemMetrics.processMemory.rss}\n`;
  output += `process_memory_bytes{type="heapTotal"} ${systemMetrics.processMemory.heapTotal}\n`;
  output += `process_memory_bytes{type="heapUsed"} ${systemMetrics.processMemory.heapUsed}\n`;
  output += `process_memory_bytes{type="external"} ${systemMetrics.processMemory.external}\n`;
  
  // Request metrics
  output += '# HELP http_request_duration_milliseconds HTTP request duration in milliseconds.\n';
  output += '# TYPE http_request_duration_milliseconds histogram\n';
  
  // Calculate percentiles
  if (requestMetrics.length > 0) {
    const responseTimes = requestMetrics.map(m => m.responseTime).sort((a, b) => a - b);
    const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
    const p90 = responseTimes[Math.floor(responseTimes.length * 0.9)];
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
    
    output += `http_request_duration_milliseconds{quantile="0.5"} ${p50}\n`;
    output += `http_request_duration_milliseconds{quantile="0.9"} ${p90}\n`;
    output += `http_request_duration_milliseconds{quantile="0.95"} ${p95}\n`;
    output += `http_request_duration_milliseconds{quantile="0.99"} ${p99}\n`;
  }
  
  // Request count
  output += '# HELP http_requests_total Total number of HTTP requests.\n';
  output += '# TYPE http_requests_total counter\n';
  output += `http_requests_total ${requestCount}\n`;
  
  // Error count
  output += '# HELP http_request_errors_total Total number of HTTP request errors.\n';
  output += '# TYPE http_request_errors_total counter\n';
  output += `http_request_errors_total ${errorCount}\n`;
  
  return output;
}

const monitoringPlugin: FastifyPluginAsync<MonitoringOptions> = async (fastify, options) => {
  // Merge options with defaults
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Register metrics endpoint if enabled
  if (mergedOptions.enableMetrics) {
    fastify.get(mergedOptions.metricsPath!, async (request, reply) => {
      const systemMetrics = getSystemMetrics();
      const metrics = formatPrometheusMetrics(systemMetrics, requestMetrics);
      reply.type('text/plain').send(metrics);
    });
  }
  
  // Add hooks for request monitoring
  fastify.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done) => {
    // Sample requests based on sample rate
    if (Math.random() <= mergedOptions.sampleRate!) {
      request.metrics = {
        startTime: performance.now(),
      };
    }
    done();
  });
  
  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    requestCount++;
    
    // Only process if we're tracking this request
    if (request.metrics?.startTime) {
      const responseTime = performance.now() - request.metrics.startTime;
      
      // Check if this is an error response
      if (reply.statusCode >= 400) {
        errorCount++;
      }
      
      // Store metrics
      const metric: RequestMetrics = {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime,
        contentLength: reply.getHeader('content-length') as number | undefined,
        userAgent: request.headers['user-agent'],
        timestamp: Date.now(),
      };
      
      requestMetrics.push(metric);
      
      // Keep only the last 1000 requests
      if (requestMetrics.length > 1000) {
        requestMetrics.shift();
      }
      
      // Check response time threshold
      if (mergedOptions.alertThresholds?.responseTime && responseTime > mergedOptions.alertThresholds.responseTime) {
        fastify.log.warn({
          msg: 'Slow response alert',
          url: request.url,
          method: request.method,
          responseTime: responseTime.toFixed(2) + 'ms',
          threshold: mergedOptions.alertThresholds.responseTime + 'ms',
        });
      }
      
      // Log metrics if console exporter is enabled
      if (mergedOptions.exporters?.console) {
        fastify.log.info({
          msg: 'Request metrics',
          ...metric,
        });
      }
      
      // Send to custom exporter if configured
      if (mergedOptions.exporters?.custom) {
        mergedOptions.exporters.custom(metric);
      }
    }
    
    done();
  });
  
  // Periodically check system metrics
  const metricsInterval = setInterval(() => {
    const systemMetrics = getSystemMetrics();
    checkAlerts(systemMetrics, mergedOptions, fastify.log);
    
    // Log system metrics if console exporter is enabled
    if (mergedOptions.exporters?.console) {
      fastify.log.info({
        msg: 'System metrics',
        ...systemMetrics,
      });
    }
  }, 30000); // Check every 30 seconds
  
  // Clean up on close
  fastify.addHook('onClose', (instance, done) => {
    clearInterval(metricsInterval);
    done();
  });
  
  // Expose metrics API
  fastify.decorate('metrics', {
    getSystemMetrics,
    getRequestMetrics: () => requestMetrics,
    getErrorRate: () => requestCount > 0 ? (errorCount / requestCount) * 100 : 0,
  });
};

// Extend FastifyRequest to include metrics
declare module 'fastify' {
  interface FastifyRequest {
    metrics?: {
      startTime: number;
    };
  }
  
  interface FastifyInstance {
    metrics: {
      getSystemMetrics: () => SystemMetrics;
      getRequestMetrics: () => RequestMetrics[];
      getErrorRate: () => number;
    };
  }
}

export default fp(monitoringPlugin, {
  name: 'monitoring',
  fastify: '4.x',
});