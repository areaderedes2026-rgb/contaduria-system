import { Router } from 'express';
import * as controller from '../controllers/anticipos.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/export', authorize('afectaciones:read', 'afectaciones:write'), controller.exportCsv);
router.get('/resumen', authorize('afectaciones:read', 'afectaciones:write'), controller.getResumen);
router.get('/siguiente-numero', authorize('afectaciones:read', 'afectaciones:write'), controller.getSiguienteNumero);
router.get(
  '/expedientes-disponibles',
  authorize('afectaciones:read', 'afectaciones:write'),
  controller.getExpedientesDisponibles
);
router.get('/', authorize('afectaciones:read', 'afectaciones:write'), controller.list);
router.get('/:id', authorize('afectaciones:read', 'afectaciones:write'), controller.getById);
router.post('/', authorize('afectaciones:write'), controller.create);
router.post('/:id/anular', authorize('afectaciones:write'), controller.anular);

export default router;
