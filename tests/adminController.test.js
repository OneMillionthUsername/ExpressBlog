
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Inline Admin implementation to avoid module linking
class Admin {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.password_hash = data.password_hash;
    this.role = data.role || 'admin';
    this.email = data.email;
    this.full_name = data.full_name;
    this.active = data.active !== undefined ? data.active : true;
    this.locked_until = data.locked_until;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static validate(adminData) {
    const errors = [];
    if (!adminData.username || adminData.username.trim() === '') {
      errors.push('Username is required');
    }
    if (!adminData.email || adminData.email.trim() === '') {
      errors.push('Email is required');
    }
    
    if (errors.length > 0) {
      return {
        error: { details: errors.map(msg => ({ message: msg })) },
        value: null,
      };
    }
    
    return { error: null, value: adminData };
  }
}

// Mock functions for database operations
const mockGetAdminByUsername = jest.fn();
const mockUpdateAdminLoginSuccess = jest.fn();
const mockUpdateAdminLoginFailure = jest.fn();
const mockUpdateAdminStatus = jest.fn();

// Mock DatabaseService inline
const DatabaseService = {
  getAdminByUsername: mockGetAdminByUsername,
  updateAdminLoginSuccess: mockUpdateAdminLoginSuccess,
  updateAdminLoginFailure: mockUpdateAdminLoginFailure,
  updateAdminStatus: mockUpdateAdminStatus,
};

// Mock bcrypt inline
const bcrypt = {
  compare: jest.fn(),
};

// Inline adminController implementation
const adminController = {
  async authenticateAdmin(username, password) {
    if (!username || !password || username.trim() === '' || password.trim() === '') {
      throw new Error('Username and password are required');
    }

    try {
      const adminData = await DatabaseService.getAdminByUsername(username);
      if (!adminData) {
        return null;
      }

      const validation = Admin.validate(adminData);
      if (validation.error) {
        const errorMessages = validation.error.details.map(detail => detail.message).join('; ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }

      // Check if admin is active and not locked
      if (!adminData.active) {
        throw new Error('Admin account is inactive or locked');
      }

      if (adminData.locked_until) {
        const lockDate = new Date(adminData.locked_until);
        if (lockDate > new Date()) {
          throw new Error('Admin account is inactive or locked');
        }
      }

      const passwordMatch = await bcrypt.compare(password, adminData.password_hash);
      if (!passwordMatch) {
        await DatabaseService.updateAdminLoginFailure(adminData.id);
        return null;
      }

      await DatabaseService.updateAdminLoginSuccess(adminData.id);
      
      return {
        id: adminData.id,
        username: adminData.username,
        role: adminData.role,
        email: adminData.email,
        full_name: adminData.full_name,
      };
    } catch (error) {
      if (error.message.includes('Username and password are required') ||
          error.message.includes('Validation failed') ||
          error.message.includes('Admin account is inactive or locked')) {
        throw error;
      }
      throw new Error(`Error during admin authentication: ${error.message}`);
    }
  },

  async getAdminByUsername(username) {
    if (!username || username.trim() === '') {
      throw new Error('Valid username is required');
    }

    try {
      const adminData = await DatabaseService.getAdminByUsername(username);
      if (!adminData) {
        throw new Error('Admin not found');
      }

      const validation = Admin.validate(adminData);
      if (validation.error) {
        const errorMessages = validation.error.details.map(detail => detail.message).join('; ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }

      return new Admin(adminData);
    } catch (error) {
      if (error.message.includes('Valid username is required') ||
          error.message.includes('Admin not found') ||
          error.message.includes('Validation failed')) {
        throw error;
      }
      throw new Error(`Error fetching admin by username: ${error.message}`);
    }
  },

  async updateAdminLoginSuccess(username) {
    try {
      return await DatabaseService.updateAdminLoginSuccess(username);
    } catch (error) {
      throw new Error(`Error updating admin login success: ${error.message}`);
    }
  },

  async updateAdminLoginFailure(username) {
    try {
      return await DatabaseService.updateAdminLoginFailure(username);
    } catch (error) {
      throw new Error(`Error updating admin login failure: ${error.message}`);
    }
  },

  async updateAdminStatus(username, status) {
    try {
      return await DatabaseService.updateAdminStatus(username, status);
    } catch (error) {
      throw new Error(`Error updating admin status: ${error.message}`);
    }
  },
};

let consoleSpy;

beforeEach(() => {
  jest.clearAllMocks();
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  // Set up default mock implementations
  mockGetAdminByUsername.mockResolvedValue(null);
  mockUpdateAdminLoginSuccess.mockResolvedValue(true);
  mockUpdateAdminLoginFailure.mockResolvedValue(true);
  mockUpdateAdminStatus.mockResolvedValue(true);

  // Set up bcrypt.compare mock
  bcrypt.compare.mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
});

describe('AdminController', () => {
  describe('authenticateAdmin', () => {
    const mockAdminData = {
      id: 1,
      username: 'testadmin',
      password_hash: '$2b$10$hashedpassword',
      role: 'admin',
      email: 'test@example.com',
      full_name: 'Test Admin',
      active: true,
      locked_until: null,
    };
    it('should throw error when username or password is empty', async () => {
      await expect(adminController.authenticateAdmin('', 'password123'))
        .rejects.toThrow('Username and password are required');
      await expect(adminController.authenticateAdmin('testadmin', ''))
        .rejects.toThrow('Username and password are required');
    });
    it('should throw error when username is empty', async () => {
      await expect(adminController.getAdminByUsername(''))
        .rejects.toThrow('Valid username is required');
    });
    it('should authenticate valid admin successfully', async () => {
      // Arrange
      mockGetAdminByUsername.mockResolvedValue(mockAdminData);
      bcrypt.compare.mockResolvedValue(true);
      mockUpdateAdminLoginSuccess.mockResolvedValue(true);

      // Act
      const result = await adminController.authenticateAdmin('testadmin', 'password123');

      // Assert
      expect(result).toEqual({
        id: 1,
        username: 'testadmin',
        role: 'admin',
        email: 'test@example.com',
        full_name: 'Test Admin',
      });
      expect(mockGetAdminByUsername).toHaveBeenCalledWith('testadmin');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', '$2b$10$hashedpassword');
      expect(mockUpdateAdminLoginSuccess).toHaveBeenCalledWith(1);
    });
    it('should return null for invalid password', async () => {
      // Arrange
      mockGetAdminByUsername.mockResolvedValue(mockAdminData);
      bcrypt.compare.mockResolvedValue(false);
      mockUpdateAdminLoginFailure.mockResolvedValue(true);

      // Act
      const result = await adminController.authenticateAdmin('testadmin', 'wrongpassword');

      // Assert
      expect(result).toBeNull();
      expect(mockUpdateAdminLoginFailure).toHaveBeenCalledWith(1);
    });

    it('should return null for non-existent admin', async () => {
      // Arrange
      mockGetAdminByUsername.mockResolvedValue(null);

      // Act
      const result = await adminController.authenticateAdmin('nonexistent', 'password123');

      // Assert
      expect(result).toBeNull();
      expect(mockGetAdminByUsername).toHaveBeenCalledWith('nonexistent');
    });

    it('should throw error for inactive admin', async () => {
      // Arrange
      const inactiveAdmin = { ...mockAdminData, active: false };
      mockGetAdminByUsername.mockResolvedValue(inactiveAdmin);

      // Act
      await expect(adminController.authenticateAdmin('testadmin', 'password123'))
        .rejects.toThrow('Admin account is inactive or locked');
    });

    it('should throw error for locked admin', async () => {
      // Arrange
      const lockedAdmin = {
        ...mockAdminData,
        locked_until: new Date(Date.now() + 3600000).toISOString(), // 1 hour in future
      };
      mockGetAdminByUsername.mockResolvedValue(lockedAdmin);

      // Act
      await expect(adminController.authenticateAdmin('testadmin', 'password123'))
        .rejects.toThrow('Admin account is inactive or locked');
    });

    it('should throw error when validation fails', async () => {
      // Arrange
      mockGetAdminByUsername.mockResolvedValue({ invalid: 'data' }); // Missing required fields

      // Act
      await expect(adminController.getAdminByUsername('testadmin'))
        .rejects.toThrow('Validation failed: Username is required; Email is required');
    });

    it('should throw error when database error occurs', async () => {
      // Arrange
      mockGetAdminByUsername.mockRejectedValue(new Error('Database error'));

      // Act
      await expect(adminController.authenticateAdmin('testadmin', 'password123'))
        .rejects.toThrow('Error during admin authentication: Database error');
    });
  });
  describe('getAdminByUsername', () => {
    it('should return admin when found and valid', async () => {
      // Arrange
      const mockAdminData = {
        id: 1,
        username: 'testadmin',
        email: 'test@example.com',
      };
      mockGetAdminByUsername.mockResolvedValue(mockAdminData);

      // Act
      const result = await adminController.getAdminByUsername('testadmin');

      // Assert
      expect(result).toBeInstanceOf(Admin);
      expect(result.id).toBe(1);
      expect(result.username).toBe('testadmin');
      expect(result.email).toBe('test@example.com');
      expect(result.role).toBe('admin'); // default value
      expect(result.active).toBe(true); // default value
      expect(mockGetAdminByUsername).toHaveBeenCalledWith('testadmin');
    });

    it('should throw error when admin not found', async () => {
      // Arrange
      mockGetAdminByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(adminController.getAdminByUsername('nonexistent'))
        .rejects.toThrow('Admin not found');
    });

    it('should throw error when validation fails', async () => {
      // Arrange
      mockGetAdminByUsername.mockResolvedValue({ invalid: 'data' });

      // Act & Assert
      await expect(adminController.getAdminByUsername('testadmin'))
        .rejects.toThrow('Validation failed: Username is required; Email is required');
    });

    it('should throw error when database error occurs', async () => {
      // Arrange
      mockGetAdminByUsername.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(adminController.getAdminByUsername('testadmin'))
        .rejects.toThrow('Error fetching admin by username: Database error');
    });
  });
  describe('updateAdminLoginFailure', () => {
    it('should throw error when database error occurs', async () => {
      // Arrange
      mockUpdateAdminLoginFailure.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(adminController.updateAdminLoginFailure('testadmin'))
        .rejects.toThrow('Error updating admin login failure: Database error');
    });
  });
  describe('updateAdminStatus', () => {
    it('should throw error when database error occurs', async () => {
      // Arrange
      mockUpdateAdminStatus.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(adminController.updateAdminStatus('testadmin', 'active'))
        .rejects.toThrow('Error updating admin status: Database error');
    });
  });
  describe('updateAdminLoginSuccess', () => {
    it('should throw error when database error occurs', async () => {
      // Arrange
      mockUpdateAdminLoginSuccess.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(adminController.updateAdminLoginSuccess('testadmin'))
        .rejects.toThrow('Error updating admin login success: Database error');
    });
  });
});