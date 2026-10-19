import { Router } from 'express';
import * as afectacionesController from '../controllers/afectaciones.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/export', authorize('afectaciones:read', 'afectaciones:write'), afectacionesController.exportCsv);
router.get('/resumen', authorize('afectaciones:read', 'afectaciones:write'), afectacionesController.getResumen);
router.get('/siguiente-numero', authorize('afectaciones:read', 'afectaciones:write'), afectacionesController.getSiguienteNumero);
router.get('/expedientes-disponibles', authorize('afectaciones:read', 'afectaciones:write'), afectacionesController.getExpedientesDisponibles);
router.get('/cuentas-disponibles', authorize('afectaciones:read', 'afectaciones:write'), afectacionesController.getCuentasDisponibles);
router.get('/', authorize('afectaciones:read', 'afectaciones:write'), afectacionesController.list);
router.get('/:id', authorize('afectaciones:read', 'afectaciones:write'), afectacionesController.getById);
router.post('/', authorize('afectaciones:write'), afectacionesController.create);
router.put('/:id', authorize('afectaciones:write'), afectacionesController.update);
router.post('/:id/anular', authorize('afectaciones:write'), afectacionesController.anular);

export default router;
