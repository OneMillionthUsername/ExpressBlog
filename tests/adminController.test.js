
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// 1. Mocks vor allen Imports
const mockGetAdminByUsername = jest.fn();
const mockUpdateAdminLoginSuccess = jest.fn();
const mockUpdateAdminLoginFailure = jest.fn();
const mockUpdateAdminStatus = jest.fn();

jest.unstable_mockModule('../databases/mariaDB.js', () => ({
  DatabaseService: {
    getAdminByUsername: mockGetAdminByUsername,
    updateAdminLoginSuccess: mockUpdateAdminLoginSuccess,
    updateAdminLoginFailure: mockUpdateAdminLoginFailure,
    updateAdminStatus: mockUpdateAdminStatus,
  },
}));

jest.unstable_mockModule('../models/adminModel.js', () => ({
  Admin: class MockAdmin {
    constructor(data) {
      Object.assign(this, data);
      // Mirror real model default values
      if (this.role === undefined) this.role = 'admin';
      if (this.active === undefined) this.active = true;
    }
  },
}));

jest.unstable_mockModule('bcrypt', () => ({
  default: {
    compare: jest.fn(),
  },
}));

// 2. Dynamic imports nach den Mocks
const { DatabaseService } = await import('../databases/mariaDB.js');
const { Admin } = await import('../models/adminModel.js');
const bcryptModule = await import('bcrypt');
const bcrypt = bcryptModule.default ?? bcryptModule;
const adminController = await import('../controllers/adminController.js');

// Add the validate method to the mocked Admin class
Admin.validate = jest.fn();

// Mock bcrypt methods after import
const mockBcryptCompare = jest.fn();
bcrypt.compare = mockBcryptCompare;

// Wire DatabaseService methods to jest mocks
DatabaseService.getAdminByUsername = mockGetAdminByUsername;
DatabaseService.updateAdminLoginSuccess = mockUpdateAdminLoginSuccess;
DatabaseService.updateAdminLoginFailure = mockUpdateAdminLoginFailure;
DatabaseService.updateAdminStatus = mockUpdateAdminStatus;

let consoleSpy;

beforeEach(() => {
  jest.clearAllMocks();
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  // Set up default mock implementations
  mockGetAdminByUsername.mockResolvedValue(null);
  mockUpdateAdminLoginSuccess.mockResolvedValue(true);
  mockUpdateAdminLoginFailure.mockResolvedValue(true);
  mockUpdateAdminStatus.mockResolvedValue(true);

  // Set up Admin.validate mock
  Admin.validate.mockReturnValue({ error: null, value: {} });

  // Set up bcrypt.compare mock
  mockBcryptCompare.mockResolvedValue(true);
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
      await expect(adminController.default.authenticateAdmin('', 'password123'))
        .rejects.toThrow('Username and password are required');
      await expect(adminController.default.authenticateAdmin('testadmin', ''))
        .rejects.toThrow('Username and password are required');
    });
    it('should throw error when username is empty', async () => {
      await expect(adminController.default.getAdminByUsername(''))
        .rejects.toThrow('Valid username is required');
    });
    it('should authenticate valid admin successfully', async () => {
      // Arrange
      mockGetAdminByUsername.mockResolvedValue(mockAdminData);
      Admin.validate.mockReturnValue({ error: null, value: mockAdminData });
      mockBcryptCompare.mockResolvedValue(true);
      mockUpdateAdminLoginSuccess.mockResolvedValue(true);

      // Act
      const result = await adminController.default.authenticateAdmin('testadmin', 'password123');

      // Assert
      expect(result).toEqual({
        id: 1,
        username: 'testadmin',
        role: 'admin',
        email: 'test@example.com',
        full_name: 'Test Admin',
      });
      expect(mockGetAdminByUsername).toHaveBeenCalledWith('testadmin');
      expect(mockBcryptCompare).toHaveBeenCalledWith('password123', '$2b$10$hashedpassword');
      expect(mockUpdateAdminLoginSuccess).toHaveBeenCalledWith(1);
    });
    it('should return null for invalid password', async () => {
      // Arrange
      mockGetAdminByUsername.mockResolvedValue(mockAdminData);
      Admin.validate.mockReturnValue({ error: null, value: mockAdminData });
      mockBcryptCompare.mockResolvedValue(false);
      mockUpdateAdminLoginFailure.mockResolvedValue(true);

      // Act
      const result = await adminController.default.authenticateAdmin('testadmin', 'wrongpassword');

      // Assert
      expect(result).toBeNull();
      expect(mockUpdateAdminLoginFailure).toHaveBeenCalledWith(1);
    });

    it('should return null for non-existent admin', async () => {
      // Arrange
      mockGetAdminByUsername.mockResolvedValue(null);

      // Act
      const result = await adminController.default.authenticateAdmin('nonexistent', 'password123');

      // Assert
      expect(result).toBeNull();
      expect(mockGetAdminByUsername).toHaveBeenCalledWith('nonexistent');
    });

    it('should throw error for inactive admin', async () => {
      // Arrange
      const inactiveAdmin = { ...mockAdminData, active: false };
      mockGetAdminByUsername.mockResolvedValue(inactiveAdmin);
      Admin.validate.mockReturnValue({ error: null, value: inactiveAdmin });

      // Act
      await expect(adminController.default.authenticateAdmin('testadmin', 'password123'))
        .rejects.toThrow('Admin account is inactive or locked');
    });

    it('should throw error for locked admin', async () => {
      // Arrange
      const lockedAdmin = {
        ...mockAdminData,
        locked_until: new Date(Date.now() + 3600000).toISOString(), // 1 hour in future
      };
      mockGetAdminByUsername.mockResolvedValue(lockedAdmin);
      Admin.validate.mockReturnValue({ error: null, value: lockedAdmin });

      // Act
      await expect(adminController.default.authenticateAdmin('testadmin', 'password123'))
        .rejects.toThrow('Admin account is inactive or locked');
    });

    it('should throw error when validation fails', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockGetAdminByUsername.mockResolvedValue(mockAdminData);
      Admin.validate.mockReturnValue({
        error: {
          details: [
            { message: 'Invalid data' },
            { message: 'Missing required field' },
          ],
        },
        value: null,
      });

      // Act
      await expect(adminController.default.getAdminByUsername('testadmin'))
        .rejects.toThrow('Validation failed: Invalid data; Missing required field');
    });

    it('should throw error when database error occurs', async () => {
      // Arrange
      mockGetAdminByUsername.mockRejectedValue(new Error('Database error'));

      // Act
      await expect(adminController.default.authenticateAdmin('testadmin', 'password123'))
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
      Admin.validate.mockReturnValue({ error: null, value: mockAdminData });

      // Act
      const result = await adminController.default.getAdminByUsername('testadmin');

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
      await expect(adminController.default.getAdminByUsername('nonexistent'))
        .rejects.toThrow('Admin not found');
    });

    it('should throw error when validation fails', async () => {
      // Arrange
      mockGetAdminByUsername.mockResolvedValue({ invalid: 'data' });
      Admin.validate.mockReturnValue({
        error: {
          details: [
            { message: 'Invalid data' },
            { message: 'Missing required field' },
          ],
        },
        value: null,
      });

      // Act & Assert
      await expect(adminController.default.getAdminByUsername('testadmin'))
        .rejects.toThrow('Validation failed: Invalid data; Missing required field');
    });

    it('should throw error when database error occurs', async () => {
      // Arrange
      mockGetAdminByUsername.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(adminController.default.getAdminByUsername('testadmin'))
        .rejects.toThrow('Error fetching admin by username: Database error');
    });
  });
  describe('updateAdminLoginFailure', () => {
    it('should throw error when database error occurs', async () => {
      // Arrange
      mockUpdateAdminLoginFailure.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(adminController.default.updateAdminLoginFailure('testadmin'))
        .rejects.toThrow('Error updating admin login failure: Database error');
    });
  });
  describe('updateAdminStatus', () => {
    it('should throw error when database error occurs', async () => {
      // Arrange
      mockUpdateAdminStatus.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(adminController.default.updateAdminStatus('testadmin', 'active'))
        .rejects.toThrow('Error updating admin status: Database error');
    });
  });
  describe('updateAdminLoginSuccess', () => {
    it('should throw error when database error occurs', async () => {
      // Arrange
      mockUpdateAdminLoginSuccess.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(adminController.default.updateAdminLoginSuccess('testadmin'))
        .rejects.toThrow('Error updating admin login success: Database error');
    });
  });
});