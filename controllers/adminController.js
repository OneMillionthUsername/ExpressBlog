//Controllers contain the logic for each route, handling requests, processing data, and sending responses. This keeps routes clean and focused on HTTP handling.

/**
- Business Logic Separation: Keeps routes focused on request handling, while the controller manages business logic.
- Database Interaction: Interacts with the models to fetch data or perform actions.
- Error Handling: Ensures that errors in data retrieval are handled gracefully.
 */

import { DatabaseService } from '../databases/mariaDB';
import { Admin } from '../models/adminModel';
import bcrypt from 'bcrypt';

const getAdminByUsername = async (username) => {
    try {
        if (!username || typeof username !== 'string' || username.trim() === '') {
            throw new Error('Valid username is required');
        }
        const admin = await DatabaseService.getAdminByUsername(username);
        if (!admin) {
            throw new Error('Admin not found');
        }
        const { error, value } = Admin.validate(admin);
        if (error) {
            throw new Error('Validation failed: ' + error.details.map(d => d.message).join('; '));
        }
        return new Admin(value);
    } catch (error) {
        console.error('Error fetching admin by username:', error);
        throw error;
    }
}
const updateAdminLoginSuccess = async (adminId) => {
    try {
        const update = await DatabaseService.updateAdminLoginSuccess(adminId);
        return update;
    } catch (error) {
        console.error('Error updating admin login success:', error);
        throw error;
    }
}
const updateAdminLoginFailure = async (adminId) => {
    try {
        const update = await DatabaseService.updateAdminLoginFailure(adminId);
        return update;
    } catch (error) {
        console.error('Error updating admin login failure:', error);
        throw error;
    }
}
const updateAdminStatus = async (adminId, status) => {
    try {
        const update = await DatabaseService.updateAdminStatus(adminId, status);
        return update;
    } catch (error) {
        console.error('Error updating admin status:', error);
        throw error;
    }
}
// Admin-Login
const authenticateAdmin = async (username, password) => {
    // 1. Input-Validierung
    if (!username || typeof username !== 'string' || username.trim() === '') {
        throw new Error('Username and password are required');
    }
    if (!password || typeof password !== 'string' || password.length < 3) {
        throw new Error('Username and password are required');
    }
    try {
        const adminData = await DatabaseService.getAdminByUsername(username.trim());
        if (!adminData) return null;

        // 2. Admin-Objekt validieren
        const { error, value } = Admin.validate(adminData);
        if (error) {
            console.error('Invalid admin data from database:', error.details.map(d => d.message).join('; '));
            return null;
        }
        const admin = new Admin(value);
        // 3. Account-Status prüfen
        if (!admin.active || (admin.locked_until && new Date() < new Date(admin.locked_until))) {
            return null;
        }
        
        const isValidPassword = await bcrypt.compare(password, admin.password_hash);
        
        if (isValidPassword) {
            await updateAdminLoginSuccess(admin.id);
            return {
                id: admin.id,
                username: admin.username,
                role: admin.role,
                email: admin.email,
                full_name: admin.full_name
            };
        } else {
            await updateAdminLoginFailure(admin.id);
            return null;
        }
    } catch (error) {
        console.error('Error during admin authentication:', error);
        return null;
    }
};
export default {
    authenticateAdmin,
    getAdminByUsername,
    updateAdminLoginSuccess,
    updateAdminLoginFailure,
    updateAdminStatus
}
