import { FastifyInstance } from 'fastify';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * User data interface
 */
export interface UserData {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User creation data
 */
export interface UserCreateData {
  username: string;
  email: string;
  password: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * User service for managing users
 */
export class UserService {
  private fastify: FastifyInstance;

  /**
   * Create a new user service
   * 
   * @param fastify Fastify instance
   */
  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Get a user by ID
   * 
   * @param id User ID
   * @returns User data or null if not found
   */
  async getUserById(id: string): Promise<UserData | null> {
    try {
      const user = await this.fastify.prisma.user.findUnique({
        where: { id },
        include: {
          userRoles: {
            include: {
              role: true
            }
          },
          userPermissions: {
            include: {
              permission: true
            }
          }
        }
      });

      if (!user) {
        return null;
      }

      // Transform database model to UserData
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.userRoles.map((ur: any) => ur.role.name),
        permissions: user.userPermissions.map((up: any) => up.permission.name),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    } catch (error) {
      this.fastify.log.error(error, `Error getting user by ID: ${id}`);
      return null;
    }
  }

  /**
   * Get a user by username
   * 
   * @param username Username
   * @returns User data or null if not found
   */
  async getUserByUsername(username: string): Promise<UserData | null> {
    try {
      const user = await this.fastify.prisma.user.findUnique({
        where: { username },
        include: {
          userRoles: {
            include: {
              role: true
            }
          },
          userPermissions: {
            include: {
              permission: true
            }
          }
        }
      });

      if (!user) {
        return null;
      }

      // Transform database model to UserData
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.userRoles.map((ur: any) => ur.role.name),
        permissions: user.userPermissions.map((up: any) => up.permission.name),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    } catch (error) {
      this.fastify.log.error(error, `Error getting user by username: ${username}`);
      return null;
    }
  }

  /**
   * Create a new user
   * 
   * @param userData User data
   * @returns Created user data or null if creation failed
   */
  async createUser(userData: UserCreateData): Promise<UserData | null> {
    try {
      // Hash the password
      const { hash, salt } = this.hashPassword(userData.password);

      // Create the user
      const user = await this.fastify.prisma.user.create({
        data: {
          username: userData.username,
          email: userData.email,
          passwordHash: hash,
          passwordSalt: salt,
        }
      });

      // Add roles if provided
      if (userData.roles && userData.roles.length > 0) {
        await this.assignRolesToUser(user.id, userData.roles);
      } else {
        // Assign default role
        await this.assignRolesToUser(user.id, ['user']);
      }

      // Add permissions if provided
      if (userData.permissions && userData.permissions.length > 0) {
        await this.assignPermissionsToUser(user.id, userData.permissions);
      }

      // Return the created user
      return this.getUserById(user.id);
    } catch (error) {
      this.fastify.log.error(error, `Error creating user: ${userData.username}`);
      return null;
    }
  }

  /**
   * Authenticate a user
   * 
   * @param username Username
   * @param password Password
   * @returns User data if authentication successful, null otherwise
   */
  async authenticateUser(username: string, password: string): Promise<UserData | null> {
    try {
      // Get the user
      const user = await this.fastify.prisma.user.findUnique({
        where: { username }
      });

      if (!user) {
        return null;
      }

      // Verify the password
      const isValid = this.verifyPassword(password, user.passwordHash, user.passwordSalt);

      if (!isValid) {
        return null;
      }

      // Return the user data
      return this.getUserById(user.id);
    } catch (error) {
      this.fastify.log.error(error, `Error authenticating user: ${username}`);
      return null;
    }
  }

  /**
   * Generate a JWT token for a user
   * 
   * @param user User data
   * @param expiresIn Token expiration time (default: 1h)
   * @returns JWT token
   */
  generateToken(user: UserData, expiresIn: string = '1h'): string {
    return this.fastify.jwt.sign(
      {
        sub: user.id,
        name: user.username,
        email: user.email,
        roles: user.roles,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (3600) // 1 hour from now
      },
      { expiresIn }
    );
  }

  /**
   * Assign roles to a user
   * 
   * @param userId User ID
   * @param roleNames Role names
   */
  private async assignRolesToUser(userId: string, roleNames: string[]): Promise<void> {
    try {
      // Get role IDs
      const roles = await this.fastify.prisma.role.findMany({
        where: {
          name: {
            in: roleNames
          }
        }
      });

      // Create role assignments
      await Promise.all(
        roles.map((role: any) =>
          this.fastify.prisma.userRole.create({
            data: {
              userId,
              roleId: role.id
            }
          })
        )
      );
    } catch (error) {
      this.fastify.log.error(error, `Error assigning roles to user: ${userId}`);
      throw error;
    }
  }

  /**
   * Assign permissions to a user
   * 
   * @param userId User ID
   * @param permissionNames Permission names
   */
  private async assignPermissionsToUser(userId: string, permissionNames: string[]): Promise<void> {
    try {
      // Get permission IDs
      const permissions = await this.fastify.prisma.permission.findMany({
        where: {
          name: {
            in: permissionNames
          }
        }
      });

      // Create permission assignments
      await Promise.all(
        permissions.map((permission: any) =>
          this.fastify.prisma.userPermission.create({
            data: {
              userId,
              permissionId: permission.id
            }
          })
        )
      );
    } catch (error) {
      this.fastify.log.error(error, `Error assigning permissions to user: ${userId}`);
      throw error;
    }
  }

  /**
   * Hash a password
   * 
   * @param password Password to hash
   * @returns Hash and salt
   */
  private hashPassword(password: string): { hash: string; salt: string } {
    // Generate a random salt
    const salt = randomBytes(16).toString('hex');
    
    // Hash the password with the salt
    const hash = scryptSync(password, salt, 64).toString('hex');
    
    return { hash, salt };
  }

  /**
   * Verify a password
   * 
   * @param password Password to verify
   * @param storedHash Stored password hash
   * @param salt Salt used for hashing
   * @returns True if password is valid
   */
  private verifyPassword(password: string, storedHash: string, salt: string): boolean {
    // Hash the provided password with the stored salt
    const hashedBuffer = scryptSync(password, salt, 64);
    
    // Convert the stored hash to a buffer
    const storedHashBuffer = Buffer.from(storedHash, 'hex');
    
    // Compare the hashes using a timing-safe comparison
    return hashedBuffer.length === storedHashBuffer.length && 
           timingSafeEqual(hashedBuffer, storedHashBuffer);
  }
  /**
   * Get all users
   *
   * @returns Array of all users
   */
  async getAllUsers(): Promise<UserData[]> {
    try {
      const users = await this.fastify.prisma.user.findMany({
        include: {
          userRoles: {
            include: {
              role: true
            }
          },
          userPermissions: {
            include: {
              permission: true
            }
          }
        }
      });

      // Transform database models to UserData
      return users.map((user: any) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.userRoles.map((ur: any) => ur.role.name),
        permissions: user.userPermissions.map((up: any) => up.permission.name),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));
    } catch (error) {
      this.fastify.log.error(error, 'Error getting all users');
      return [];
    }
  }

  /**
   * Update a user
   *
   * @param id User ID
   * @param userData User data to update
   * @returns Updated user data or null if update failed
   */
  async updateUser(id: string, userData: Partial<UserCreateData> & { active?: boolean }): Promise<UserData | null> {
    try {
      // Prepare update data
      const updateData: any = {};
      
      if (userData.username) {
        updateData.username = userData.username;
      }
      
      if (userData.email) {
        updateData.email = userData.email;
      }
      
      if (userData.password) {
        const { hash, salt } = this.hashPassword(userData.password);
        updateData.passwordHash = hash;
        updateData.passwordSalt = salt;
      }
      
      if (userData.active !== undefined) {
        updateData.active = userData.active;
      }
      
      // Update the user
      await this.fastify.prisma.user.update({
        where: { id },
        data: updateData
      });
      
      // Update roles if provided
      if (userData.roles && userData.roles.length > 0) {
        // Remove existing roles
        await this.fastify.prisma.userRole.deleteMany({
          where: { userId: id }
        });
        
        // Assign new roles
        await this.assignRolesToUser(id, userData.roles);
      }
      
      // Update permissions if provided
      if (userData.permissions && userData.permissions.length > 0) {
        // Remove existing permissions
        await this.fastify.prisma.userPermission.deleteMany({
          where: { userId: id }
        });
        
        // Assign new permissions
        await this.assignPermissionsToUser(id, userData.permissions);
      }
      
      // Return the updated user
      return this.getUserById(id);
    } catch (error) {
      this.fastify.log.error(error, `Error updating user: ${id}`);
      return null;
    }
  }

  /**
   * Delete a user
   *
   * @param id User ID
   * @returns True if deletion was successful
   */
  async deleteUser(id: string): Promise<boolean> {
    try {
      // Delete user roles and permissions first
      await this.fastify.prisma.userRole.deleteMany({
        where: { userId: id }
      });
      
      await this.fastify.prisma.userPermission.deleteMany({
        where: { userId: id }
      });
      
      // Delete the user
      await this.fastify.prisma.user.delete({
        where: { id }
      });
      
      return true;
    } catch (error) {
      this.fastify.log.error(error, `Error deleting user: ${id}`);
      return false;
    }
  }

  /**
   * Get all roles
   *
   * @returns Array of all roles
   */
  async getAllRoles(): Promise<any[]> {
    try {
      const roles = await this.fastify.prisma.role.findMany({
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          }
        }
      });
      
      return roles.map((role: any) => ({
        id: role.id,
        name: role.name,
        permissions: role.rolePermissions.map((rp: any) => rp.permission.name),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      }));
    } catch (error) {
      this.fastify.log.error(error, 'Error getting all roles');
      return [];
    }
  }

  /**
   * Get a role by ID
   *
   * @param id Role ID
   * @returns Role data or null if not found
   */
  async getRoleById(id: string): Promise<any | null> {
    try {
      const role = await this.fastify.prisma.role.findUnique({
        where: { id },
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          }
        }
      });
      
      if (!role) {
        return null;
      }
      
      return {
        id: role.id,
        name: role.name,
        permissions: role.rolePermissions.map((rp: any) => rp.permission.name),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      };
    } catch (error) {
      this.fastify.log.error(error, `Error getting role by ID: ${id}`);
      return null;
    }
  }

  /**
   * Create a new role
   *
   * @param name Role name
   * @param permissions Role permissions
   * @returns Created role data or null if creation failed
   */
  async createRole(name: string, permissions: string[]): Promise<any | null> {
    try {
      // Create the role
      const role = await this.fastify.prisma.role.create({
        data: {
          name
        }
      });
      
      // Get permission IDs
      const permissionEntities = await this.fastify.prisma.permission.findMany({
        where: {
          name: {
            in: permissions
          }
        }
      });
      
      // Create permission assignments
      await Promise.all(
        permissionEntities.map((permission: any) =>
          this.fastify.prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permission.id
            }
          })
        )
      );
      
      // Return the created role
      return this.getRoleById(role.id);
    } catch (error) {
      this.fastify.log.error(error, `Error creating role: ${name}`);
      return null;
    }
  }

  /**
   * Update a role
   *
   * @param id Role ID
   * @param data Role data to update
   * @returns Updated role data or null if update failed
   */
  async updateRole(id: string, data: { name?: string; permissions?: string[] }): Promise<any | null> {
    try {
      // Update role name if provided
      if (data.name) {
        await this.fastify.prisma.role.update({
          where: { id },
          data: { name: data.name }
        });
      }
      
      // Update permissions if provided
      if (data.permissions && data.permissions.length > 0) {
        // Remove existing permissions
        await this.fastify.prisma.rolePermission.deleteMany({
          where: { roleId: id }
        });
        
        // Get permission IDs
        const permissionEntities = await this.fastify.prisma.permission.findMany({
          where: {
            name: {
              in: data.permissions
            }
          }
        });
        
        // Create permission assignments
        await Promise.all(
          permissionEntities.map((permission: any) =>
            this.fastify.prisma.rolePermission.create({
              data: {
                roleId: id,
                permissionId: permission.id
              }
            })
          )
        );
      }
      
      // Return the updated role
      return this.getRoleById(id);
    } catch (error) {
      this.fastify.log.error(error, `Error updating role: ${id}`);
      return null;
    }
  }

  /**
   * Delete a role
   *
   * @param id Role ID
   * @returns True if deletion was successful
   */
  async deleteRole(id: string): Promise<boolean> {
    try {
      // Delete role permissions first
      await this.fastify.prisma.rolePermission.deleteMany({
        where: { roleId: id }
      });
      
      // Delete user roles
      await this.fastify.prisma.userRole.deleteMany({
        where: { roleId: id }
      });
      
      // Delete the role
      await this.fastify.prisma.role.delete({
        where: { id }
      });
      
      return true;
    } catch (error) {
      this.fastify.log.error(error, `Error deleting role: ${id}`);
      return false;
    }
  }

  /**
   * Get all permissions
   *
   * @returns Array of all permissions
   */
  async getAllPermissions(): Promise<any[]> {
    try {
      const permissions = await this.fastify.prisma.permission.findMany();
      
      return permissions.map((permission: any) => ({
        id: permission.id,
        name: permission.name,
        description: permission.description,
        createdAt: permission.createdAt,
        updatedAt: permission.updatedAt
      }));
    } catch (error) {
      this.fastify.log.error(error, 'Error getting all permissions');
      return [];
    }
  }
}

/**
 * Factory function to create a user service
 *
 * @param fastify Fastify instance
 * @returns User service
 */
export function createUserService(fastify: FastifyInstance): UserService {
  return new UserService(fastify);
}

export default createUserService;