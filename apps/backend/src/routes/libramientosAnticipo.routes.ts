import { Router } from 'express';
import * as controller from '../controllers/libramientosAnticipo.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/export', authorize('libramientos:read', 'libramientos:write'), controller.exportCsv);
router.get('/resumen', authorize('libramientos:read', 'libramientos:write'), controller.getResumen);
router.get('/siguiente-numero', authorize('libramientos:read', 'libramientos:write'), controller.getSiguienteNumero);
router.get(
  '/anticipos-disponibles',
  authorize('libramientos:read', 'libramientos:write'),
  controller.getAnticiposDisponibles
);
router.get(
  '/expedientes-disponibles',
  authorize('libramientos:read', 'libramientos:write'),
  controller.getExpedientesDisponibles
);
router.get(
  '/anticipo/:anticipoId',
  authorize('libramientos:read', 'libramientos:write'),
  controller.getAnticipoParaLibramiento
);
router.get('/', authorize('libramientos:read', 'libramientos:write'), controller.list);
router.get('/:id', authorize('libramientos:read', 'libramientos:write'), controller.getById);
router.post('/', authorize('libramientos:write'), controller.create);
router.post('/:id/anular', authorize('libramientos:write'), controller.anular);

export default router;
