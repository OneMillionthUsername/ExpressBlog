//Controllers contain the logic for each route, handling requests, processing data, and sending responses. This keeps routes clean and focused on HTTP handling.

/**
- Business Logic Separation: Keeps routes focused on request handling, while the controller manages business logic.
- Database Interaction: Interacts with the models to fetch data or perform actions.
- Error Handling: Ensures that errors in data retrieval are handled gracefully.
 */

import { DatabaseService } from '../databases/mariaDB.js';
import { Admin } from '../models/adminModel.js';
import bcrypt from 'bcrypt';
import { AdminControllerException } from '../models/customExceptions.js';
import logger from '../utils/logger.js';

const getAdminByUsername = async (username) => {
  try {
    logger.debug('[ADMIN] getAdminByUsername called', { username });
    if (!username || typeof username !== 'string' || username.trim() === '' || username === null) {
      throw new AdminControllerException('Valid username is required');
    }
    const admin = await DatabaseService.getAdminByUsername(username);
    logger.debug('[ADMIN] getAdminByUsername DB result', { found: Boolean(admin) });
    if (!admin) {
      throw new AdminControllerException('Admin not found');
    }
    const { error, value } = Admin.validate(admin);
    if (error) {
      throw new AdminControllerException('Validation failed: ' + error.details.map(d => d.message).join('; '));
    }
    return new Admin(value);
  } catch (error) {
    throw new AdminControllerException(`Error fetching admin by username: ${error.message}`, error);
  }
};
const updateAdminLoginSuccess = async (adminId) => {
  try {
    logger.debug('[ADMIN] updateAdminLoginSuccess called', { adminId });
    const update = await DatabaseService.updateAdminLoginSuccess(adminId);
    if (!update) {
      throw new AdminControllerException('Failed to update admin login success');
    }
    return update;
  } catch (error) {
    throw new AdminControllerException(`Error updating admin login success: ${error.message}`, error);
  }
};
const updateAdminLoginFailure = async (adminId) => {
  try {
    logger.debug('[ADMIN] updateAdminLoginFailure called', { adminId });
    const update = await DatabaseService.updateAdminLoginFailure(adminId);
    if (!update) {
      throw new AdminControllerException('Failed to update admin login failure');
    }
    return update;
  } catch (error) {
    throw new AdminControllerException(`Error updating admin login failure: ${error.message}`, error);
  }
};
const updateAdminStatus = async (adminId, status) => {
  try {
    const update = await DatabaseService.updateAdminStatus(adminId, status);
    if (!update) {
      throw new AdminControllerException('Failed to update admin status');
    }
    return update;
  } catch (error) {
    throw new AdminControllerException(`Error updating admin status: ${error.message}`, error);
  }
};
// Admin-Login
const authenticateAdmin = async (username, password) => {
  // 1. Input-Validierung
  if (!username || typeof username !== 'string' || username.trim() === '' || username === null) {
    throw new AdminControllerException('Username and password are required');
  }
  if (!password || typeof password !== 'string' || password.length < 3 || password === null) {
    throw new AdminControllerException('Username and password are required');
  }
  try {
    logger.debug('[ADMIN] authenticateAdmin start', { usernamePresent: Boolean(username), passwordPresent: typeof password === 'string' });
    const adminData = await DatabaseService.getAdminByUsername(username.trim());
    if (!adminData) return null;

    // 2. Admin-Objekt validieren
    const { error, value } = Admin.validate(adminData);
    if (error) {
      const details = error.details ? error.details.map(d => d.message).join('; ') : String(error.message || error);
      throw new AdminControllerException('Invalid admin data from database: ' + details);
    }
    const admin = new Admin(value);
    // 3. Account-Status prüfen
    if (!admin.active || (admin.locked_until && new Date() < new Date(admin.locked_until))) {
      throw new AdminControllerException('Admin account is inactive or locked');
    }
        
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    logger.debug('[ADMIN] password compare result', { isValidPassword });
        
    if (isValidPassword) {
      await updateAdminLoginSuccess(admin.id);
      return {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        email: admin.email,
        full_name: admin.full_name,
      };
    } else {
      await updateAdminLoginFailure(admin.id);
      return null;
    }
  } catch (error) {
    throw new AdminControllerException(`Error during admin authentication: ${error.message}`, error);
  }
};
export default {
  authenticateAdmin,
  getAdminByUsername,
  updateAdminLoginSuccess,
  updateAdminLoginFailure,
  updateAdminStatus,
};
