import { query, withTransaction } from '../database/pool.js';
import type { Libramiento, LibramientoDetalle } from '../entities/index.js';
import { formatLibramientoNumero } from '../utils/libramiento.utils.js';
import { allocateYearlyNumero, bumpYearlyNumero } from '../utils/numeracion.js';

interface LibramientoRow {
  id: number;
  numero: number;
  anio: number;
  fecha: string;
  expediente_id: number;
  expediente_numero: string | null;
  afectacion_id: number;
  afectacion_numero: string | null;
  beneficiario: string;
  importe: string;
  retenciones: string;
  neto: string;
  monto_pagado: string;
  numero_decreto: string | null;
  observaciones: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: Date | null;
  pagado: boolean;
  fecha_pago: string | null;
  usuario_creacion_id: number | null;
  usuario_creacion_nombre: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapLibramiento(row: LibramientoRow, detalle?: LibramientoDetalle[]): Libramiento {
  return {
    id: row.id,
    numero: row.numero,
    anio: row.anio,
    numero_completo: formatLibramientoNumero(row.numero, row.fecha),
    fecha: row.fecha,
    expediente_id: row.expediente_id,
    expediente_numero: row.expediente_numero ?? undefined,
    afectacion_id: row.afectacion_id,
    afectacion_numero: row.afectacion_numero ?? undefined,
    beneficiario: row.beneficiario,
    importe: parseFloat(row.importe),
    retenciones: parseFloat(row.retenciones),
    neto: parseFloat(row.neto),
    monto_pagado: parseFloat(row.monto_pagado),
    numero_decreto: row.numero_decreto,
    observaciones: row.observaciones,
    anulado: row.anulado,
    motivo_anulacion: row.motivo_anulacion,
    fecha_anulacion: row.fecha_anulacion,
    pagado: row.pagado,
    fecha_pago: row.fecha_pago,
    usuario_creacion_id: row.usuario_creacion_id,
    usuario_creacion_nombre: row.usuario_creacion_nombre,
    created_at: row.created_at,
    updated_at: row.updated_at,
    detalle,
  };
}

const SELECT_BASE = `
  SELECT l.id, l.numero, l.anio, l.fecha::text, l.expediente_id,
         CONCAT(e.numero, '/', e.anio) AS expediente_numero,
         l.afectacion_id,
         CONCAT(a.numero, '/', a.anio) AS afectacion_numero,
         l.beneficiario, l.importe::text, l.retenciones::text, l.neto::text,
         COALESCE(l.monto_pagado, 0)::text AS monto_pagado,
         l.numero_decreto, l.observaciones, l.anulado, l.motivo_anulacion, l.fecha_anulacion,
         l.pagado, l.fecha_pago::text,
         l.usuario_creacion_id,
         CONCAT(u.nombre, ' ', u.apellido) AS usuario_creacion_nombre,
         l.created_at, l.updated_at
  FROM libramientos l
  INNER JOIN expedientes e ON e.id = l.expediente_id
  INNER JOIN afectaciones a ON a.id = l.afectacion_id
  LEFT JOIN usuarios u ON u.id = l.usuario_creacion_id
`;

export interface ListLibramientosParams {
  page: number;
  limit: number;
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  pagado?: boolean;
  expedienteId?: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export async function findAll(params: ListLibramientosParams) {
  const { page, limit, search, anio, fechaDesde, fechaHasta, anulado, pagado, expedienteId, sortBy, sortOrder } = params;
  const offset = (page - 1) * limit;

  const allowedSort = ['numero', 'anio', 'fecha', 'beneficiario', 'importe', 'neto', 'created_at'];
  const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

  let whereClause = 'WHERE l.deleted_at IS NULL';
  const values: unknown[] = [];

  if (search) {
    values.push(`%${search}%`);
    whereClause += ` AND (
      l.beneficiario ILIKE $${values.length}
      OR CAST(l.numero AS TEXT) ILIKE $${values.length}
      OR CONCAT(l.numero, '/', l.anio) ILIKE $${values.length}
      OR CONCAT(e.numero, '/', e.anio) ILIKE $${values.length}
      OR COALESCE(l.numero_decreto, '') ILIKE $${values.length}
    )`;
  }
  if (anio) {
    values.push(anio);
    whereClause += ` AND l.anio = $${values.length}`;
  }
  if (fechaDesde) {
    values.push(fechaDesde);
    whereClause += ` AND l.fecha >= $${values.length}`;
  }
  if (fechaHasta) {
    values.push(fechaHasta);
    whereClause += ` AND l.fecha <= $${values.length}`;
  }
  if (anulado !== undefined) {
    values.push(anulado);
    whereClause += ` AND l.anulado = $${values.length}`;
  }
  if (pagado !== undefined) {
    values.push(pagado);
    whereClause += ` AND l.pagado = $${values.length}`;
  }
  if (expedienteId) {
    values.push(expedienteId);
    whereClause += ` AND l.expediente_id = $${values.length}`;
  }

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM libramientos l
     INNER JOIN expedientes e ON e.id = l.expediente_id
     ${whereClause}`,
    values
  );

  values.push(limit, offset);
  const dataResult = await query<LibramientoRow>(
    `${SELECT_BASE} ${whereClause}
     ORDER BY l.${orderColumn} ${order}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return {
    data: dataResult.rows.map((r) => mapLibramiento(r)),
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    page,
    limit,
  };
}

export async function findAllForExport(filters: Omit<ListLibramientosParams, 'page' | 'limit' | 'sortBy' | 'sortOrder'>) {
  const result = await findAll({ ...filters, page: 1, limit: 100000, sortBy: 'numero', sortOrder: 'asc' });
  return result.data;
}

export async function findDetalleByLibramientoId(libramientoId: number): Promise<LibramientoDetalle[]> {
  const result = await query<LibramientoDetalle & { cuenta_codigo: string; cuenta_descripcion: string }>(
    `SELECT d.id, d.libramiento_id, d.afectacion_detalle_id, d.cuenta_id,
            c.codigo AS cuenta_codigo, c.descripcion AS cuenta_descripcion,
            d.descripcion, d.importe::float8 AS importe, d.created_at
     FROM libramiento_detalle d
     INNER JOIN cuentas c ON c.id = d.cuenta_id
     WHERE d.libramiento_id = $1
     ORDER BY d.id`,
    [libramientoId]
  );
  return result.rows;
}

export async function findById(id: number, includeDetalle = false): Promise<Libramiento | null> {
  const result = await query<LibramientoRow>(
    `${SELECT_BASE} WHERE l.id = $1 AND l.deleted_at IS NULL`,
    [id]
  );
  if (!result.rows[0]) return null;
  const detalle = includeDetalle ? await findDetalleByLibramientoId(id) : undefined;
  return mapLibramiento(result.rows[0], detalle);
}

export async function getNextNumero(anio: number): Promise<number> {
  const result = await query<{ ultimo_numero: number }>(
    'SELECT ultimo_numero FROM libramiento_numeracion WHERE anio = $1',
    [anio]
  );
  return (result.rows[0]?.ultimo_numero ?? 0) + 1;
}

export async function existsByNumeroAnio(
  numero: number,
  anio: number,
  excludeId?: number
): Promise<boolean> {
  const values: unknown[] = [numero, anio];
  let sql = `SELECT 1 FROM libramientos
             WHERE numero = $1 AND anio = $2 AND deleted_at IS NULL`;
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND id != $3`;
  }
  sql += ' LIMIT 1';
  const result = await query(sql, values);
  return result.rowCount > 0;
}

export async function hasActiveLibramiento(afectacionId: number, excludeId?: number): Promise<boolean> {
  const values: unknown[] = [afectacionId];
  let sql = `SELECT 1 FROM libramientos
             WHERE afectacion_id = $1 AND deleted_at IS NULL AND anulado = false`;
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND id != $2`;
  }
  sql += ' LIMIT 1';
  const result = await query(sql, values);
  return result.rowCount > 0;
}

export interface CreateLibramientoData {
  /** Si se omite, se asigna el siguiente número anual de forma atómica en la TX. */
  numero?: number;
  anio: number;
  fecha: string;
  expediente_id: number;
  afectacion_id: number;
  beneficiario: string;
  importe: number;
  retenciones: number;
  neto: number;
  numero_decreto?: string | null;
  observaciones?: string;
  usuario_creacion_id: number;
  detalle: Array<{
    afectacion_detalle_id?: number;
    cuenta_id: number;
    descripcion: string;
    importe: number;
  }>;
}

export async function create(data: CreateLibramientoData): Promise<number> {
  return withTransaction(async (client) => {
    const afResult = await client.query<{
      id: number;
      expediente_id: number;
      importe_total: string;
      anulada: boolean;
    }>(
      `SELECT id, expediente_id, importe_total::text AS importe_total, anulada
       FROM afectaciones
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [data.afectacion_id]
    );
    const afectacion = afResult.rows[0];
    if (!afectacion || afectacion.anulada) {
      throw new Error('AFECTACION_NOT_FOUND');
    }
    if (afectacion.expediente_id !== data.expediente_id) {
      throw new Error('AFECTACION_EXPEDIENTE_MISMATCH');
    }

    const libActivo = await client.query(
      `SELECT 1 FROM libramientos
       WHERE afectacion_id = $1 AND deleted_at IS NULL AND anulado = false
       LIMIT 1`,
      [data.afectacion_id]
    );
    if (libActivo.rowCount && libActivo.rowCount > 0) {
      throw new Error('AFECTACION_YA_LIBRADA');
    }

    const expResult = await client.query<{ estado: string; anulado: boolean }>(
      `SELECT estado, anulado FROM expedientes
       WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [data.expediente_id]
    );
    const expediente = expResult.rows[0];
    if (!expediente || expediente.anulado) {
      throw new Error('EXPEDIENTE_NOT_FOUND');
    }
    if (expediente.estado !== 'AFECTADO') {
      throw new Error('INVALID_EXPEDIENTE_STATE');
    }

    if (data.importe > parseFloat(afectacion.importe_total) + 0.001) {
      throw new Error('IMPORTE_EXCEEDS_AFECTACION');
    }

    let numero: number;
    if (data.numero != null) {
      const dup = await client.query(
        `SELECT 1 FROM libramientos
         WHERE numero = $1 AND anio = $2 AND deleted_at IS NULL LIMIT 1`,
        [data.numero, data.anio]
      );
      if (dup.rowCount && dup.rowCount > 0) {
        throw Object.assign(new Error('DUPLICATE_NUMERO'), { code: '23505' });
      }
      await bumpYearlyNumero(client, 'libramiento_numeracion', data.anio, data.numero);
      numero = data.numero;
    } else {
      numero = await allocateYearlyNumero(client, 'libramiento_numeracion', data.anio);
    }

    const libResult = await client.query<{ id: number }>(
      `INSERT INTO libramientos (numero, anio, fecha, expediente_id, afectacion_id, beneficiario,
                                 importe, retenciones, neto, numero_decreto, observaciones,
                                 usuario_creacion_id, usuario_modificacion_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING id`,
      [
        numero,
        data.anio,
        data.fecha,
        data.expediente_id,
        data.afectacion_id,
        data.beneficiario,
        data.importe,
        data.retenciones,
        data.neto,
        data.numero_decreto?.trim() || null,
        data.observaciones ?? null,
        data.usuario_creacion_id,
      ]
    );

    const libramientoId = libResult.rows[0].id;

    for (const line of data.detalle) {
      await client.query(
        `INSERT INTO libramiento_detalle (libramiento_id, afectacion_detalle_id, cuenta_id, descripcion, importe)
         VALUES ($1, $2, $3, $4, $5)`,
        [libramientoId, line.afectacion_detalle_id ?? null, line.cuenta_id, line.descripcion, line.importe]
      );
    }

    await client.query(
      `UPDATE expedientes SET estado = 'LIBRADO', usuario_modificacion_id = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL`,
      [data.usuario_creacion_id, data.expediente_id]
    );

    const numeroCompleto = formatLibramientoNumero(numero, data.fecha);
    await client.query(
      `INSERT INTO expediente_historial (expediente_id, accion, estado_anterior, estado_nuevo, observacion, usuario_id)
       VALUES ($1, 'LIBRAMIENTO', 'AFECTADO', 'LIBRADO', $2, $3)`,
      [
        data.expediente_id,
        `Libramiento ${numeroCompleto} — Neto: ${data.neto}`,
        data.usuario_creacion_id,
      ]
    );

    return libramientoId;
  });
}

export async function anular(id: number, motivo: string, usuarioId: number): Promise<void> {
  await withTransaction(async (client) => {
    const libResult = await client.query<{
      id: number;
      expediente_id: number;
      numero: number;
      anio: number;
      anulado: boolean;
      pagado: boolean;
      monto_pagado: string;
      deleted_at: Date | null;
    }>(
      `SELECT id, expediente_id, numero, anio, anulado, pagado,
              COALESCE(monto_pagado, 0)::text AS monto_pagado, deleted_at
       FROM libramientos WHERE id = $1 FOR UPDATE`,
      [id]
    );

    const libramiento = libResult.rows[0];
    if (!libramiento || libramiento.deleted_at) throw new Error('LIBRAMIENTO_NOT_FOUND');
    if (libramiento.anulado) throw new Error('ALREADY_ANNULLED');
    if (libramiento.pagado) throw new Error('ALREADY_PAID');
    if (parseFloat(libramiento.monto_pagado) > 0.01) throw new Error('HAS_PAYMENTS');

    await client.query(
      `UPDATE libramientos SET anulado = true, motivo_anulacion = $1, fecha_anulacion = NOW(),
              usuario_modificacion_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [motivo, usuarioId, id]
    );

    const activeCount = await client.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM libramientos
       WHERE expediente_id = $1 AND deleted_at IS NULL AND anulado = false`,
      [libramiento.expediente_id]
    );

    if (parseInt(activeCount.rows[0]?.total ?? '0', 10) === 0) {
      await client.query(
        `UPDATE expedientes SET estado = 'AFECTADO', usuario_modificacion_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [usuarioId, libramiento.expediente_id]
      );

      await client.query(
        `INSERT INTO expediente_historial (expediente_id, accion, estado_anterior, estado_nuevo, observacion, usuario_id)
         VALUES ($1, 'ANULACION_LIBRAMIENTO', 'LIBRADO', 'AFECTADO', $2, $3)`,
        [libramiento.expediente_id, `Anulación libramiento ${libramiento.numero}/${libramiento.anio}`, usuarioId]
      );
    }
  });
}

export async function countTotal(): Promise<number> {
  const result = await query<{ total: string }>(
    'SELECT COUNT(*)::text AS total FROM libramientos WHERE deleted_at IS NULL AND anulado = false'
  );
  return parseInt(result.rows[0]?.total ?? '0', 10);
}

export async function getResumenTotales() {
  const result = await query<{ total: string; importe: string; neto: string }>(
    `SELECT COUNT(*)::text AS total,
            COALESCE(SUM(importe), 0)::text AS importe,
            COALESCE(SUM(neto), 0)::text AS neto
     FROM libramientos WHERE deleted_at IS NULL AND anulado = false`
  );
  return {
    total: parseInt(result.rows[0]?.total ?? '0', 10),
    importeTotal: parseFloat(result.rows[0]?.importe ?? '0'),
    netoTotal: parseFloat(result.rows[0]?.neto ?? '0'),
  };
}
