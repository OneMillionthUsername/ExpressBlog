//Controllers contain the logic for each route, handling requests, processing data, and sending responses. This keeps routes clean and focused on HTTP handling.

/**
- Business Logic Separation: Keeps routes focused on request handling, while the controller manages business logic.
- Database Interaction: Interacts with the models to fetch data or perform actions.
- Error Handling: Ensures that errors in data retrieval are handled gracefully.
 */

import { DatabaseService } from '../databases/mariaDB';
import adminModel from '../models/adminModel';

const getAdminByUsername = async (username) => {
    try {
        const admin = await DatabaseService.getAdminByUsername(username);
        if (!admin) {
            throw new Error('Admin not found');
        }
        const { error, value } = adminModel.validate(admin);
        if (error) {
            throw new Error('Validation failed: ' + error.details.map(d => d.message).join('; '));
        }
        return new adminModel(value);
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

export default {
    getAdminByUsername,
    updateAdminLoginSuccess,
    updateAdminLoginFailure,
    updateAdminStatus
}