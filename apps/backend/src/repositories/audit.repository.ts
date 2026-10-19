import { query } from '../database/pool.js';
import type { AuditoriaRegistro, AuditoriaResumen } from '../entities/index.js';

export async function registrarAuditoria(data: {
  usuario_id: number | null;
  accion: string;
  entidad: string;
  entidad_id?: number;
  cambios?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  await query(
    `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, cambios, ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      data.usuario_id,
      data.accion,
      data.entidad,
      data.entidad_id ?? null,
      data.cambios ? JSON.stringify(data.cambios) : null,
      data.ip ?? null,
    ]
  );
}

interface AuditoriaRow {
  id: number;
  usuario_id: number | null;
  usuario_nombre: string | null;
  usuario_username: string | null;
  accion: string;
  entidad: string;
  entidad_id: number | null;
  cambios: Record<string, unknown> | null;
  ip: string | null;
  created_at: Date;
}

const SELECT_BASE = `
  SELECT a.id, a.usuario_id,
         CONCAT(u.nombre, ' ', u.apellido) AS usuario_nombre,
         u.username AS usuario_username,
         a.accion, a.entidad, a.entidad_id, a.cambios, a.ip, a.created_at
  FROM auditoria a
  LEFT JOIN usuarios u ON u.id = a.usuario_id
`;

function mapRow(row: AuditoriaRow): AuditoriaRegistro {
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    usuario_nombre: row.usuario_nombre,
    usuario_username: row.usuario_username,
    accion: row.accion,
    entidad: row.entidad,
    entidad_id: row.entidad_id,
    cambios: row.cambios,
    ip: row.ip,
    created_at: row.created_at,
  };
}

export interface ListAuditoriaParams {
  page: number;
  limit: number;
  fechaDesde?: string;
  fechaHasta?: string;
  usuarioId?: number;
  accion?: string;
  entidad?: string;
  entidadId?: number;
  search?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export async function findAll(params: ListAuditoriaParams) {
  const { page, limit, fechaDesde, fechaHasta, usuarioId, accion, entidad, entidadId, search, sortBy, sortOrder } = params;
  const offset = (page - 1) * limit;

  const allowedSort = ['created_at', 'accion', 'entidad', 'usuario_nombre'];
  const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

  let whereClause = 'WHERE 1=1';
  const values: unknown[] = [];

  if (fechaDesde) {
    values.push(fechaDesde);
    whereClause += ` AND a.created_at >= $${values.length}::date`;
  }
  if (fechaHasta) {
    values.push(fechaHasta);
    whereClause += ` AND a.created_at < ($${values.length}::date + INTERVAL '1 day')`;
  }
  if (usuarioId) {
    values.push(usuarioId);
    whereClause += ` AND a.usuario_id = $${values.length}`;
  }
  if (accion) {
    values.push(accion);
    whereClause += ` AND a.accion = $${values.length}`;
  }
  if (entidad) {
    values.push(entidad);
    whereClause += ` AND a.entidad = $${values.length}`;
  }
  if (entidadId) {
    values.push(entidadId);
    whereClause += ` AND a.entidad_id = $${values.length}`;
  }
  if (search) {
    values.push(`%${search}%`);
    whereClause += ` AND (
      u.username ILIKE $${values.length}
      OR CONCAT(u.nombre, ' ', u.apellido) ILIKE $${values.length}
      OR a.ip ILIKE $${values.length}
      OR a.cambios::text ILIKE $${values.length}
    )`;
  }

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM auditoria a
     LEFT JOIN usuarios u ON u.id = a.usuario_id
     ${whereClause}`,
    values
  );

  const orderCol = orderColumn === 'usuario_nombre' ? 'usuario_nombre' : `a.${orderColumn}`;
  values.push(limit, offset);

  const dataResult = await query<AuditoriaRow>(
    `${SELECT_BASE} ${whereClause}
     ORDER BY ${orderCol} ${order}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return {
    data: dataResult.rows.map(mapRow),
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    page,
    limit,
  };
}

export async function findAllForExport(filters: Omit<ListAuditoriaParams, 'page' | 'limit' | 'sortBy' | 'sortOrder'>) {
  const result = await findAll({ ...filters, page: 1, limit: 100000, sortBy: 'created_at', sortOrder: 'desc' });
  return result.data;
}

export async function findById(id: number): Promise<AuditoriaRegistro | null> {
  const result = await query<AuditoriaRow>(
    `${SELECT_BASE} WHERE a.id = $1`,
    [id]
  );
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0]);
}

export async function findByEntidad(entidad: string, entidadId: number, limit = 50): Promise<AuditoriaRegistro[]> {
  const result = await query<AuditoriaRow>(
    `${SELECT_BASE}
     WHERE a.entidad = $1 AND a.entidad_id = $2
     ORDER BY a.created_at DESC
     LIMIT $3`,
    [entidad, entidadId, limit]
  );
  return result.rows.map(mapRow);
}

export async function getResumen(): Promise<AuditoriaResumen> {
  const [totales, porAccion, porEntidad] = await Promise.all([
    query<{ total: string; hoy: string; ultimos7: string }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::text AS hoy,
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::text AS ultimos7
       FROM auditoria`
    ),
    query<{ accion: string; total: string }>(
      `SELECT accion, COUNT(*)::text AS total
       FROM auditoria
       GROUP BY accion
       ORDER BY COUNT(*) DESC`
    ),
    query<{ entidad: string; total: string }>(
      `SELECT entidad, COUNT(*)::text AS total
       FROM auditoria
       GROUP BY entidad
       ORDER BY COUNT(*) DESC`
    ),
  ]);

  const row = totales.rows[0];
  return {
    total: parseInt(row?.total ?? '0', 10),
    hoy: parseInt(row?.hoy ?? '0', 10),
    ultimos7Dias: parseInt(row?.ultimos7 ?? '0', 10),
    porAccion: porAccion.rows.map((r) => ({
      accion: r.accion,
      total: parseInt(r.total, 10),
    })),
    porEntidad: porEntidad.rows.map((r) => ({
      entidad: r.entidad,
      total: parseInt(r.total, 10),
    })),
  };
}

export async function getUsuariosConActividad() {
  const result = await query<{ id: number; username: string; nombre: string }>(
    `SELECT DISTINCT u.id, u.username, CONCAT(u.nombre, ' ', u.apellido) AS nombre
     FROM auditoria a
     INNER JOIN usuarios u ON u.id = a.usuario_id
     ORDER BY nombre`
  );
  return result.rows;
}

export async function getAccionesDistintas(): Promise<string[]> {
  const result = await query<{ accion: string }>(
    `SELECT DISTINCT accion FROM auditoria ORDER BY accion`
  );
  return result.rows.map((r) => r.accion);
}

export async function getEntidadesDistintas(): Promise<string[]> {
  const result = await query<{ entidad: string }>(
    `SELECT DISTINCT entidad FROM auditoria ORDER BY entidad`
  );
  return result.rows.map((r) => r.entidad);
}
