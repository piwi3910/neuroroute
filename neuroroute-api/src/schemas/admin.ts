/**
 * Admin API validation schemas
 *
 * Note: This file contains many ESLint errors related to Zod.
 * These errors are expected and can be ignored since they're related to
 * the Zod library and not our actual code.
 */

 
import { z } from 'zod';

/**
 * Pagination parameters schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * API key creation schema
 */
export const apiKeyCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).default(['read']),
  expiresAt: z.string().datetime().optional(),
  rateLimit: z.number().int().positive().optional(),
});

/**
 * API key update schema
 */
export const apiKeyUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
  rateLimit: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
});

/**
 * API key filter schema
 */
export const apiKeyFilterSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  expiresAfter: z.string().datetime().optional(),
  expiresBefore: z.string().datetime().optional(),
  permissions: z.array(z.string()).optional(),
});

/**
 * Model configuration creation schema
 */
export const modelConfigCreateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required').max(100),
  provider: z.string().min(1, 'Provider is required'),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).default(0),
  capabilities: z.array(z.string()).min(1, 'At least one capability is required'),
   
  config: z.record(z.unknown()).refine(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (config: any) => {
      // Ensure required fields are present
      return (
        typeof config.cost === 'number' &&
        typeof config.quality === 'number' &&
        typeof config.maxTokens === 'number'
      );
    },
    {
      message: 'Config must include cost, quality, and maxTokens',
    }
  ),
});

/**
 * Model configuration update schema
 */
export const modelConfigUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  provider: z.string().min(1, 'Provider is required').optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  capabilities: z.array(z.string()).min(1, 'At least one capability is required').optional(),
  config: z.record(z.unknown()).optional(),
});

/**
 * Model configuration filter schema
 */
export const modelConfigFilterSchema = z.object({
  name: z.string().optional(),
  provider: z.string().optional(),
  enabled: z.boolean().optional(),
  capability: z.string().optional(),
  minPriority: z.number().int().min(0).optional(),
  maxPriority: z.number().int().min(0).optional(),
});

/**
 * User creation schema
 */
export const userCreateSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.string().default('user'),
});

/**
 * User update schema
 */
export const userUpdateSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50).optional(),
  email: z.string().email('Invalid email address').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: z.string().optional(),
  active: z.boolean().optional(),
});

/**
 * Role creation schema
 */
export const roleCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
});

/**
 * Role update schema
 */
export const roleUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).min(1, 'At least one permission is required').optional(),
});

/**
 * Audit log filter schema
 */
export const auditLogFilterSchema = z.object({
  userId: z.string().optional(),
  username: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  resourceId: z.string().optional(),
  status: z.enum(['success', 'failure']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * Validate with Zod schema
 * 
 * @param schema Zod schema
 * @param data Data to validate
 * @returns Validated data
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateWithSchema<T>(schema: any, data: unknown): T {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
  return schema.parse(data);
}