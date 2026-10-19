import { Router } from 'express';
import * as cuentasController from '../controllers/cuentas.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/export', authorize('cuentas:read', 'cuentas:write'), cuentasController.exportCsv);
router.get('/arbol', authorize('cuentas:read', 'cuentas:write'), cuentasController.getArbol);
router.get('/padres', authorize('cuentas:read', 'cuentas:write'), cuentasController.getPadres);
router.get('/resumen', authorize('cuentas:read', 'cuentas:write'), cuentasController.getResumen);
router.get('/', authorize('cuentas:read', 'cuentas:write'), cuentasController.list);
router.get('/:id/historial', authorize('cuentas:read', 'cuentas:write'), cuentasController.getHistorial);
router.get('/:id/hijos', authorize('cuentas:read', 'cuentas:write'), cuentasController.getHijos);
router.get('/:id/afectaciones', authorize('cuentas:read', 'cuentas:write'), cuentasController.getAfectaciones);
router.get('/:id/movimientos', authorize('cuentas:read', 'cuentas:write'), cuentasController.getMovimientos);
router.get('/:id', authorize('cuentas:read', 'cuentas:write'), cuentasController.getById);
router.post('/', authorize('cuentas:write'), cuentasController.create);
router.post('/:id/ajuste-saldo', authorize('cuentas:write'), cuentasController.ajustarSaldo);
router.put('/:id', authorize('cuentas:write'), cuentasController.update);
router.delete('/:id', authorize('cuentas:write'), cuentasController.remove);

export default router;
