import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  username: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
}

/**
 * Audit log service for tracking admin operations
 */
export class AuditLogService {
  private fastify: FastifyInstance;

  /**
   * Create a new audit log service
   *
   * @param fastify Fastify instance
   */
  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Log an admin operation
   *
   * @param entry Audit log entry
   * @returns Created audit log entry
   */
  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    try {
      // Create a new audit log entry
      const id = uuidv4();
      const timestamp = new Date();
      
      // Use raw SQL query since the Prisma client might not be updated yet
      await this.fastify.prisma.$executeRaw`
        INSERT INTO audit_logs (
          id, timestamp, user_id, username, action, resource, resource_id,
          details, ip_address, user_agent, status, error_message
        ) VALUES (
          ${id}, ${timestamp}, ${entry.userId}, ${entry.username},
          ${entry.action}, ${entry.resource}, ${entry.resourceId ?? null},
          ${entry.details ? JSON.stringify(entry.details) : null},
          ${entry.ipAddress ?? null}, ${entry.userAgent ?? null},
          ${entry.status}, ${entry.errorMessage ?? null}
        )
      `;

      // Log to application logs as well
      const logLevel = entry.status === 'success' ? 'info' : 'warn';
      this.fastify.log[logLevel]({
        auditLog: {
          id,
          userId: entry.userId,
          username: entry.username,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          status: entry.status,
        },
      }, `Audit log: ${entry.action} ${entry.resource}${entry.resourceId ? ` (${entry.resourceId})` : ''}`);

      // Return the created entry
      return {
        ...entry,
        id,
        timestamp,
      };
    } catch (error) {
      // Log error but don't fail the operation
      this.fastify.log.error(error, `Failed to create audit log for ${entry.action} ${entry.resource}`);
      
      // Return a fallback entry
      return {
        ...entry,
        id: uuidv4(),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get audit logs with pagination, filtering, and sorting
   *
   * @param options Query options
   * @returns Audit logs and count
   */
  async getAuditLogs(options: {
    page?: number;
    limit?: number;
    userId?: string;
    username?: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    status?: 'success' | 'failure';
    startDate?: Date;
    endDate?: Date;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ logs: AuditLogEntry[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 20,
        userId,
        username,
        action,
        resource,
        resourceId,
        status,
        startDate,
        endDate,
        sortBy = 'timestamp',
        sortOrder = 'desc',
      } = options;

      // Build SQL conditions
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }
      
      if (username) {
        conditions.push('username ILIKE ?');
        params.push(`%${username}%`);
      }
      
      if (action) {
        conditions.push('action ILIKE ?');
        params.push(`%${action}%`);
      }
      
      if (resource) {
        conditions.push('resource ILIKE ?');
        params.push(`%${resource}%`);
      }
      
      if (resourceId) {
        conditions.push('resource_id = ?');
        params.push(resourceId);
      }
      
      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }
      
      if (startDate) {
        conditions.push('timestamp >= ?');
        params.push(startDate);
      }
      
      if (endDate) {
        conditions.push('timestamp <= ?');
        params.push(endDate);
      }

      // Build WHERE clause
      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      // Get total count
      // Use $queryRawUnsafe for dynamic SQL
      const countQuery = `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`;
      const countResult = await this.fastify.prisma.$queryRawUnsafe<[{ count: bigint }]>(countQuery);
      
      const total = Number(countResult[0]?.count || 0);

      // Get paginated results
      const offset = (page - 1) * limit;
      const orderByClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
      
      // Use $queryRawUnsafe for dynamic SQL
      const logsQuery = `
        SELECT * FROM audit_logs
        ${whereClause}
        ${orderByClause}
        LIMIT ${limit} OFFSET ${offset}
      `;
      const logs = await this.fastify.prisma.$queryRawUnsafe<AuditLogEntry[]>(logsQuery);

      // Parse details JSON
      const parsedLogs = logs.map(log => ({
        ...log,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
      }));

      return {
        logs: parsedLogs,
        total,
      };
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get audit logs');
      return { logs: [], total: 0 };
    }
  }

  /**
   * Export audit logs to JSON
   *
   * @param options Query options
   * @returns JSON string of audit logs
   */
  async exportAuditLogs(options: {
    userId?: string;
    username?: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    status?: 'success' | 'failure';
    startDate?: Date;
    endDate?: Date;
  }): Promise<string> {
    try {
      // Get all logs matching the filter (no pagination)
      const { logs } = await this.getAuditLogs({
        ...options,
        limit: 10000, // Set a reasonable limit for export
      });

      return JSON.stringify(logs, null, 2);
    } catch (error) {
      this.fastify.log.error(error, 'Failed to export audit logs');
      throw error;
    }
  }

  /**
   * Get recent activity for a specific user
   *
   * @param userId User ID
   * @param limit Number of entries to return
   * @returns Recent audit log entries
   */
  async getUserActivity(userId: string, limit = 10): Promise<AuditLogEntry[]> {
    try {
      const logs = await this.fastify.prisma.$queryRaw<AuditLogEntry[]>`
        SELECT * FROM audit_logs
        WHERE user_id = ${userId}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;

      // Parse details JSON
      return logs.map(log => ({
        ...log,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
      }));
    } catch (error) {
      this.fastify.log.error(error, `Failed to get activity for user ${userId}`);
      return [];
    }
  }

  /**
   * Get suspicious activities
   *
   * @param threshold Number of failed attempts to consider suspicious
   * @param timeWindow Time window in minutes
   * @returns Suspicious activities
   */
  async getSuspiciousActivities(threshold = 5, timeWindow = 60): Promise<Record<string, unknown>[]> {
    try {
      // Get timestamp for the start of the time window
      const startTime = new Date();
      startTime.setMinutes(startTime.getMinutes() - timeWindow);

      // Get all failed audit logs in the time window
      const logs = await this.fastify.prisma.$queryRaw<AuditLogEntry[]>`
        SELECT * FROM audit_logs
        WHERE status = 'failure' AND timestamp >= ${startTime}
      `;

      // Group by user and IP address
      const groupedByUser: Record<string, AuditLogEntry[]> = {};
      const groupedByIp: Record<string, AuditLogEntry[]> = {};

      logs.forEach(log => {
        // Group by user
        if (log.userId) {
          if (!groupedByUser[log.userId]) {
            groupedByUser[log.userId] = [];
          }
          groupedByUser[log.userId].push(log);
        }

        // Group by IP
        if (log.ipAddress) {
          if (!groupedByIp[log.ipAddress]) {
            groupedByIp[log.ipAddress] = [];
          }
          groupedByIp[log.ipAddress].push(log);
        }
      });

      // Find suspicious users (users with more than threshold failed attempts)
      const suspiciousUsers = Object.entries(groupedByUser)
        .filter(([, userLogs]) => userLogs.length >= threshold)
        .map(([userId, userLogs]) => ({
          type: 'user',
          userId,
          username: userLogs[0].username,
          failedAttempts: userLogs.length,
          lastAttempt: userLogs.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0].timestamp,
          actions: [...new Set(userLogs.map(log => log.action))],
        }));

      // Find suspicious IPs (IPs with more than threshold failed attempts)
      const suspiciousIps = Object.entries(groupedByIp)
        .filter(([, ipLogs]) => ipLogs.length >= threshold)
        .map(([ipAddress, ipLogs]) => ({
          type: 'ip',
          ipAddress,
          failedAttempts: ipLogs.length,
          lastAttempt: ipLogs.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0].timestamp,
          users: [...new Set(ipLogs.map(log => log.username))],
          actions: [...new Set(ipLogs.map(log => log.action))],
        }));

      return [...suspiciousUsers, ...suspiciousIps];
    } catch (error) {
      this.fastify.log.error(error, 'Failed to get suspicious activities');
      return [];
    }
  }
}

/**
 * Factory function to create an audit log service
 *
 * @param fastify Fastify instance
 * @returns Audit log service
 */
export function createAuditLogService(fastify: FastifyInstance): AuditLogService {
  return new AuditLogService(fastify);
}

export default createAuditLogService;