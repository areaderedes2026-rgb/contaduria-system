import { Router } from 'express';
import * as reportesController from '../controllers/reportes.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.use(authorize('reportes:read'));

router.get('/tipos', reportesController.getTipos);
router.get('/:tipo/export', reportesController.exportCsv);
router.get('/:tipo', reportesController.generar);

export default router;
