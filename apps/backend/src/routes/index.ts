import { Router } from 'express';
import { pool } from '../database/pool.js';
import { getAppVersion, resetAppVersionCache } from '../utils/appVersion.js';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import cuentasRoutes from './cuentas.routes.js';
import expedientesRoutes from './expedientes.routes.js';
import proveedoresRoutes from './proveedores.routes.js';
import afectacionesRoutes from './afectaciones.routes.js';
import libramientosRoutes from './libramientos.routes.js';
import pagosRoutes from './pagos.routes.js';
import consultasRoutes from './consultas.routes.js';
import auditoriaRoutes from './auditoria.routes.js';
import reportesRoutes from './reportes.routes.js';
import configuracionRoutes from './configuracion.routes.js';
import anticiposRoutes from './anticipos.routes.js';
import libramientosAnticipoRoutes from './libramientosAnticipo.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/usuarios', usersRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/cuentas', cuentasRoutes);
router.use('/expedientes', expedientesRoutes);
router.use('/proveedores', proveedoresRoutes);
router.use('/afectaciones', afectacionesRoutes);
router.use('/anticipos', anticiposRoutes);
router.use('/libramientos', libramientosRoutes);
router.use('/libramientos-anticipo', libramientosAnticipoRoutes);
router.use('/pagos', pagosRoutes);
router.use('/consultas', consultasRoutes);
router.use('/auditoria', auditoriaRoutes);
router.use('/reportes', reportesRoutes);
router.use('/configuracion', configuracionRoutes);

router.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      success: true,
      message: 'API Contaduría Municipal operativa',
      database: 'connected',
    });
  } catch {
    res.status(503).json({
      success: false,
      message: 'API activa pero base de datos no disponible',
      database: 'disconnected',
    });
  }
});

/** Público: las PCs clientes lo usan para detectar actualizaciones del servidor. */
router.get('/version', (_req, res) => {
  resetAppVersionCache();
  const info = getAppVersion();
  res.json({
    success: true,
    data: info,
  });
});

export default router;
