import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// 1. Mocks vor allen Imports
jest.unstable_mockModule('../databases/mariaDB.js', () => ({
  DatabaseService: {
    getAdminByUsername: jest.fn(),
    updateAdminLoginSuccess: jest.fn(),
    updateAdminLoginFailure: jest.fn(),
    updateAdminStatus: jest.fn()
  }
}));

// Admin als Konstruktor-Funktion mocken
jest.unstable_mockModule('../models/adminModel.js', () => ({
  Admin: jest.fn().mockImplementation((data) => data), // ← Als Konstruktor
  default: jest.fn().mockImplementation((data) => data) // ← Falls es default export ist
}));

jest.unstable_mockModule('bcrypt', () => ({
  default: {
    compare: jest.fn()
  }
}));

// 2. Imports nach den Mocks
const { DatabaseService } = await import('../databases/mariaDB.js');
const { Admin } = await import('../models/adminModel.js');
const bcrypt = await import('bcrypt');
const adminController = await import('../controllers/adminController.js');

let consoleSpy;

beforeEach(() => {
  jest.clearAllMocks();
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  // Admin.validate als statische Methode mocken
  Admin.validate = jest.fn();
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
      locked_until: null
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
      DatabaseService.getAdminByUsername.mockResolvedValue(mockAdminData);
      Admin.validate.mockReturnValue({ error: null, value: mockAdminData });
      bcrypt.default.compare.mockResolvedValue(true);
      DatabaseService.updateAdminLoginSuccess.mockResolvedValue(true);

      // Act
      const result = await adminController.default.authenticateAdmin('testadmin', 'password123');

      // Assert
      expect(result).toEqual({
        id: 1,
        username: 'testadmin',
        role: 'admin',
        email: 'test@example.com',
        full_name: 'Test Admin'
      });
      expect(DatabaseService.getAdminByUsername).toHaveBeenCalledWith('testadmin');
      expect(bcrypt.default.compare).toHaveBeenCalledWith('password123', '$2b$10$hashedpassword');
      expect(DatabaseService.updateAdminLoginSuccess).toHaveBeenCalledWith(1);
    });
    it('should return null for invalid password', async () => {
      // Arrange
      DatabaseService.getAdminByUsername.mockResolvedValue(mockAdminData);
      Admin.validate.mockReturnValue({ error: null, value: mockAdminData });
      bcrypt.default.compare.mockResolvedValue(false);
      DatabaseService.updateAdminLoginFailure.mockResolvedValue(true);

      // Act
      const result = await adminController.default.authenticateAdmin('testadmin', 'wrongpassword');

      // Assert
      expect(result).toBeNull();
      expect(DatabaseService.updateAdminLoginFailure).toHaveBeenCalledWith(1);
    });
    it('should return null for non-existent admin', async () => {
      // Arrange
      DatabaseService.getAdminByUsername.mockResolvedValue(null);

      // Act
      const result = await adminController.default.authenticateAdmin('nonexistent', 'password123');

      // Assert
      expect(result).toBeNull();
      expect(DatabaseService.getAdminByUsername).toHaveBeenCalledWith('nonexistent');
    });
    it('should throw error for inactive admin', async () => {
      // Arrange
      const inactiveAdmin = { ...mockAdminData, active: false };
      DatabaseService.getAdminByUsername.mockResolvedValue(inactiveAdmin);
      Admin.validate.mockReturnValue({ error: null, value: inactiveAdmin });

      // Act
      await expect(adminController.default.authenticateAdmin('testadmin', 'password123'))
        .rejects.toThrow('Admin account is inactive or locked');
    });
    it('should throw error for locked admin', async () => {
      // Arrange
      const lockedAdmin = { 
        ...mockAdminData, 
        locked_until: new Date(Date.now() + 3600000).toISOString() // 1 hour in future
      };
      DatabaseService.getAdminByUsername.mockResolvedValue(lockedAdmin);
      Admin.validate.mockReturnValue({ error: null, value: lockedAdmin });

      // Act
      await expect(adminController.default.authenticateAdmin('testadmin', 'password123'))
        .rejects.toThrow('Admin account is inactive or locked');
    });
    it('should throw error when validation fails', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      DatabaseService.getAdminByUsername.mockResolvedValue(mockAdminData);
      Admin.validate.mockReturnValue({ 
        error: { 
          details: [
            { message: 'Invalid data' },
            { message: 'Missing required field' }
          ]
        }, 
        value: null 
      });

      // Act
      await expect(adminController.default.getAdminByUsername('testadmin'))
        .rejects.toThrow('Validation failed: Invalid data; Missing required field');      
    });
    it('should throw error when database error occurs', async () => {
      // Arrange
      DatabaseService.getAdminByUsername.mockRejectedValue(new Error('Database error'));

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
        email: 'test@example.com'
      };
      DatabaseService.getAdminByUsername.mockResolvedValue(mockAdminData);
      Admin.validate.mockReturnValue({ error: null, value: mockAdminData });

      // Act
      const result = await adminController.default.getAdminByUsername('testadmin');

      // Assert
      expect(result).toEqual(mockAdminData);
      expect(DatabaseService.getAdminByUsername).toHaveBeenCalledWith('testadmin');
    });
    it('should throw error when admin not found', async () => {
      // Arrange
      DatabaseService.getAdminByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(adminController.default.getAdminByUsername('nonexistent'))
        .rejects.toThrow('Admin not found');
    });
    it('should throw error when validation fails', async () => {
      // Arrange
      DatabaseService.getAdminByUsername.mockResolvedValue({ invalid: 'data' });
      Admin.validate.mockReturnValue({ 
        error: { 
          details: [
            { message: 'Invalid data' },
            { message: 'Missing required field' }
          ]
        }, 
        value: null 
      });

      // Act & Assert
      await expect(adminController.default.getAdminByUsername('testadmin'))
        .rejects.toThrow('Validation failed: Invalid data; Missing required field');
    });
    it('should throw error when database error occurs', async () => {
      // Arrange
      DatabaseService.getAdminByUsername.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(adminController.default.getAdminByUsername('testadmin'))
        .rejects.toThrow('Error fetching admin by username: Database error');
    });
  });
  describe('updateAdminLoginFailure', () => {
    it('should throw error when database error occurs', async () => {
      // Arrange
      DatabaseService.updateAdminLoginFailure.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(adminController.default.updateAdminLoginFailure('testadmin'))
        .rejects.toThrow('Error updating admin login failure: Database error');
    });
  });
  describe('updateAdminStatus', () => {
    it('should throw error when database error occurs', async () => {
      // Arrange
      DatabaseService.updateAdminStatus.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(adminController.default.updateAdminStatus('testadmin', 'active'))
        .rejects.toThrow('Error updating admin status: Database error');
    });
  });
  describe('updateAdminLoginSuccess', () => {
    it('should throw error when database error occurs', async () => {
      // Arrange
      DatabaseService.updateAdminLoginSuccess.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(adminController.default.updateAdminLoginSuccess('testadmin'))
        .rejects.toThrow('Error updating admin login success: Database error');
    });
  });
});