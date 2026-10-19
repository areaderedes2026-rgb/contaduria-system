import { Router } from 'express';
import * as libramientosController from '../controllers/libramientos.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/export', authorize('libramientos:read', 'libramientos:write'), libramientosController.exportCsv);
router.get('/consolidados/export', authorize('libramientos:read', 'libramientos:write'), libramientosController.exportConsolidadosCsv);
router.get('/resumen', authorize('libramientos:read', 'libramientos:write'), libramientosController.getResumen);
router.get('/siguiente-numero', authorize('libramientos:read', 'libramientos:write'), libramientosController.getSiguienteNumero);
router.get('/afectaciones-disponibles', authorize('libramientos:read', 'libramientos:write'), libramientosController.getAfectacionesDisponibles);
router.get('/expedientes-disponibles', authorize('libramientos:read', 'libramientos:write'), libramientosController.getExpedientesDisponibles);
router.get('/afectacion/:afectacionId', authorize('libramientos:read', 'libramientos:write'), libramientosController.getAfectacionParaLibramiento);
router.get('/consolidados', authorize('libramientos:read', 'libramientos:write'), libramientosController.listConsolidados);
router.get('/', authorize('libramientos:read', 'libramientos:write'), libramientosController.list);
router.get('/:id', authorize('libramientos:read', 'libramientos:write'), libramientosController.getById);
router.post('/', authorize('libramientos:write'), libramientosController.create);
router.post('/:id/anular', authorize('libramientos:write'), libramientosController.anular);

export default router;
