//Routes manage HTTP requests (GET, POST, PUT, DELETE) and map them to controller functions.

/**
- Route Management: Organizes routes based on features or entities (e.g., userRoutes).
- Cleaner Code: Separates the routing logic from the controller logic, keeping files smaller and easier to manage.
 */

import { Router } from 'express';
import { loginLimiter } from '../utils/limiters.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';
const adminRouter = Router();

adminRouter.get('/admin', authenticateToken, requireAdmin, (req, res) => {
    res.json({ message: 'Welcome to the admin panel' });
});

export default adminRouter;