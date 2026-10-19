import { Router } from 'express';
import * as pagosController from '../controllers/pagos.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/export', authorize('pagos:read', 'pagos:write'), pagosController.exportCsv);
router.get('/resumen', authorize('pagos:read', 'pagos:write'), pagosController.getResumen);
router.get('/medios-pago', authorize('pagos:read', 'pagos:write'), pagosController.getMediosPago);
router.get('/siguiente-numero', authorize('pagos:read', 'pagos:write'), pagosController.getSiguienteNumero);
router.get('/libramientos-pendientes', authorize('pagos:read', 'pagos:write'), pagosController.getLibramientosPendientes);
router.get('/libramiento/:libramientoId', authorize('pagos:read', 'pagos:write'), pagosController.getLibramientoParaPago);
router.get('/', authorize('pagos:read', 'pagos:write'), pagosController.list);
router.get('/:id', authorize('pagos:read', 'pagos:write'), pagosController.getById);
router.post('/', authorize('pagos:write'), pagosController.create);
router.post('/:id/anular', authorize('pagos:write'), pagosController.anular);

export default router;
