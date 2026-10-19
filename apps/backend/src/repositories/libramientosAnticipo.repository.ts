import { query, withTransaction } from '../database/pool.js';
import type { LibramientoAnticipo } from '../entities/index.js';
import { formatLibramientoNumero } from '../utils/libramiento.utils.js';
import { formatAnticipoNumero } from '../utils/anticipo.utils.js';
import { allocateYearlyNumero, bumpYearlyNumero } from '../utils/numeracion.js';

interface Row {
  id: number;
  numero: number;
  anio: number;
  fecha: string;
  expediente_id: number;
  expediente_numero: string | null;
  anticipo_id: number;
  anticipo_nro: number | null;
  anticipo_fecha: string | null;
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

function mapRow(row: Row): LibramientoAnticipo {
  return {
    id: row.id,
    numero: row.numero,
    anio: row.anio,
    numero_completo: formatLibramientoNumero(row.numero, row.fecha),
    fecha: row.fecha,
    expediente_id: row.expediente_id,
    expediente_numero: row.expediente_numero ?? undefined,
    anticipo_id: row.anticipo_id,
    anticipo_numero:
      row.anticipo_nro != null && row.anticipo_fecha
        ? formatAnticipoNumero(row.anticipo_nro, row.anticipo_fecha)
        : undefined,
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
  };
}

const SELECT_BASE = `
  SELECT l.id, l.numero, l.anio, l.fecha::text, l.expediente_id,
         CONCAT(e.numero, '/', e.anio) AS expediente_numero,
         l.anticipo_id, ant.numero AS anticipo_nro, ant.fecha::text AS anticipo_fecha,
         l.beneficiario, l.importe::text, l.retenciones::text, l.neto::text,
         COALESCE(l.monto_pagado, 0)::text AS monto_pagado,
         l.numero_decreto, l.observaciones, l.anulado, l.motivo_anulacion, l.fecha_anulacion,
         l.pagado, l.fecha_pago::text,
         l.usuario_creacion_id,
         CONCAT(u.nombre, ' ', u.apellido) AS usuario_creacion_nombre,
         l.created_at, l.updated_at
  FROM libramientos_anticipo l
  INNER JOIN expedientes e ON e.id = l.expediente_id
  INNER JOIN anticipos ant ON ant.id = l.anticipo_id
  LEFT JOIN usuarios u ON u.id = l.usuario_creacion_id
`;

export interface ListParams {
  page: number;
  limit: number;
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  expedienteId?: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export async function findAll(params: ListParams) {
  const { page, limit, search, anio, fechaDesde, fechaHasta, anulado, expedienteId, sortBy, sortOrder } =
    params;
  const offset = (page - 1) * limit;
  const allowedSort = ['numero', 'anio', 'fecha', 'beneficiario', 'importe', 'neto', 'created_at'];
  const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

  let whereClause = `WHERE l.deleted_at IS NULL AND COALESCE(e.circuito, 'NORMAL') = 'CARGO_A_RENDIR'`;
  const values: unknown[] = [];

  if (search) {
    values.push(`%${search}%`);
    const term = `$${values.length}`;
    whereClause += ` AND (
      l.beneficiario ILIKE ${term}
      OR CAST(l.numero AS TEXT) ILIKE ${term}
      OR CONCAT(l.numero, '/', l.anio) ILIKE ${term}
      OR CONCAT(e.numero, '/', e.anio) ILIKE ${term}
      OR COALESCE(l.numero_decreto, '') ILIKE ${term}
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
  if (expedienteId) {
    values.push(expedienteId);
    whereClause += ` AND l.expediente_id = $${values.length}`;
  }

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM libramientos_anticipo l
     INNER JOIN expedientes e ON e.id = l.expediente_id
     ${whereClause}`,
    values
  );

  values.push(limit, offset);
  const dataResult = await query<Row>(
    `${SELECT_BASE} ${whereClause}
     ORDER BY l.${orderColumn} ${order}
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

export async function findAllForExport(filters: Omit<ListParams, 'page' | 'limit' | 'sortBy' | 'sortOrder'>) {
  const result = await findAll({ ...filters, page: 1, limit: 100000, sortBy: 'numero', sortOrder: 'asc' });
  return result.data;
}

export async function findById(id: number): Promise<LibramientoAnticipo | null> {
  const result = await query<Row>(`${SELECT_BASE} WHERE l.id = $1 AND l.deleted_at IS NULL`, [id]);
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0]);
}

export async function getNextNumero(anio: number): Promise<number> {
  const result = await query<{ ultimo_numero: number }>(
    'SELECT ultimo_numero FROM libramiento_anticipo_numeracion WHERE anio = $1',
    [anio]
  );
  return (result.rows[0]?.ultimo_numero ?? 0) + 1;
}

export async function existsByNumeroAnio(numero: number, anio: number, excludeId?: number): Promise<boolean> {
  const values: unknown[] = [numero, anio];
  let sql = `SELECT 1 FROM libramientos_anticipo WHERE numero = $1 AND anio = $2 AND deleted_at IS NULL`;
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND id <> $${values.length}`;
  }
  sql += ' LIMIT 1';
  const result = await query(sql, values);
  return result.rowCount > 0;
}

export interface CreateData {
  numero?: number;
  anio: number;
  fecha: string;
  expediente_id: number;
  anticipo_id: number;
  beneficiario: string;
  importe: number;
  retenciones: number;
  neto: number;
  numero_decreto?: string | null;
  observaciones?: string | null;
  usuario_creacion_id: number;
}

export async function create(data: CreateData): Promise<number> {
  return withTransaction(async (client) => {
    const antResult = await client.query<{
      id: number;
      expediente_id: number;
      importe: string;
      anulada: boolean;
      deleted_at: Date | null;
    }>(
      `SELECT id, expediente_id, importe::text, anulada, deleted_at
       FROM anticipos WHERE id = $1 FOR UPDATE`,
      [data.anticipo_id]
    );
    const anticipo = antResult.rows[0];
    if (!anticipo || anticipo.deleted_at) throw new Error('ANTICIPO_NOT_FOUND');
    if (anticipo.anulada) throw new Error('ANTICIPO_ANNULLED');
    if (anticipo.expediente_id !== data.expediente_id) throw new Error('ANTICIPO_EXPEDIENTE_MISMATCH');

    const libActivo = await client.query(
      `SELECT 1 FROM libramientos_anticipo
       WHERE anticipo_id = $1 AND deleted_at IS NULL AND anulado = false LIMIT 1`,
      [data.anticipo_id]
    );
    if (libActivo.rowCount && libActivo.rowCount > 0) throw new Error('ANTICIPO_YA_LIBRADO');

    const expResult = await client.query<{ estado: string; circuito: string; anulado: boolean }>(
      `SELECT estado, COALESCE(circuito, 'NORMAL') AS circuito, anulado
       FROM expedientes WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [data.expediente_id]
    );
    const expediente = expResult.rows[0];
    if (!expediente || expediente.anulado) throw new Error('EXPEDIENTE_NOT_FOUND');
    if (expediente.circuito !== 'CARGO_A_RENDIR') throw new Error('INVALID_CIRCUITO');
    if (expediente.estado !== 'AFECTADO') throw new Error('INVALID_EXPEDIENTE_STATE');

    if (data.importe > parseFloat(anticipo.importe) + 0.001) {
      throw new Error('IMPORTE_EXCEEDS_ANTICIPO');
    }

    let numero: number;
    if (data.numero != null) {
      const dup = await client.query(
        `SELECT 1 FROM libramientos_anticipo
         WHERE numero = $1 AND anio = $2 AND deleted_at IS NULL LIMIT 1`,
        [data.numero, data.anio]
      );
      if (dup.rowCount && dup.rowCount > 0) {
        throw Object.assign(new Error('DUPLICATE_NUMERO'), { code: '23505' });
      }
      await bumpYearlyNumero(client, 'libramiento_anticipo_numeracion', data.anio, data.numero);
      numero = data.numero;
    } else {
      numero = await allocateYearlyNumero(client, 'libramiento_anticipo_numeracion', data.anio);
    }

    const libResult = await client.query<{ id: number }>(
      `INSERT INTO libramientos_anticipo (
         numero, anio, fecha, expediente_id, anticipo_id, beneficiario,
         importe, retenciones, neto, numero_decreto, observaciones,
         usuario_creacion_id, usuario_modificacion_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING id`,
      [
        numero, data.anio, data.fecha, data.expediente_id, data.anticipo_id,
        data.beneficiario, data.importe, data.retenciones, data.neto,
        data.numero_decreto ?? null, data.observaciones ?? null, data.usuario_creacion_id,
      ]
    );

    await client.query(
      `UPDATE expedientes SET estado = 'LIBRADO', usuario_modificacion_id = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL`,
      [data.usuario_creacion_id, data.expediente_id]
    );

    await client.query(
      `INSERT INTO expediente_historial (expediente_id, accion, estado_anterior, estado_nuevo, observacion, usuario_id)
       VALUES ($1, 'LIBRAMIENTO_ANTICIPO', 'AFECTADO', 'LIBRADO', $2, $3)`,
      [
        data.expediente_id,
        `Libramiento de anticipo ${formatLibramientoNumero(numero, data.fecha)}`,
        data.usuario_creacion_id,
      ]
    );

    return libResult.rows[0].id;
  });
}

export async function anular(id: number, motivo: string, usuarioId: number): Promise<void> {
  await withTransaction(async (client) => {
    const libResult = await client.query<{
      id: number;
      expediente_id: number;
      numero: number;
      fecha: string;
      anulado: boolean;
      pagado: boolean;
      monto_pagado: string;
      deleted_at: Date | null;
    }>(
      `SELECT id, expediente_id, numero, fecha::text, anulado, pagado,
              COALESCE(monto_pagado, 0)::text AS monto_pagado, deleted_at
       FROM libramientos_anticipo WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const lib = libResult.rows[0];
    if (!lib || lib.deleted_at) throw new Error('LIBRAMIENTO_NOT_FOUND');
    if (lib.anulado) throw new Error('ALREADY_ANNULLED');
    if (lib.pagado || parseFloat(lib.monto_pagado) > 0.01) throw new Error('HAS_PAYMENTS');

    await client.query(
      `UPDATE libramientos_anticipo SET anulado = true, motivo_anulacion = $1, fecha_anulacion = NOW(),
              usuario_modificacion_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [motivo, usuarioId, id]
    );

    const active = await client.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM libramientos_anticipo
       WHERE expediente_id = $1 AND deleted_at IS NULL AND anulado = false`,
      [lib.expediente_id]
    );
    if (parseInt(active.rows[0]?.total ?? '0', 10) === 0) {
      await client.query(
        `UPDATE expedientes SET estado = 'AFECTADO', usuario_modificacion_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [usuarioId, lib.expediente_id]
      );
      await client.query(
        `INSERT INTO expediente_historial (expediente_id, accion, estado_anterior, estado_nuevo, observacion, usuario_id)
         VALUES ($1, 'ANULACION_LIBRAMIENTO_ANTICIPO', 'LIBRADO', 'AFECTADO', $2, $3)`,
        [lib.expediente_id, `Anulación libramiento de anticipo ${formatLibramientoNumero(lib.numero, lib.fecha)}`, usuarioId]
      );
    }
  });
}

export async function getResumenTotales() {
  const result = await query<{ total: string; importe: string; neto: string }>(
    `SELECT COUNT(*)::text AS total,
            COALESCE(SUM(l.importe), 0)::text AS importe,
            COALESCE(SUM(l.neto), 0)::text AS neto
     FROM libramientos_anticipo l
     INNER JOIN expedientes e ON e.id = l.expediente_id
     WHERE l.deleted_at IS NULL AND l.anulado = false
       AND COALESCE(e.circuito, 'NORMAL') = 'CARGO_A_RENDIR'`
  );
  return {
    total: parseInt(result.rows[0]?.total ?? '0', 10),
    importeTotal: parseFloat(result.rows[0]?.importe ?? '0'),
    netoTotal: parseFloat(result.rows[0]?.neto ?? '0'),
  };
}
