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

describe('AdminController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Admin.validate als statische Methode mocken
    Admin.validate = jest.fn();
  });

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

    it('should return null for inactive admin', async () => {
      // Arrange
      const inactiveAdmin = { ...mockAdminData, active: false };
      DatabaseService.getAdminByUsername.mockResolvedValue(inactiveAdmin);
      Admin.validate.mockReturnValue({ error: null, value: inactiveAdmin });

      // Act
      const result = await adminController.default.authenticateAdmin('testadmin', 'password123');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for locked admin', async () => {
      // Arrange
      const lockedAdmin = { 
        ...mockAdminData, 
        locked_until: new Date(Date.now() + 3600000).toISOString() // 1 hour in future
      };
      DatabaseService.getAdminByUsername.mockResolvedValue(lockedAdmin);
      Admin.validate.mockReturnValue({ error: null, value: lockedAdmin });

      // Act
      const result = await adminController.default.authenticateAdmin('testadmin', 'password123');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when validation fails', async () => {
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
      const result = await adminController.default.authenticateAdmin('testadmin', 'password123');

      // Assert
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Invalid admin data from database:', 'Invalid data; Missing required field');
      
      // Cleanup
      consoleSpy.mockRestore();
    });

    it('should return null when database error occurs', async () => {
      // Arrange
      DatabaseService.getAdminByUsername.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await adminController.default.authenticateAdmin('testadmin', 'password123');

      // Assert
      expect(result).toBeNull();
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
  });
});