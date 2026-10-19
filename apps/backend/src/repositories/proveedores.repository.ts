import { query } from '../database/pool.js';
import type { Proveedor } from '../entities/index.js';

export interface ListProveedoresParams {
  page: number;
  limit: number;
  search?: string;
  activo?: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export async function findAll(params: ListProveedoresParams) {
  const { page, limit, search, activo, sortBy, sortOrder } = params;
  const offset = (page - 1) * limit;

  const allowedSort = ['nombre', 'documento', 'created_at', 'activo'];
  const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'nombre';
  const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

  let whereClause = 'WHERE deleted_at IS NULL';
  const values: unknown[] = [];

  if (search) {
    values.push(`%${search}%`);
    whereClause += ` AND (
      nombre ILIKE $${values.length}
      OR COALESCE(documento, '') ILIKE $${values.length}
      OR COALESCE(domicilio, '') ILIKE $${values.length}
      OR COALESCE(telefono, '') ILIKE $${values.length}
    )`;
  }
  if (activo !== undefined) {
    values.push(activo);
    whereClause += ` AND activo = $${values.length}`;
  }

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM proveedores ${whereClause}`,
    values
  );

  values.push(limit, offset);
  const dataResult = await query<Proveedor>(
    `SELECT id, nombre, documento, domicilio, telefono, activo, created_at, updated_at
     FROM proveedores
     ${whereClause}
     ORDER BY ${orderColumn} ${order}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return {
    data: dataResult.rows,
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    page,
    limit,
  };
}

export async function findById(id: number): Promise<Proveedor | null> {
  const result = await query<Proveedor>(
    `SELECT id, nombre, documento, domicilio, telefono, activo, created_at, updated_at
     FROM proveedores
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function create(data: {
  nombre: string;
  documento?: string | null;
  domicilio?: string | null;
  telefono?: string | null;
  activo?: boolean;
}): Promise<Proveedor> {
  const result = await query<Proveedor>(
    `INSERT INTO proveedores (nombre, documento, domicilio, telefono, activo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, documento, domicilio, telefono, activo, created_at, updated_at`,
    [
      data.nombre,
      data.documento ?? null,
      data.domicilio ?? null,
      data.telefono ?? null,
      data.activo ?? true,
    ]
  );
  return result.rows[0];
}

export async function update(
  id: number,
  data: Partial<{
    nombre: string;
    documento: string | null;
    domicilio: string | null;
    telefono: string | null;
    activo: boolean;
  }>
): Promise<Proveedor | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) return findById(id);

  fields.push('updated_at = NOW()');
  values.push(id);

  const result = await query<Proveedor>(
    `UPDATE proveedores SET ${fields.join(', ')}
     WHERE id = $${paramIndex} AND deleted_at IS NULL
     RETURNING id, nombre, documento, domicilio, telefono, activo, created_at, updated_at`,
    values
  );
  return result.rows[0] ?? null;
}

export async function softDelete(id: number): Promise<boolean> {
  const result = await query(
    `UPDATE proveedores SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return result.rowCount > 0;
}

export async function hasExpedientes(id: number): Promise<boolean> {
  const result = await query(
    `SELECT 1
     FROM expediente_proveedores ep
     INNER JOIN expedientes e ON e.id = ep.expediente_id AND e.deleted_at IS NULL
     WHERE ep.proveedor_id = $1
     LIMIT 1`,
    [id]
  );
  return result.rowCount > 0;
}

export async function findActivos(search?: string, limit = 50): Promise<Proveedor[]> {
  const values: unknown[] = [];
  let whereClause = 'WHERE deleted_at IS NULL AND activo = true';

  if (search?.trim()) {
    values.push(`%${search.trim()}%`);
    whereClause += ` AND (
      nombre ILIKE $${values.length}
      OR COALESCE(documento, '') ILIKE $${values.length}
    )`;
  }

  values.push(limit);
  const result = await query<Proveedor>(
    `SELECT id, nombre, documento, domicilio, telefono, activo, created_at, updated_at
     FROM proveedores
     ${whereClause}
     ORDER BY nombre ASC
     LIMIT $${values.length}`,
    values
  );
  return result.rows;
}

export interface ProveedorResumen {
  totalExpedientes: number;
  expedientesActivos: number;
  expedientesAnulados: number;
  importeTotal: number;
  importeAfectado: number;
  importePagado: number;
  porEstado: Array<{ estado: string; total: number; importe: number }>;
}

export async function getResumen(proveedorId: number): Promise<ProveedorResumen> {
  const vinculado = `EXISTS (
    SELECT 1 FROM expediente_proveedores ep
    WHERE ep.expediente_id = expedientes.id AND ep.proveedor_id = $1
  )`;

  const [totales, porEstado, montos] = await Promise.all([
    query<{
      total: string;
      activos: string;
      anulados: string;
      importe_total: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE anulado = false AND estado <> 'ARCHIVADO')::text AS activos,
         COUNT(*) FILTER (WHERE anulado = true)::text AS anulados,
         COALESCE(SUM(importe) FILTER (WHERE anulado = false), 0)::text AS importe_total
       FROM expedientes
       WHERE deleted_at IS NULL AND ${vinculado}`,
      [proveedorId]
    ),
    query<{ estado: string; total: string; importe: string }>(
      `SELECT estado,
              COUNT(*)::text AS total,
              COALESCE(SUM(importe), 0)::text AS importe
       FROM expedientes
       WHERE deleted_at IS NULL AND anulado = false AND ${vinculado}
       GROUP BY estado
       ORDER BY estado`,
      [proveedorId]
    ),
    query<{ afectado: string; pagado: string }>(
      `SELECT
         COALESCE((
           SELECT SUM(a.importe_total)
           FROM afectaciones a
           INNER JOIN expedientes e ON e.id = a.expediente_id
           WHERE e.deleted_at IS NULL
             AND EXISTS (
               SELECT 1 FROM expediente_proveedores ep
               WHERE ep.expediente_id = e.id AND ep.proveedor_id = $1
             )
             AND a.deleted_at IS NULL
             AND a.anulada = false
         ), 0)::text AS afectado,
         COALESCE((
           SELECT SUM(pg.monto)
           FROM pagos pg
           INNER JOIN expedientes e ON e.id = pg.expediente_id
           WHERE e.deleted_at IS NULL
             AND EXISTS (
               SELECT 1 FROM expediente_proveedores ep
               WHERE ep.expediente_id = e.id AND ep.proveedor_id = $1
             )
             AND pg.deleted_at IS NULL
             AND pg.anulado = false
         ), 0)::text AS pagado`,
      [proveedorId]
    ),
  ]);

  const row = totales.rows[0];
  const montosRow = montos.rows[0];

  return {
    totalExpedientes: parseInt(row?.total ?? '0', 10),
    expedientesActivos: parseInt(row?.activos ?? '0', 10),
    expedientesAnulados: parseInt(row?.anulados ?? '0', 10),
    importeTotal: parseFloat(row?.importe_total ?? '0'),
    importeAfectado: parseFloat(montosRow?.afectado ?? '0'),
    importePagado: parseFloat(montosRow?.pagado ?? '0'),
    porEstado: porEstado.rows.map((r) => ({
      estado: r.estado,
      total: parseInt(r.total, 10),
      importe: parseFloat(r.importe),
    })),
  };
}
