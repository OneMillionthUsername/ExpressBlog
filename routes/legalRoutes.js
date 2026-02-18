import express from 'express';
import * as legalController from '../controllers/legalController.js';

const router = express.Router();

router.get('/impressum', legalController.getImpressum);
router.get('/datenschutz', legalController.getDatenschutz);

export default router;
