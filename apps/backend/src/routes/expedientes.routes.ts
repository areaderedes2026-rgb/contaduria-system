import { Router } from 'express';
import * as expedientesController from '../controllers/expedientes.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/export', authorize('expedientes:read', 'expedientes:write'), expedientesController.exportCsv);
router.get('/resumen', authorize('expedientes:read', 'expedientes:write'), expedientesController.getResumen);
router.get('/siguiente-numero', authorize('expedientes:read', 'expedientes:write'), expedientesController.getSiguienteNumero);
router.get('/', authorize('expedientes:read', 'expedientes:write'), expedientesController.list);
router.get('/:id/historial', authorize('expedientes:read', 'expedientes:write'), expedientesController.getHistorial);
router.get('/:id', authorize('expedientes:read', 'expedientes:write'), expedientesController.getById);
router.post('/', authorize('expedientes:write'), expedientesController.create);
router.put('/:id', authorize('expedientes:write'), expedientesController.update);
router.delete('/:id', authorize('expedientes:write'), expedientesController.remove);
router.post('/:id/anular', authorize('expedientes:write'), expedientesController.anular);
router.post('/:id/archivar', authorize('expedientes:write'), expedientesController.archivar);

export default router;
