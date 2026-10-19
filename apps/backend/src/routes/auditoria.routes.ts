import { Router } from 'express';
import * as auditoriaController from '../controllers/auditoria.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.use(authorize('auditoria:read'));

router.get('/export', auditoriaController.exportCsv);
router.get('/resumen', auditoriaController.getResumen);
router.get('/filtros', auditoriaController.getFiltros);
router.get('/metadata', auditoriaController.getMetadata);
router.get('/entidad/:entidad/:entidadId', auditoriaController.getByEntidad);
router.get('/', auditoriaController.list);
router.get('/:id', auditoriaController.getById);

export default router;
