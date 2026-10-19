import { query } from '../database/pool.js';

export async function getDashboardStats() {
  const [usuarios, roles, cuentas, expedientes, afectaciones, libramientos, pagos, pendientes] = await Promise.all([
    query<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM usuarios WHERE deleted_at IS NULL AND activo = true'
    ),
    query<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM roles WHERE deleted_at IS NULL'
    ),
    query<{ total: string }>(
      "SELECT COUNT(*)::text AS total FROM cuentas WHERE deleted_at IS NULL AND estado = 'ACTIVA'"
    ),
    query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM expedientes
       WHERE deleted_at IS NULL AND anulado = false`
    ),
    query<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM afectaciones WHERE deleted_at IS NULL AND anulada = false'
    ),
    query<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM libramientos WHERE deleted_at IS NULL AND anulado = false'
    ),
    query<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM pagos WHERE deleted_at IS NULL AND anulado = false'
    ),
    query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM libramientos l
       INNER JOIN expedientes e ON e.id = l.expediente_id
       WHERE l.deleted_at IS NULL AND l.anulado = false AND l.pagado = false
         AND e.deleted_at IS NULL AND e.anulado = false AND e.estado = 'LIBRADO'
         AND COALESCE(e.circuito, 'NORMAL') = 'NORMAL'`
    ),
  ]);

  return {
    usuariosActivos: parseInt(usuarios.rows[0]?.total ?? '0', 10),
    roles: parseInt(roles.rows[0]?.total ?? '0', 10),
    cuentasActivas: parseInt(cuentas.rows[0]?.total ?? '0', 10),
    expedientes: parseInt(expedientes.rows[0]?.total ?? '0', 10),
    afectaciones: parseInt(afectaciones.rows[0]?.total ?? '0', 10),
    libramientos: parseInt(libramientos.rows[0]?.total ?? '0', 10),
    pagos: parseInt(pagos.rows[0]?.total ?? '0', 10),
    pagosPendientes: parseInt(pendientes.rows[0]?.total ?? '0', 10),
  };
}
