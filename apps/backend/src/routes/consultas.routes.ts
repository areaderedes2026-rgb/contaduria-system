import { Router } from 'express';
import * as consultasController from '../controllers/consultas.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.use(authorize('consultas:read'));

router.get('/resumen', consultasController.getResumen);
router.get('/expediente/buscar', consultasController.buscarExpediente);
router.get('/expediente/:id', consultasController.getExpedienteTrazabilidad);
router.get('/cuenta/:cuentaId/movimientos', consultasController.getMovimientosPorCuenta);
router.get('/beneficiario', consultasController.buscarBeneficiario);
router.get('/movimientos', consultasController.getMovimientos);
router.get('/movimientos/export', consultasController.exportMovimientos);
router.get('/ejecucion-presupuestaria', consultasController.getEjecucionPresupuestaria);
router.get('/ejecucion-presupuestaria/export', consultasController.exportEjecucion);

export default router;
