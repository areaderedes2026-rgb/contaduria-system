import type { PoolClient } from 'pg';
import { query, withTransaction } from '../database/pool.js';
import type { Anticipo } from '../entities/index.js';
import { formatAnticipoNumero } from '../utils/anticipo.utils.js';
import { allocateYearlyNumero, bumpYearlyNumero } from '../utils/numeracion.js';

interface AnticipoRow {
  id: number;
  numero: number;
  anio: number;
  fecha: string;
  expediente_id: number;
  expediente_numero: string | null;
  cuenta_id: number;
  cuenta_codigo: string | null;
  cuenta_descripcion: string | null;
  destinatario: string;
  importe: string;
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

function mapAnticipo(row: AnticipoRow): Anticipo {
  return {
    id: row.id,
    numero: row.numero,
    anio: row.anio,
    numero_completo: formatAnticipoNumero(row.numero, row.fecha),
    fecha: row.fecha,
    expediente_id: row.expediente_id,
    expediente_numero: row.expediente_numero ?? undefined,
    cuenta_id: row.cuenta_id,
    cuenta_codigo: row.cuenta_codigo ?? undefined,
    cuenta_descripcion: row.cuenta_descripcion ?? undefined,
    destinatario: row.destinatario,
    importe: parseFloat(row.importe),
    observaciones: row.observaciones,
    numero_comprobante: row.numero_comprobante,
    anulada: row.anulada,
    motivo_anulacion: row.motivo_anulacion,
    fecha_anulacion: row.fecha_anulacion,
    usuario_creacion_id: row.usuario_creacion_id,
    usuario_creacion_nombre: row.usuario_creacion_nombre,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SELECT_BASE = `
  SELECT a.id, a.numero, a.anio, a.fecha::text, a.expediente_id,
         CONCAT(e.numero, '/', e.anio) AS expediente_numero,
         a.cuenta_id, c.codigo AS cuenta_codigo, c.descripcion AS cuenta_descripcion,
         a.destinatario, a.importe::text, a.observaciones, a.numero_comprobante,
         a.anulada, a.motivo_anulacion, a.fecha_anulacion,
         a.usuario_creacion_id,
         CONCAT(u.nombre, ' ', u.apellido) AS usuario_creacion_nombre,
         a.created_at, a.updated_at
  FROM anticipos a
  INNER JOIN expedientes e ON e.id = a.expediente_id
  INNER JOIN cuentas c ON c.id = a.cuenta_id
  LEFT JOIN usuarios u ON u.id = a.usuario_creacion_id
`;

export interface ListAnticiposParams {
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

export async function findAll(params: ListAnticiposParams) {
  const { page, limit, search, anio, fechaDesde, fechaHasta, anulada, expedienteId, sortBy, sortOrder } =
    params;
  const offset = (page - 1) * limit;
  const allowedSort = ['numero', 'anio', 'fecha', 'destinatario', 'importe', 'created_at'];
  const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

  let whereClause = `WHERE a.deleted_at IS NULL AND COALESCE(e.circuito, 'NORMAL') = 'CARGO_A_RENDIR'`;
  const values: unknown[] = [];

  if (search) {
    values.push(`%${search}%`);
    const term = `$${values.length}`;
    whereClause += ` AND (
      a.destinatario ILIKE ${term}
      OR COALESCE(a.observaciones, '') ILIKE ${term}
      OR COALESCE(a.numero_comprobante, '') ILIKE ${term}
      OR CAST(a.numero AS TEXT) ILIKE ${term}
      OR CONCAT(a.numero, '/', a.anio) ILIKE ${term}
      OR CONCAT(e.numero, '/', e.anio) ILIKE ${term}
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
    `SELECT COUNT(*)::text AS total FROM anticipos a
     INNER JOIN expedientes e ON e.id = a.expediente_id
     ${whereClause}`,
    values
  );

  values.push(limit, offset);
  const dataResult = await query<AnticipoRow>(
    `${SELECT_BASE} ${whereClause}
     ORDER BY a.${orderColumn} ${order}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return {
    data: dataResult.rows.map(mapAnticipo),
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    page,
    limit,
  };
}

export async function findAllForExport(
  filters: Omit<ListAnticiposParams, 'page' | 'limit' | 'sortBy' | 'sortOrder'>
) {
  const result = await findAll({ ...filters, page: 1, limit: 100000, sortBy: 'numero', sortOrder: 'asc' });
  return result.data;
}

export async function findById(id: number): Promise<Anticipo | null> {
  const result = await query<AnticipoRow>(
    `${SELECT_BASE} WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [id]
  );
  if (!result.rows[0]) return null;
  return mapAnticipo(result.rows[0]);
}

export async function getNextNumero(anio: number): Promise<number> {
  const result = await query<{ ultimo_numero: number }>(
    'SELECT ultimo_numero FROM anticipo_numeracion WHERE anio = $1',
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
  let sql = `SELECT 1 FROM anticipos WHERE numero = $1 AND anio = $2 AND deleted_at IS NULL`;
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND id <> $${values.length}`;
  }
  sql += ' LIMIT 1';
  const result = await query(sql, values);
  return result.rowCount > 0;
}

export async function hasActiveLibramiento(anticipoId: number): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM libramientos_anticipo
     WHERE anticipo_id = $1 AND deleted_at IS NULL AND anulado = false
     LIMIT 1`,
    [anticipoId]
  );
  return result.rowCount > 0;
}

export async function getImporteAnticipadoActivo(
  expedienteId: number,
  excludeId?: number
): Promise<number> {
  const values: unknown[] = [expedienteId];
  let sql = `SELECT COALESCE(SUM(importe), 0)::text AS total
             FROM anticipos
             WHERE expediente_id = $1 AND deleted_at IS NULL AND anulada = false`;
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND id != $2`;
  }
  const result = await query<{ total: string }>(sql, values);
  return parseFloat(result.rows[0]?.total ?? '0');
}

async function applyCuentaSaldo(
  client: PoolClient,
  cuentaId: number,
  importe: number,
  direction: 1 | -1
) {
  const total = Number(importe.toFixed(2));
  if (direction === 1) {
    const cuentaResult = await client.query<{
      saldo_inicial: string;
      saldo_afectado: string;
      estado: string;
      deleted_at: Date | null;
    }>(
      `SELECT saldo_inicial::text, saldo_afectado::text, estado, deleted_at
       FROM cuentas WHERE id = $1 FOR UPDATE`,
      [cuentaId]
    );
    const cuenta = cuentaResult.rows[0];
    if (!cuenta || cuenta.deleted_at) throw new Error(`CUENTA_NOT_FOUND:${cuentaId}`);
    if (cuenta.estado !== 'ACTIVA') throw new Error(`CUENTA_INACTIVE:${cuentaId}`);
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

export interface CreateAnticipoData {
  numero?: number;
  anio: number;
  fecha: string;
  expediente_id: number;
  cuenta_id: number;
  destinatario: string;
  importe: number;
  observaciones: string | null;
  numero_comprobante: string | null;
  usuario_creacion_id: number;
}

export async function create(data: CreateAnticipoData): Promise<number> {
  return withTransaction(async (client) => {
    const expResult = await client.query<{
      id: number;
      importe: string;
      estado: string;
      circuito: string;
      anulado: boolean;
    }>(
      `SELECT id, importe::text, estado, COALESCE(circuito, 'NORMAL') AS circuito, anulado
       FROM expedientes WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [data.expediente_id]
    );
    const expediente = expResult.rows[0];
    if (!expediente || expediente.anulado) throw new Error('EXPEDIENTE_NOT_FOUND');
    if (expediente.circuito !== 'CARGO_A_RENDIR') throw new Error('INVALID_CIRCUITO');
    if (expediente.estado !== 'INICIADO' && expediente.estado !== 'AFECTADO') {
      throw new Error('INVALID_EXPEDIENTE_STATE');
    }

    const anticipadoResult = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(importe), 0)::text AS total FROM anticipos
       WHERE expediente_id = $1 AND deleted_at IS NULL AND anulada = false`,
      [data.expediente_id]
    );
    const anticipado = parseFloat(anticipadoResult.rows[0]?.total ?? '0');
    const disponible = Number((parseFloat(expediente.importe) - anticipado).toFixed(2));
    if (data.importe > disponible + 0.001) throw new Error('IMPORTE_EXCEEDS_EXPEDIENTE');

    let numero: number;
    if (data.numero != null) {
      const dup = await client.query(
        `SELECT 1 FROM anticipos WHERE numero = $1 AND anio = $2 AND deleted_at IS NULL LIMIT 1`,
        [data.numero, data.anio]
      );
      if (dup.rowCount && dup.rowCount > 0) {
        throw Object.assign(new Error('DUPLICATE_NUMERO'), { code: '23505' });
      }
      await bumpYearlyNumero(client, 'anticipo_numeracion', data.anio, data.numero);
      numero = data.numero;
    } else {
      numero = await allocateYearlyNumero(client, 'anticipo_numeracion', data.anio);
    }

    await applyCuentaSaldo(client, data.cuenta_id, data.importe, 1);

    const result = await client.query<{ id: number }>(
      `INSERT INTO anticipos (
         numero, anio, fecha, expediente_id, cuenta_id, destinatario, importe,
         observaciones, numero_comprobante, usuario_creacion_id, usuario_modificacion_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING id`,
      [
        numero,
        data.anio,
        data.fecha,
        data.expediente_id,
        data.cuenta_id,
        data.destinatario,
        data.importe,
        data.observaciones,
        data.numero_comprobante,
        data.usuario_creacion_id,
      ]
    );

    await client.query(
      `UPDATE expedientes SET estado = 'AFECTADO', usuario_modificacion_id = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL`,
      [data.usuario_creacion_id, data.expediente_id]
    );

    const estadoAnterior = expediente.estado === 'AFECTADO' ? 'AFECTADO' : 'INICIADO';
    await client.query(
      `INSERT INTO expediente_historial (expediente_id, accion, estado_anterior, estado_nuevo, observacion, usuario_id)
       VALUES ($1, 'ANTICIPO', $2, 'AFECTADO', $3, $4)`,
      [
        data.expediente_id,
        estadoAnterior,
        `Anticipo ${formatAnticipoNumero(numero, data.fecha)} — ${data.importe.toFixed(2)}`,
        data.usuario_creacion_id,
      ]
    );

    return result.rows[0].id;
  });
}

export async function anular(id: number, motivo: string, usuarioId: number): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query<{
      id: number;
      expediente_id: number;
      numero: number;
      fecha: string;
      cuenta_id: number;
      importe: string;
      anulada: boolean;
      deleted_at: Date | null;
    }>(
      `SELECT id, expediente_id, numero, fecha::text, cuenta_id, importe::text, anulada, deleted_at
       FROM anticipos WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const anticipo = result.rows[0];
    if (!anticipo || anticipo.deleted_at) throw new Error('ANTICIPO_NOT_FOUND');
    if (anticipo.anulada) throw new Error('ALREADY_ANNULLED');

    const lib = await client.query(
      `SELECT 1 FROM libramientos_anticipo
       WHERE anticipo_id = $1 AND deleted_at IS NULL AND anulado = false LIMIT 1`,
      [id]
    );
    if (lib.rowCount && lib.rowCount > 0) throw new Error('HAS_LIBRAMIENTO');

    await applyCuentaSaldo(client, anticipo.cuenta_id, parseFloat(anticipo.importe), -1);

    await client.query(
      `UPDATE anticipos SET anulada = true, motivo_anulacion = $1, fecha_anulacion = NOW(),
              usuario_modificacion_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [motivo, usuarioId, id]
    );

    const active = await client.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM anticipos
       WHERE expediente_id = $1 AND deleted_at IS NULL AND anulada = false`,
      [anticipo.expediente_id]
    );
    if (parseInt(active.rows[0]?.total ?? '0', 10) === 0) {
      await client.query(
        `UPDATE expedientes SET estado = 'INICIADO', usuario_modificacion_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [usuarioId, anticipo.expediente_id]
      );
      await client.query(
        `INSERT INTO expediente_historial (expediente_id, accion, estado_anterior, estado_nuevo, observacion, usuario_id)
         VALUES ($1, 'ANULACION_ANTICIPO', 'AFECTADO', 'INICIADO', $2, $3)`,
        [
          anticipo.expediente_id,
          `Anulación anticipo ${formatAnticipoNumero(anticipo.numero, anticipo.fecha)}`,
          usuarioId,
        ]
      );
    }
  });
}

export async function getResumenTotales() {
  const result = await query<{ total: string; importe: string }>(
    `SELECT COUNT(*)::text AS total, COALESCE(SUM(a.importe), 0)::text AS importe
     FROM anticipos a
     INNER JOIN expedientes e ON e.id = a.expediente_id
     WHERE a.deleted_at IS NULL AND a.anulada = false
       AND COALESCE(e.circuito, 'NORMAL') = 'CARGO_A_RENDIR'`
  );
  return {
    total: parseInt(result.rows[0]?.total ?? '0', 10),
    importeTotal: parseFloat(result.rows[0]?.importe ?? '0'),
  };
}
