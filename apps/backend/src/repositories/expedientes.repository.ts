import { query, withTransaction } from '../database/pool.js';
import type { Expediente, ExpedienteHistorial, ExpedienteProveedorRef } from '../entities/index.js';
import { formatExpedienteNumero } from '../utils/expediente.utils.js';
import { allocateYearlyNumero, bumpYearlyNumero } from '../utils/numeracion.js';
import { formatProveedoresNombres } from '../utils/proveedores.utils.js';

interface ExpedienteRow {
  id: number;
  numero: number;
  anio: number;
  proveedor_id: number;
  proveedor_nombre: string | null;
  importe: string | number;
  detalle: string;
  fecha_ingreso: string;
  estado: Expediente['estado'];
  circuito: Expediente['circuito'];
  anulado: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: Date | null;
  usuario_creacion_id: number | null;
  usuario_creacion_nombre: string | null;
  usuario_modificacion_id: number | null;
  afectaciones_activas?: string | number;
  anticipos_activos?: string | number;
  created_at: Date;
  updated_at: Date;
}

function mapExpediente(row: ExpedienteRow, proveedores: ExpedienteProveedorRef[] = []): Expediente {
  const list =
    proveedores.length > 0
      ? proveedores
      : row.proveedor_id
        ? [
            {
              id: row.proveedor_id,
              nombre: row.proveedor_nombre ?? '',
              documento: null,
            },
          ]
        : [];

  return {
    id: row.id,
    numero: row.numero,
    anio: row.anio,
    numero_completo: formatExpedienteNumero(row.numero, row.anio),
    proveedor_id: list[0]?.id ?? row.proveedor_id,
    proveedor_nombre:
      list.length > 0 ? formatProveedoresNombres(list) : (row.proveedor_nombre ?? undefined),
    proveedores: list,
    importe: typeof row.importe === 'string' ? parseFloat(row.importe) : row.importe,
    detalle: row.detalle,
    fecha_ingreso: row.fecha_ingreso,
    estado: row.estado,
    circuito: row.circuito ?? 'PENDIENTE',
    anulado: row.anulado,
    motivo_anulacion: row.motivo_anulacion,
    fecha_anulacion: row.fecha_anulacion,
    usuario_creacion_id: row.usuario_creacion_id,
    usuario_creacion_nombre: row.usuario_creacion_nombre,
    usuario_modificacion_id: row.usuario_modificacion_id,
    afectaciones_activas:
      row.afectaciones_activas === undefined
        ? 0
        : typeof row.afectaciones_activas === 'string'
          ? parseInt(row.afectaciones_activas, 10)
          : row.afectaciones_activas,
    anticipos_activos:
      row.anticipos_activos === undefined
        ? 0
        : typeof row.anticipos_activos === 'string'
          ? parseInt(row.anticipos_activos, 10)
          : row.anticipos_activos,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SELECT_BASE = `
  SELECT e.id, e.numero, e.anio, e.proveedor_id,
         COALESCE(
           (
             SELECT string_agg(px.nombre, ' · ' ORDER BY ep.orden)
             FROM expediente_proveedores ep
             INNER JOIN proveedores px ON px.id = ep.proveedor_id
             WHERE ep.expediente_id = e.id
           ),
           p.nombre
         ) AS proveedor_nombre,
         e.importe::text AS importe, e.detalle,
         e.fecha_ingreso::text,
         e.estado, COALESCE(e.circuito, 'NORMAL') AS circuito,
         e.anulado, e.motivo_anulacion, e.fecha_anulacion,
         e.usuario_creacion_id,
         CONCAT(uc.nombre, ' ', uc.apellido) AS usuario_creacion_nombre,
         e.usuario_modificacion_id,
         (
           SELECT COUNT(*)::text
           FROM afectaciones a
           WHERE a.expediente_id = e.id
             AND a.deleted_at IS NULL
             AND a.anulada = false
         ) AS afectaciones_activas,
         (
           SELECT COUNT(*)::text
           FROM anticipos ant
           WHERE ant.expediente_id = e.id
             AND ant.deleted_at IS NULL
             AND ant.anulada = false
         ) AS anticipos_activos,
         e.created_at, e.updated_at
  FROM expedientes e
  LEFT JOIN proveedores p ON p.id = e.proveedor_id
  LEFT JOIN usuarios uc ON uc.id = e.usuario_creacion_id
`;

async function loadProveedoresMap(expedienteIds: number[]): Promise<Map<number, ExpedienteProveedorRef[]>> {
  const map = new Map<number, ExpedienteProveedorRef[]>();
  if (expedienteIds.length === 0) return map;

  const result = await query<{
    expediente_id: number;
    id: number;
    nombre: string;
    documento: string | null;
  }>(
    `SELECT ep.expediente_id, p.id, p.nombre, p.documento
     FROM expediente_proveedores ep
     INNER JOIN proveedores p ON p.id = ep.proveedor_id
     WHERE ep.expediente_id = ANY($1)
     ORDER BY ep.expediente_id, ep.orden`,
    [expedienteIds]
  );

  for (const row of result.rows) {
    const list = map.get(row.expediente_id) ?? [];
    list.push({ id: row.id, nombre: row.nombre, documento: row.documento });
    map.set(row.expediente_id, list);
  }
  return map;
}

async function attachProveedores(expedientes: Expediente[]): Promise<Expediente[]> {
  if (expedientes.length === 0) return expedientes;
  const map = await loadProveedoresMap(expedientes.map((e) => e.id));
  return expedientes.map((e) => {
    const list = map.get(e.id) ?? e.proveedores ?? [];
    return {
      ...e,
      proveedores: list,
      proveedor_id: list[0]?.id ?? e.proveedor_id,
      proveedor_nombre: list.length > 0 ? formatProveedoresNombres(list) : e.proveedor_nombre,
    };
  });
}

async function replaceExpedienteProveedores(
  client: import('pg').PoolClient,
  expedienteId: number,
  proveedorIds: number[]
): Promise<void> {
  await client.query(`DELETE FROM expediente_proveedores WHERE expediente_id = $1`, [expedienteId]);
  for (let i = 0; i < proveedorIds.length; i++) {
    await client.query(
      `INSERT INTO expediente_proveedores (expediente_id, proveedor_id, orden)
       VALUES ($1, $2, $3)`,
      [expedienteId, proveedorIds[i], i + 1]
    );
  }
  await client.query(`UPDATE expedientes SET proveedor_id = $1, updated_at = NOW() WHERE id = $2`, [
    proveedorIds[0],
    expedienteId,
  ]);
}

export interface ListExpedientesParams {
  page: number;
  limit: number;
  search?: string;
  estado?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  proveedorId?: number;
  circuito?: Expediente['circuito'];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export async function findAll(params: ListExpedientesParams) {
  const {
    page, limit, search, estado, anio,
    fechaDesde, fechaHasta, anulado, proveedorId, circuito, sortBy, sortOrder,
  } = params;
  const offset = (page - 1) * limit;

  const allowedSort = [
    'numero', 'anio', 'fecha_ingreso',
    'importe', 'detalle', 'estado', 'created_at',
  ];
  const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

  let whereClause = 'WHERE e.deleted_at IS NULL';
  const values: unknown[] = [];

  if (search) {
    values.push(`%${search}%`);
    whereClause += ` AND (
      COALESCE(p.nombre, '') ILIKE $${values.length}
      OR e.detalle ILIKE $${values.length}
      OR CAST(e.numero AS TEXT) ILIKE $${values.length}
      OR CONCAT(e.numero, '/', e.anio) ILIKE $${values.length}
      OR CAST(e.importe AS TEXT) ILIKE $${values.length}
      OR EXISTS (
        SELECT 1 FROM expediente_proveedores ep
        INNER JOIN proveedores px ON px.id = ep.proveedor_id
        WHERE ep.expediente_id = e.id AND px.nombre ILIKE $${values.length}
      )
    )`;
  }
  if (estado) {
    values.push(estado);
    whereClause += ` AND e.estado = $${values.length}`;
  }
  if (anio) {
    values.push(anio);
    whereClause += ` AND e.anio = $${values.length}`;
  }
  if (fechaDesde) {
    values.push(fechaDesde);
    whereClause += ` AND e.fecha_ingreso >= $${values.length}`;
  }
  if (fechaHasta) {
    values.push(fechaHasta);
    whereClause += ` AND e.fecha_ingreso <= $${values.length}`;
  }
  if (anulado !== undefined) {
    values.push(anulado);
    whereClause += ` AND e.anulado = $${values.length}`;
  }
  if (proveedorId !== undefined) {
    values.push(proveedorId);
    whereClause += ` AND EXISTS (
      SELECT 1 FROM expediente_proveedores ep
      WHERE ep.expediente_id = e.id AND ep.proveedor_id = $${values.length}
    )`;
  }
  if (circuito) {
    values.push(circuito);
    whereClause += ` AND COALESCE(e.circuito, 'NORMAL') = $${values.length}`;
  }

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM expedientes e
     LEFT JOIN proveedores p ON p.id = e.proveedor_id
     ${whereClause}`,
    values
  );

  values.push(limit, offset);
  const dataResult = await query<ExpedienteRow>(
    `${SELECT_BASE} ${whereClause}
     ORDER BY e.${orderColumn} ${order}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  const data = await attachProveedores(dataResult.rows.map((row) => mapExpediente(row)));

  return {
    data,
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    page,
    limit,
  };
}

export async function findAllForExport(filters: Omit<ListExpedientesParams, 'page' | 'limit' | 'sortBy' | 'sortOrder'>) {
  const result = await findAll({
    ...filters,
    page: 1,
    limit: 100000,
    sortBy: 'numero',
    sortOrder: 'asc',
  });
  return result.data;
}

export async function findById(id: number): Promise<Expediente | null> {
  const result = await query<ExpedienteRow>(
    `${SELECT_BASE} WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [id]
  );
  if (!result.rows[0]) return null;
  const [expediente] = await attachProveedores([mapExpediente(result.rows[0])]);
  return expediente;
}

export async function getNextNumero(anio: number): Promise<number> {
  const result = await query<{ ultimo_numero: number }>(
    'SELECT ultimo_numero FROM expediente_numeracion WHERE anio = $1',
    [anio]
  );
  return (result.rows[0]?.ultimo_numero ?? 0) + 1;
}

export async function existsByNumeroAnio(numero: number, anio: number): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM expedientes
     WHERE numero = $1 AND anio = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [numero, anio]
  );
  return result.rowCount > 0;
}

export async function create(data: {
  /** Si se omite, se asigna el siguiente número de forma atómica dentro de la TX. */
  numero?: number;
  anio: number;
  proveedor_ids: number[];
  importe: number;
  detalle: string;
  fecha_ingreso: string;
  circuito?: Expediente['circuito'];
  usuario_creacion_id: number;
}): Promise<Expediente> {
  const newId = await withTransaction(async (client) => {
    let numero: number;
    if (data.numero != null) {
      const dup = await client.query(
        `SELECT 1 FROM expedientes
         WHERE numero = $1 AND anio = $2 AND deleted_at IS NULL LIMIT 1`,
        [data.numero, data.anio]
      );
      if (dup.rowCount && dup.rowCount > 0) {
        throw Object.assign(new Error('DUPLICATE_NUMERO'), { code: '23505' });
      }
      await bumpYearlyNumero(client, 'expediente_numeracion', data.anio, data.numero);
      numero = data.numero;
    } else {
      numero = await allocateYearlyNumero(client, 'expediente_numeracion', data.anio);
    }

    const result = await client.query<{ id: number }>(
      `INSERT INTO expedientes (
         numero, anio, proveedor_id, importe, detalle,
         fecha_ingreso, circuito, usuario_creacion_id, usuario_modificacion_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING id`,
      [
        numero,
        data.anio,
        data.proveedor_ids[0],
        data.importe,
        data.detalle,
        data.fecha_ingreso,
        data.circuito ?? 'PENDIENTE',
        data.usuario_creacion_id,
      ]
    );

    const expedienteId = result.rows[0].id;
    await replaceExpedienteProveedores(client, expedienteId, data.proveedor_ids);

    await client.query(
      `INSERT INTO expediente_historial (expediente_id, accion, estado_nuevo, observacion, usuario_id)
       VALUES ($1, 'CREACION', 'INICIADO', 'Expediente creado', $2)`,
      [expedienteId, data.usuario_creacion_id]
    );

    return expedienteId;
  });

  const expediente = await findById(newId);
  if (!expediente) {
    throw new Error('No se pudo recuperar el expediente creado');
  }
  return expediente;
}

export async function update(
  id: number,
  data: Partial<{
    proveedor_ids: number[];
    importe: number;
    detalle: string;
    fecha_ingreso: string;
    estado: Expediente['estado'];
    circuito: Expediente['circuito'];
    anulado: boolean;
    motivo_anulacion: string;
    fecha_anulacion: Date;
    usuario_modificacion_id: number;
  }>
): Promise<Expediente | null> {
  const { proveedor_ids, ...rest } = data;

  if (proveedor_ids !== undefined) {
    await withTransaction(async (client) => {
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) {
          fields.push(`${key} = $${paramIndex++}`);
          values.push(value);
        }
      }

      fields.push(`proveedor_id = $${paramIndex++}`);
      values.push(proveedor_ids[0]);
      fields.push('updated_at = NOW()');
      values.push(id);

      await client.query(
        `UPDATE expedientes SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL`,
        values
      );
      await replaceExpedienteProveedores(client, id, proveedor_ids);
    });
    return findById(id);
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) return findById(id);

  fields.push('updated_at = NOW()');
  values.push(id);

  await query(
    `UPDATE expedientes SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL`,
    values
  );

  return findById(id);
}

export async function softDelete(id: number): Promise<boolean> {
  const result = await query(
    `UPDATE expedientes SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return result.rowCount > 0;
}

export async function registrarHistorial(data: {
  expediente_id: number;
  accion: string;
  estado_anterior?: string;
  estado_nuevo?: string;
  observacion?: string;
  usuario_id: number;
}): Promise<void> {
  await query(
    `INSERT INTO expediente_historial (expediente_id, accion, estado_anterior, estado_nuevo, observacion, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      data.expediente_id,
      data.accion,
      data.estado_anterior ?? null,
      data.estado_nuevo ?? null,
      data.observacion ?? null,
      data.usuario_id,
    ]
  );
}

export async function getHistorial(expedienteId: number): Promise<ExpedienteHistorial[]> {
  const result = await query<ExpedienteHistorial & { usuario_nombre: string | null }>(
    `SELECT h.id, h.expediente_id, h.accion, h.estado_anterior, h.estado_nuevo,
            h.observacion, h.usuario_id,
            CONCAT(u.nombre, ' ', u.apellido) AS usuario_nombre,
            h.created_at
     FROM expediente_historial h
     LEFT JOIN usuarios u ON u.id = h.usuario_id
     WHERE h.expediente_id = $1
     ORDER BY h.created_at DESC`,
    [expedienteId]
  );
  return result.rows;
}

export async function countByEstado(circuito?: Expediente['circuito']) {
  const values: unknown[] = [];
  let where = 'WHERE deleted_at IS NULL AND anulado = false';
  if (circuito) {
    values.push(circuito);
    where += ` AND COALESCE(circuito, 'NORMAL') = $1`;
  }
  const result = await query<{ estado: string; total: string }>(
    `SELECT estado, COUNT(*)::text AS total
     FROM expedientes
     ${where}
     GROUP BY estado`,
    values
  );
  const counts: Record<string, number> = {
    INICIADO: 0,
    AFECTADO: 0,
    LIBRADO: 0,
    PAGADO: 0,
    ARCHIVADO: 0,
  };
  for (const row of result.rows) {
    counts[row.estado] = parseInt(row.total, 10);
  }
  return counts;
}

export async function countTotal(circuito?: Expediente['circuito']): Promise<number> {
  const values: unknown[] = [];
  let sql = 'SELECT COUNT(*)::text AS total FROM expedientes WHERE deleted_at IS NULL';
  if (circuito) {
    values.push(circuito);
    sql += ` AND COALESCE(circuito, 'NORMAL') = $1`;
  }
  const result = await query<{ total: string }>(sql, values);
  return parseInt(result.rows[0]?.total ?? '0', 10);
}
