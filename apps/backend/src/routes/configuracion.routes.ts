import { Router } from 'express';
import * as configuracionController from '../controllers/configuracion.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

/** Lectura: quien imprime afectaciones o administra config */
router.get(
  '/impresion/afectacion',
  authorize('afectaciones:read', 'afectaciones:write', 'configuracion:read', 'configuracion:write'),
  configuracionController.getImpresionAfectacion
);

/** Edición: solo admin de configuración */
router.put(
  '/impresion/afectacion',
  authorize('configuracion:write'),
  configuracionController.updateImpresionAfectacion
);

router.get(
  '/impresion/libramiento',
  authorize('libramientos:read', 'libramientos:write', 'configuracion:read', 'configuracion:write'),
  configuracionController.getImpresionLibramiento
);

router.put(
  '/impresion/libramiento',
  authorize('configuracion:write'),
  configuracionController.updateImpresionLibramiento
);

router.get(
  '/fondo-a-rendir',
  authorize('configuracion:read', 'configuracion:write', 'afectaciones:read', 'afectaciones:write'),
  configuracionController.getFondoARendir
);

router.put(
  '/fondo-a-rendir',
  authorize('configuracion:write'),
  configuracionController.updateFondoARendir
);

export default router;
