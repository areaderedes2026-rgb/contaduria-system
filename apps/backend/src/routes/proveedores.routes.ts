import { Router } from 'express';
import * as proveedoresController from '../controllers/proveedores.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/activos', authorize('proveedores:read', 'proveedores:write', 'expedientes:write'), proveedoresController.listActivos);
router.get('/', authorize('proveedores:read', 'proveedores:write'), proveedoresController.list);
router.get('/:id/historial', authorize('proveedores:read', 'proveedores:write'), proveedoresController.getHistorial);
router.get('/:id/resumen', authorize('proveedores:read', 'proveedores:write'), proveedoresController.getResumen);
router.get('/:id', authorize('proveedores:read', 'proveedores:write'), proveedoresController.getById);
router.post('/', authorize('proveedores:write'), proveedoresController.create);
router.put('/:id', authorize('proveedores:write'), proveedoresController.update);
router.delete('/:id', authorize('proveedores:write'), proveedoresController.remove);

export default router;
