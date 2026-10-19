import type { PoolClient } from 'pg';
import { query, withTransaction } from '../database/pool.js';
import type { Afectacion, AfectacionDetalle } from '../entities/index.js';
import { formatAfectacionNumero } from '../utils/afectacion.utils.js';
import { allocateYearlyNumero, bumpYearlyNumero } from '../utils/numeracion.js';

interface AfectacionRow {
  id: number;
  numero: number;
  anio: number;
  fecha: string;
  expediente_id: number;
  expediente_numero: string | null;
  destinatario: string;
  importe_total: string;
  observaciones: string | null;
  numero_comprobante: string | null;
  anulada: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: Date | null;
  usuario_creacion_id: number | null;
  usuario_creacion_nombre: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapAfectacion(row: AfectacionRow, detalle?: AfectacionDetalle[]): Afectacion {
  return {
    id: row.id,
    numero: row.numero,
    anio: row.anio,
    numero_completo: formatAfectacionNumero(row.numero, row.fecha),
    fecha: row.fecha,
    expediente_id: row.expediente_id,
    expediente_numero: row.expediente_numero ?? undefined,
    destinatario: row.destinatario,
    importe_total: parseFloat(row.importe_total),
    observaciones: row.observaciones,
    numero_comprobante: row.numero_comprobante,
    anulada: row.anulada,
    motivo_anulacion: row.motivo_anulacion,
    fecha_anulacion: row.fecha_anulacion,
    usuario_creacion_id: row.usuario_creacion_id,
    usuario_creacion_nombre: row.usuario_creacion_nombre,
    created_at: row.created_at,
    updated_at: row.updated_at,
    detalle,
  };
}

const SELECT_BASE = `
  SELECT a.id, a.numero, a.anio, a.fecha::text, a.expediente_id,
         CONCAT(e.numero, '/', e.anio) AS expediente_numero,
         a.destinatario, a.importe_total::text, a.observaciones, a.numero_comprobante, a.anulada,
         a.motivo_anulacion, a.fecha_anulacion,
         a.usuario_creacion_id,
         CONCAT(u.nombre, ' ', u.apellido) AS usuario_creacion_nombre,
         a.created_at, a.updated_at
  FROM afectaciones a
  INNER JOIN expedientes e ON e.id = a.expediente_id
  LEFT JOIN usuarios u ON u.id = a.usuario_creacion_id
`;

export interface ListAfectacionesParams {
  page: number;
  limit: number;
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulada?: boolean;
  expedienteId?: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export async function findAll(params: ListAfectacionesParams) {
  const { page, limit, search, anio, fechaDesde, fechaHasta, anulada, expedienteId, sortBy, sortOrder } = params;
  const offset = (page - 1) * limit;

  const allowedSort = ['numero', 'anio', 'fecha', 'destinatario', 'importe_total', 'created_at'];
  const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

  let whereClause = 'WHERE a.deleted_at IS NULL';
  const values: unknown[] = [];

  if (search) {
    values.push(`%${search}%`);
    const term = `$${values.length}`;
    const codigoNorm = search.replace(/[.\s]/g, '');
    let codigoMatch = '';
    if (codigoNorm.length > 0) {
      values.push(`%${codigoNorm}%`);
      const termCodigo = `$${values.length}`;
      codigoMatch = `OR REPLACE(c.codigo, '.', '') ILIKE ${termCodigo}`;
    }
    whereClause += ` AND (
      a.destinatario ILIKE ${term}
      OR COALESCE(a.observaciones, '') ILIKE ${term}
      OR COALESCE(a.numero_comprobante, '') ILIKE ${term}
      OR CAST(a.numero AS TEXT) ILIKE ${term}
      OR CONCAT(a.numero, '/', a.anio) ILIKE ${term}
      OR CONCAT(e.numero, '/', e.anio) ILIKE ${term}
      OR EXISTS (
        SELECT 1
        FROM afectacion_detalle d
        INNER JOIN cuentas c ON c.id = d.cuenta_id AND c.deleted_at IS NULL
        WHERE d.afectacion_id = a.id
          AND (
            c.codigo ILIKE ${term}
            ${codigoMatch}
            OR c.descripcion ILIKE ${term}
            OR COALESCE(d.descripcion, '') ILIKE ${term}
          )
      )
    )`;
  }
  if (anio) {
    values.push(anio);
    whereClause += ` AND a.anio = $${values.length}`;
  }
  if (fechaDesde) {
    values.push(fechaDesde);
    whereClause += ` AND a.fecha >= $${values.length}`;
  }
  if (fechaHasta) {
    values.push(fechaHasta);
    whereClause += ` AND a.fecha <= $${values.length}`;
  }
  if (anulada !== undefined) {
    values.push(anulada);
    whereClause += ` AND a.anulada = $${values.length}`;
  }
  if (expedienteId) {
    values.push(expedienteId);
    whereClause += ` AND a.expediente_id = $${values.length}`;
  }

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM afectaciones a
     INNER JOIN expedientes e ON e.id = a.expediente_id
     ${whereClause}`,
    values
  );

  values.push(limit, offset);
  const dataResult = await query<AfectacionRow>(
    `${SELECT_BASE} ${whereClause}
     ORDER BY a.${orderColumn} ${order}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return {
    data: dataResult.rows.map((r) => mapAfectacion(r)),
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    page,
    limit,
  };
}

export async function findAllForExport(filters: Omit<ListAfectacionesParams, 'page' | 'limit' | 'sortBy' | 'sortOrder'>) {
  const result = await findAll({
    ...filters,
    page: 1,
    limit: 100000,
    sortBy: 'fecha',
    sortOrder: 'desc',
  });
  return result.data;
}

export async function findDetalleByAfectacionId(afectacionId: number): Promise<AfectacionDetalle[]> {
  const result = await query<AfectacionDetalle & { cuenta_codigo: string; cuenta_descripcion: string }>(
    `SELECT d.id, d.afectacion_id, d.cuenta_id, c.codigo AS cuenta_codigo,
            c.descripcion AS cuenta_descripcion, d.descripcion, d.importe::float8 AS importe, d.created_at
     FROM afectacion_detalle d
     INNER JOIN cuentas c ON c.id = d.cuenta_id
     WHERE d.afectacion_id = $1
     ORDER BY d.id`,
    [afectacionId]
  );
  return result.rows;
}

export async function findById(id: number, includeDetalle = false): Promise<Afectacion | null> {
  const result = await query<AfectacionRow>(
    `${SELECT_BASE} WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [id]
  );
  if (!result.rows[0]) return null;

  const detalle = includeDetalle ? await findDetalleByAfectacionId(id) : undefined;
  return mapAfectacion(result.rows[0], detalle);
}

export async function getNextNumero(anio: number): Promise<number> {
  const result = await query<{ ultimo_numero: number }>(
    'SELECT ultimo_numero FROM afectacion_numeracion WHERE anio = $1',
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
  let sql = `SELECT 1 FROM afectaciones
             WHERE numero = $1 AND anio = $2 AND deleted_at IS NULL`;
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND id != $3`;
  }
  sql += ' LIMIT 1';
  const result = await query(sql, values);
  return result.rowCount > 0;
}

export async function hasActiveLibramiento(afectacionId: number): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM libramientos
     WHERE afectacion_id = $1 AND deleted_at IS NULL AND anulada = false
     LIMIT 1`,
    [afectacionId]
  );
  return result.rowCount > 0;
}

export async function getImporteAfectadoActivo(
  expedienteId: number,
  excludeId?: number
): Promise<number> {
  const values: unknown[] = [expedienteId];
  let sql = `SELECT COALESCE(SUM(importe_total), 0)::text AS total
             FROM afectaciones
             WHERE expediente_id = $1 AND deleted_at IS NULL AND anulada = false`;
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND id != $2`;
  }
  const result = await query<{ total: string }>(sql, values);
  return parseFloat(result.rows[0]?.total ?? '0');
}

export async function findResumenByExpediente(expedienteId: number) {
  const result = await query<{
    id: number;
    numero: number;
    fecha: string;
    importe_total: string;
    observaciones: string | null;
    numero_comprobante: string | null;
    anulada: boolean;
  }>(
    `SELECT id, numero, fecha::text, importe_total::text, observaciones, numero_comprobante, anulada
     FROM afectaciones
     WHERE expediente_id = $1 AND deleted_at IS NULL
     ORDER BY fecha DESC, numero DESC, id DESC`,
    [expedienteId]
  );

  return result.rows.map((r) => ({
    id: r.id,
    numero_completo: formatAfectacionNumero(r.numero, r.fecha),
    fecha: r.fecha,
    importe_total: parseFloat(r.importe_total),
    observaciones: r.observaciones,
    numero_comprobante: r.numero_comprobante,
    anulada: r.anulada,
  }));
}

export async function hasActiveAfectacion(expedienteId: number, excludeId?: number): Promise<boolean> {
  const values: unknown[] = [expedienteId];
  let sql = `SELECT 1 FROM afectaciones
             WHERE expediente_id = $1 AND deleted_at IS NULL AND anulada = false`;
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND id != $2`;
  }
  sql += ' LIMIT 1';
  const result = await query(sql, values);
  return result.rowCount > 0;
}

export async function countActiveByExpediente(expedienteId: number): Promise<number> {
  const result = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM afectaciones
     WHERE expediente_id = $1 AND deleted_at IS NULL AND anulada = false`,
    [expedienteId]
  );
  return parseInt(result.rows[0]?.total ?? '0', 10);
}

export interface CreateAfectacionData {
  /** Si se omite, se asigna el siguiente número anual de forma atómica en la TX. */
  numero?: number;
  anio: number;
  fecha: string;
  expediente_id: number;
  destinatario: string;
  importe_total: number;
  observaciones: string | null;
  numero_comprobante: string | null;
  usuario_creacion_id: number;
  /** Solo informativo; el estado real se revalida con FOR UPDATE en la TX. */
  estado_anterior: string;
  detalle: Array<{ cuenta_id: number; descripcion: string; importe: number }>;
}

async function applyCuentaSaldos(
  client: PoolClient,
  detalle: Array<{ cuenta_id: number; importe: number }>,
  direction: 1 | -1
) {
  const cuentaTotales = new Map<number, number>();
  for (const line of detalle) {
    cuentaTotales.set(line.cuenta_id, (cuentaTotales.get(line.cuenta_id) ?? 0) + line.importe);
  }

  for (const [cuentaId, total] of cuentaTotales) {
    if (direction === 1) {
      const cuentaResult = await client.query<{
        saldo_inicial: string;
        saldo_afectado: string;
        estado: string;
        deleted_at: Date | null;
      }>(
        `SELECT saldo_inicial::text AS saldo_inicial, saldo_afectado::text AS saldo_afectado,
                estado, deleted_at
         FROM cuentas WHERE id = $1 FOR UPDATE`,
        [cuentaId]
      );
      const cuenta = cuentaResult.rows[0];
      if (!cuenta || cuenta.deleted_at) {
        throw new Error(`CUENTA_NOT_FOUND:${cuentaId}`);
      }
      if (cuenta.estado !== 'ACTIVA') {
        throw new Error(`CUENTA_INACTIVE:${cuentaId}`);
      }
      const disponible = parseFloat(cuenta.saldo_inicial) - parseFloat(cuenta.saldo_afectado);
      if (disponible < total - 0.001) {
        throw new Error(`INSUFFICIENT_BALANCE:${cuentaId}:${disponible}:${total}`);
      }
      await client.query(
        `UPDATE cuentas SET saldo_afectado = saldo_afectado + $1, updated_at = NOW() WHERE id = $2`,
        [total, cuentaId]
      );
    } else {
      await client.query(
        `UPDATE cuentas SET saldo_afectado = saldo_afectado - $1, updated_at = NOW()
         WHERE id = $2 AND saldo_afectado >= $1`,
        [total, cuentaId]
      );
    }
  }
}

export async function create(data: CreateAfectacionData): Promise<number> {
  return withTransaction(async (client) => {
    const expResult = await client.query<{
      id: number;
      importe: string;
      estado: string;
      anulado: boolean;
    }>(
      `SELECT id, importe::text AS importe, estado, anulado
       FROM expedientes
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [data.expediente_id]
    );
    const expediente = expResult.rows[0];
    if (!expediente || expediente.anulado) {
      throw new Error('EXPEDIENTE_NOT_FOUND');
    }
    if (expediente.estado !== 'INICIADO' && expediente.estado !== 'AFECTADO') {
      throw new Error('INVALID_EXPEDIENTE_STATE');
    }

    const afectadoResult = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(importe_total), 0)::text AS total
       FROM afectaciones
       WHERE expediente_id = $1 AND deleted_at IS NULL AND anulada = false`,
      [data.expediente_id]
    );
    const afectado = parseFloat(afectadoResult.rows[0]?.total ?? '0');
    const disponible = Number((parseFloat(expediente.importe) - afectado).toFixed(2));
    if (data.importe_total > disponible + 0.001) {
      throw new Error('IMPORTE_EXCEEDS_EXPEDIENTE');
    }

    let numero: number;
    if (data.numero != null) {
      const dup = await client.query(
        `SELECT 1 FROM afectaciones
         WHERE numero = $1 AND anio = $2 AND deleted_at IS NULL LIMIT 1`,
        [data.numero, data.anio]
      );
      if (dup.rowCount && dup.rowCount > 0) {
        throw Object.assign(new Error('DUPLICATE_NUMERO'), { code: '23505' });
      }
      await bumpYearlyNumero(client, 'afectacion_numeracion', data.anio, data.numero);
      numero = data.numero;
    } else {
      numero = await allocateYearlyNumero(client, 'afectacion_numeracion', data.anio);
    }

    await applyCuentaSaldos(client, data.detalle, 1);

    const afectacionResult = await client.query<{ id: number }>(
      `INSERT INTO afectaciones (
         numero, anio, fecha, expediente_id, destinatario, importe_total, observaciones,
         numero_comprobante, usuario_creacion_id, usuario_modificacion_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING id`,
      [
        numero,
        data.anio,
        data.fecha,
        data.expediente_id,
        data.destinatario,
        data.importe_total,
        data.observaciones,
        data.numero_comprobante,
        data.usuario_creacion_id,
      ]
    );

    const afectacionId = afectacionResult.rows[0].id;

    for (const line of data.detalle) {
      await client.query(
        `INSERT INTO afectacion_detalle (afectacion_id, cuenta_id, descripcion, importe)
         VALUES ($1, $2, $3, $4)`,
        [afectacionId, line.cuenta_id, line.descripcion, line.importe]
      );
    }

    await client.query(
      `UPDATE expedientes SET estado = 'AFECTADO', usuario_modificacion_id = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL`,
      [data.usuario_creacion_id, data.expediente_id]
    );

    const estadoAnterior = expediente.estado === 'AFECTADO' ? 'AFECTADO' : 'INICIADO';
    await client.query(
      `INSERT INTO expediente_historial (expediente_id, accion, estado_anterior, estado_nuevo, observacion, usuario_id)
       VALUES ($1, 'AFECTACION', $2, 'AFECTADO', $3, $4)`,
      [
        data.expediente_id,
        estadoAnterior,
        `Afectación ${formatAfectacionNumero(numero, data.fecha)} — ${data.importe_total.toFixed(2)}`,
        data.usuario_creacion_id,
      ]
    );

    return afectacionId;
  });
}

export interface UpdateAfectacionData {
  numero: number;
  anio: number;
  fecha: string;
  destinatario: string;
  importe_total: number;
  observaciones: string | null;
  numero_comprobante: string | null;
  usuario_id: number;
  detalle?: Array<{ cuenta_id: number; descripcion: string; importe: number }>;
}

export async function update(id: number, data: UpdateAfectacionData): Promise<void> {
  await withTransaction(async (client) => {
    const afectacionResult = await client.query<{
      id: number;
      expediente_id: number;
      anulada: boolean;
      deleted_at: Date | null;
      importe_total: string;
    }>(
      `SELECT id, expediente_id, anulada, deleted_at, importe_total::text
       FROM afectaciones WHERE id = $1 FOR UPDATE`,
      [id]
    );

    const afectacion = afectacionResult.rows[0];
    if (!afectacion || afectacion.deleted_at) {
      throw new Error('AFECTACION_NOT_FOUND');
    }
    if (afectacion.anulada) {
      throw new Error('ALREADY_ANNULLED');
    }

    if (data.detalle) {
      const oldDetalle = await client.query<{ cuenta_id: number; importe: string }>(
        'SELECT cuenta_id, importe::text FROM afectacion_detalle WHERE afectacion_id = $1',
        [id]
      );
      await applyCuentaSaldos(
        client,
        oldDetalle.rows.map((r) => ({ cuenta_id: r.cuenta_id, importe: parseFloat(r.importe) })),
        -1
      );
      await applyCuentaSaldos(client, data.detalle, 1);

      await client.query('DELETE FROM afectacion_detalle WHERE afectacion_id = $1', [id]);
      for (const line of data.detalle) {
        await client.query(
          `INSERT INTO afectacion_detalle (afectacion_id, cuenta_id, descripcion, importe)
           VALUES ($1, $2, $3, $4)`,
          [id, line.cuenta_id, line.descripcion, line.importe]
        );
      }
    }

    await bumpYearlyNumero(client, 'afectacion_numeracion', data.anio, data.numero);

    await client.query(
      `UPDATE afectaciones
       SET numero = $1, anio = $2, fecha = $3, destinatario = $4, importe_total = $5,
           observaciones = $6, numero_comprobante = $7, usuario_modificacion_id = $8, updated_at = NOW()
       WHERE id = $9`,
      [
        data.numero,
        data.anio,
        data.fecha,
        data.destinatario,
        data.importe_total,
        data.observaciones,
        data.numero_comprobante,
        data.usuario_id,
        id,
      ]
    );
  });
}

export async function anular(
  id: number,
  motivo: string,
  usuarioId: number
): Promise<void> {
  await withTransaction(async (client) => {
    const afectacionResult = await client.query<{
      id: number;
      expediente_id: number;
      numero: number;
      fecha: string;
      anulada: boolean;
      deleted_at: Date | null;
    }>(
      `SELECT id, expediente_id, numero, fecha::text, anulada, deleted_at
       FROM afectaciones WHERE id = $1 FOR UPDATE`,
      [id]
    );

    const afectacion = afectacionResult.rows[0];
    if (!afectacion || afectacion.deleted_at) {
      throw new Error('AFECTACION_NOT_FOUND');
    }
    if (afectacion.anulada) {
      throw new Error('ALREADY_ANNULLED');
    }

    const detalleResult = await client.query<{ cuenta_id: number; importe: string }>(
      'SELECT cuenta_id, importe::text FROM afectacion_detalle WHERE afectacion_id = $1',
      [id]
    );

    await applyCuentaSaldos(
      client,
      detalleResult.rows.map((r) => ({ cuenta_id: r.cuenta_id, importe: parseFloat(r.importe) })),
      -1
    );

    await client.query(
      `UPDATE afectaciones SET anulada = true, motivo_anulacion = $1, fecha_anulacion = NOW(),
              usuario_modificacion_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [motivo, usuarioId, id]
    );

    const activeCount = await client.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM afectaciones
       WHERE expediente_id = $1 AND deleted_at IS NULL AND anulada = false`,
      [afectacion.expediente_id]
    );

    if (parseInt(activeCount.rows[0]?.total ?? '0', 10) === 0) {
      await client.query(
        `UPDATE expedientes SET estado = 'INICIADO', usuario_modificacion_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [usuarioId, afectacion.expediente_id]
      );

      await client.query(
        `INSERT INTO expediente_historial (expediente_id, accion, estado_anterior, estado_nuevo, observacion, usuario_id)
         VALUES ($1, 'ANULACION_AFECTACION', 'AFECTADO', 'INICIADO', $2, $3)`,
        [
          afectacion.expediente_id,
          `Anulación afectación ${formatAfectacionNumero(afectacion.numero, afectacion.fecha)}`,
          usuarioId,
        ]
      );
    }
  });
}

export async function countTotal(): Promise<number> {
  const result = await query<{ total: string }>(
    'SELECT COUNT(*)::text AS total FROM afectaciones WHERE deleted_at IS NULL AND anulada = false'
  );
  return parseInt(result.rows[0]?.total ?? '0', 10);
}

export async function getResumenTotales() {
  const result = await query<{ total: string; importe: string }>(
    `SELECT COUNT(*)::text AS total, COALESCE(SUM(importe_total), 0)::text AS importe
     FROM afectaciones WHERE deleted_at IS NULL AND anulada = false`
  );
  return {
    total: parseInt(result.rows[0]?.total ?? '0', 10),
    importeTotal: parseFloat(result.rows[0]?.importe ?? '0'),
  };
}
