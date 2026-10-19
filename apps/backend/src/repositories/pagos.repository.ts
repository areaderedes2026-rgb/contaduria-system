import { query, withTransaction } from '../database/pool.js';
import type { Pago } from '../entities/index.js';
import { formatPagoNumero } from '../utils/pago.utils.js';
import { formatLibramientoNumero } from '../utils/libramiento.utils.js';
import { allocateYearlyNumero, bumpYearlyNumero } from '../utils/numeracion.js';

interface PagoRow {
  id: number;
  numero: number;
  anio: number;
  fecha_pago: string;
  libramiento_id: number;
  libramiento_nro: number | null;
  libramiento_fecha: string | null;
  expediente_id: number;
  expediente_numero: string | null;
  beneficiario: string;
  monto: string;
  medio_pago: Pago['medio_pago'];
  numero_comprobante: string | null;
  banco: string | null;
  observaciones: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
  fecha_anulacion: Date | null;
  usuario_registro_id: number | null;
  usuario_registro_nombre: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapPago(row: PagoRow): Pago {
  return {
    id: row.id,
    numero: row.numero,
    anio: row.anio,
    numero_completo: formatPagoNumero(row.numero, row.anio),
    fecha_pago: row.fecha_pago,
    libramiento_id: row.libramiento_id,
    libramiento_numero:
      row.libramiento_nro != null && row.libramiento_fecha
        ? formatLibramientoNumero(row.libramiento_nro, row.libramiento_fecha)
        : undefined,
    expediente_id: row.expediente_id,
    expediente_numero: row.expediente_numero ?? undefined,
    beneficiario: row.beneficiario,
    monto: parseFloat(row.monto),
    medio_pago: row.medio_pago,
    numero_comprobante: row.numero_comprobante,
    banco: row.banco,
    observaciones: row.observaciones,
    anulado: row.anulado,
    motivo_anulacion: row.motivo_anulacion,
    fecha_anulacion: row.fecha_anulacion,
    usuario_registro_id: row.usuario_registro_id,
    usuario_registro_nombre: row.usuario_registro_nombre,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const SELECT_BASE = `
  SELECT p.id, p.numero, p.anio, p.fecha_pago::text,
         p.libramiento_id,
         l.numero AS libramiento_nro,
         l.fecha::text AS libramiento_fecha,
         p.expediente_id,
         CONCAT(e.numero, '/', e.anio) AS expediente_numero,
         p.beneficiario, p.monto::text, p.medio_pago,
         p.numero_comprobante, p.banco, p.observaciones,
         p.anulado, p.motivo_anulacion, p.fecha_anulacion,
         p.usuario_registro_id,
         CONCAT(u.nombre, ' ', u.apellido) AS usuario_registro_nombre,
         p.created_at, p.updated_at
  FROM pagos p
  INNER JOIN libramientos l ON l.id = p.libramiento_id
  INNER JOIN expedientes e ON e.id = p.expediente_id
  LEFT JOIN usuarios u ON u.id = p.usuario_registro_id
`;

export interface ListPagosParams {
  page: number;
  limit: number;
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  medioPago?: string;
  expedienteId?: number;
  libramientoId?: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export async function findAll(params: ListPagosParams) {
  const {
    page,
    limit,
    search,
    anio,
    fechaDesde,
    fechaHasta,
    anulado,
    medioPago,
    expedienteId,
    libramientoId,
    sortBy,
    sortOrder,
  } = params;
  const offset = (page - 1) * limit;

  const allowedSort = ['numero', 'anio', 'fecha_pago', 'beneficiario', 'monto', 'medio_pago', 'created_at'];
  const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'desc' ? 'DESC' : 'ASC';

  let whereClause = 'WHERE p.deleted_at IS NULL';
  const values: unknown[] = [];

  if (search) {
    values.push(`%${search}%`);
    whereClause += ` AND (
      p.beneficiario ILIKE $${values.length}
      OR CAST(p.numero AS TEXT) ILIKE $${values.length}
      OR CONCAT(p.numero, '/', p.anio) ILIKE $${values.length}
      OR CONCAT(e.numero, '/', e.anio) ILIKE $${values.length}
      OR CAST(l.numero AS TEXT) ILIKE $${values.length}
      OR CONCAT(l.numero, '/', l.anio) ILIKE $${values.length}
      OR p.numero_comprobante ILIKE $${values.length}
    )`;
  }
  if (anio) {
    values.push(anio);
    whereClause += ` AND p.anio = $${values.length}`;
  }
  if (fechaDesde) {
    values.push(fechaDesde);
    whereClause += ` AND p.fecha_pago >= $${values.length}`;
  }
  if (fechaHasta) {
    values.push(fechaHasta);
    whereClause += ` AND p.fecha_pago <= $${values.length}`;
  }
  if (anulado !== undefined) {
    values.push(anulado);
    whereClause += ` AND p.anulado = $${values.length}`;
  }
  if (medioPago) {
    values.push(medioPago);
    whereClause += ` AND p.medio_pago = $${values.length}`;
  }
  if (expedienteId) {
    values.push(expedienteId);
    whereClause += ` AND p.expediente_id = $${values.length}`;
  }
  if (libramientoId) {
    values.push(libramientoId);
    whereClause += ` AND p.libramiento_id = $${values.length}`;
  }

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM pagos p
     INNER JOIN libramientos l ON l.id = p.libramiento_id
     INNER JOIN expedientes e ON e.id = p.expediente_id
     ${whereClause}`,
    values
  );

  values.push(limit, offset);
  const dataResult = await query<PagoRow>(
    `${SELECT_BASE} ${whereClause}
     ORDER BY p.${orderColumn} ${order}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return {
    data: dataResult.rows.map(mapPago),
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    page,
    limit,
  };
}

export async function findAllForExport(filters: Omit<ListPagosParams, 'page' | 'limit' | 'sortBy' | 'sortOrder'>) {
  const result = await findAll({ ...filters, page: 1, limit: 100000, sortBy: 'numero', sortOrder: 'asc' });
  return result.data;
}

export async function findById(id: number): Promise<Pago | null> {
  const result = await query<PagoRow>(
    `${SELECT_BASE} WHERE p.id = $1 AND p.deleted_at IS NULL`,
    [id]
  );
  if (!result.rows[0]) return null;
  return mapPago(result.rows[0]);
}

export async function findByLibramientoId(libramientoId: number): Promise<Pago | null> {
  const result = await query<PagoRow>(
    `${SELECT_BASE} WHERE p.libramiento_id = $1 AND p.deleted_at IS NULL AND p.anulado = false`,
    [libramientoId]
  );
  if (!result.rows[0]) return null;
  return mapPago(result.rows[0]);
}

export async function getNextNumero(anio: number): Promise<number> {
  const result = await query<{ ultimo_numero: number }>(
    'SELECT ultimo_numero FROM pago_numeracion WHERE anio = $1',
    [anio]
  );
  return (result.rows[0]?.ultimo_numero ?? 0) + 1;
}

export interface LibramientoPendiente {
  id: number;
  numero_completo: string;
  fecha: string;
  expediente_id: number;
  expediente_numero: string;
  beneficiario: string;
  neto: number;
  monto_pagado: number;
  saldo_pendiente: number;
  importe: number;
  retenciones: number;
  afectacion_id: number;
  afectacion_numero: string;
  numero_decreto: string | null;
  observaciones: string | null;
}

export async function findLibramientosPendientes(): Promise<LibramientoPendiente[]> {
  const result = await query<{
    id: number;
    numero: number;
    fecha: string;
    expediente_id: number;
    expediente_numero: string;
    beneficiario: string;
    neto: string;
    monto_pagado: string;
    importe: string;
    retenciones: string;
    afectacion_id: number;
    afectacion_numero: number;
    afectacion_fecha: string;
    numero_decreto: string | null;
    observaciones: string | null;
  }>(
    `SELECT l.id, l.numero, l.fecha::text, l.expediente_id,
            CONCAT(e.numero, '/', e.anio) AS expediente_numero,
            l.beneficiario, l.neto::text, COALESCE(l.monto_pagado, 0)::text AS monto_pagado,
            l.importe::text, l.retenciones::text,
            l.afectacion_id, a.numero AS afectacion_numero, a.fecha::text AS afectacion_fecha,
            l.numero_decreto, l.observaciones
     FROM libramientos l
     INNER JOIN expedientes e ON e.id = l.expediente_id
     INNER JOIN afectaciones a ON a.id = l.afectacion_id
     WHERE l.deleted_at IS NULL AND l.anulado = false AND l.pagado = false
       AND e.deleted_at IS NULL AND e.anulado = false AND e.estado = 'LIBRADO'
       AND COALESCE(e.circuito, 'NORMAL') = 'NORMAL'
     ORDER BY l.fecha DESC, l.numero DESC`
  );

  return result.rows.map((r) => {
    const neto = parseFloat(r.neto);
    const monto_pagado = parseFloat(r.monto_pagado);
    return {
      id: r.id,
      numero_completo: formatLibramientoNumero(r.numero, r.fecha),
      fecha: r.fecha,
      expediente_id: r.expediente_id,
      expediente_numero: r.expediente_numero,
      beneficiario: r.beneficiario,
      neto,
      monto_pagado,
      saldo_pendiente: Math.round((neto - monto_pagado) * 100) / 100,
      importe: parseFloat(r.importe),
      retenciones: parseFloat(r.retenciones),
      afectacion_id: r.afectacion_id,
      afectacion_numero: formatLibramientoNumero(r.afectacion_numero, r.afectacion_fecha),
      numero_decreto: r.numero_decreto,
      observaciones: r.observaciones,
    };
  });
}

export async function existsNumeroAnio(numero: number, anio: number, excludeId?: number): Promise<boolean> {
  const values: unknown[] = [numero, anio];
  let sql = `SELECT 1 FROM pagos WHERE numero = $1 AND anio = $2 AND deleted_at IS NULL`;
  if (excludeId) {
    values.push(excludeId);
    sql += ` AND id <> $${values.length}`;
  }
  sql += ' LIMIT 1';
  const result = await query(sql, values);
  return result.rows.length > 0;
}

export interface CreatePagoData {
  /** Si se omite, se asigna el siguiente número anual de forma atómica en la TX. */
  numero?: number;
  anio: number;
  fecha_pago: string;
  libramiento_id: number;
  expediente_id: number;
  beneficiario: string;
  monto: number;
  medio_pago: Pago['medio_pago'];
  numero_comprobante?: string;
  banco?: string;
  observaciones?: string;
  usuario_registro_id: number;
}

export async function create(data: CreatePagoData): Promise<number> {
  return withTransaction(async (client) => {
    const libResult = await client.query<{
      id: number;
      expediente_id: number;
      numero: number;
      fecha: string;
      beneficiario: string;
      neto: string;
      monto_pagado: string;
      anulado: boolean;
      pagado: boolean;
      deleted_at: Date | null;
    }>(
      `SELECT l.id, l.expediente_id, l.numero, l.fecha::text, l.beneficiario, l.neto::text,
              COALESCE(l.monto_pagado, 0)::text AS monto_pagado,
              l.anulado, l.pagado, l.deleted_at
       FROM libramientos l
       WHERE l.id = $1 FOR UPDATE`,
      [data.libramiento_id]
    );

    const libramiento = libResult.rows[0];
    if (!libramiento || libramiento.deleted_at) throw new Error('LIBRAMIENTO_NOT_FOUND');
    if (libramiento.anulado) throw new Error('LIBRAMIENTO_ANNULLED');
    if (libramiento.pagado) throw new Error('ALREADY_PAID');

    const expResult = await client.query<{ estado: string; anulado: boolean }>(
      `SELECT estado, anulado FROM expedientes WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [libramiento.expediente_id]
    );
    const expediente = expResult.rows[0];
    if (!expediente || expediente.anulado) throw new Error('EXPEDIENTE_NOT_FOUND');
    if (expediente.estado !== 'LIBRADO') throw new Error('INVALID_EXPEDIENTE_STATE');

    const neto = parseFloat(libramiento.neto);
    const montoPagadoActual = parseFloat(libramiento.monto_pagado);
    const saldo = Math.round((neto - montoPagadoActual) * 100) / 100;
    const monto = Math.round(data.monto * 100) / 100;

    if (!(monto > 0)) throw new Error('MONTO_INVALID');
    if (monto - saldo > 0.01) throw new Error('MONTO_EXCEEDS_SALDO');

    let numero: number;
    if (data.numero != null) {
      const dup = await client.query(
        `SELECT 1 FROM pagos
         WHERE numero = $1 AND anio = $2 AND deleted_at IS NULL LIMIT 1`,
        [data.numero, data.anio]
      );
      if (dup.rowCount && dup.rowCount > 0) {
        throw new Error('DUPLICATE_NUMERO');
      }
      await bumpYearlyNumero(client, 'pago_numeracion', data.anio, data.numero);
      numero = data.numero;
    } else {
      numero = await allocateYearlyNumero(client, 'pago_numeracion', data.anio);
    }

    const pagoResult = await client.query<{ id: number }>(
      `INSERT INTO pagos (numero, anio, fecha_pago, libramiento_id, expediente_id, beneficiario,
                          monto, medio_pago, numero_comprobante, banco, observaciones,
                          usuario_registro_id, usuario_modificacion_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING id`,
      [
        numero, data.anio, data.fecha_pago, data.libramiento_id, data.expediente_id,
        data.beneficiario, monto, data.medio_pago,
        data.numero_comprobante ?? null, data.banco ?? null, data.observaciones ?? null,
        data.usuario_registro_id,
      ]
    );

    const pagoId = pagoResult.rows[0].id;
    const nuevoMontoPagado = Math.round((montoPagadoActual + monto) * 100) / 100;
    const fullyPaid = nuevoMontoPagado >= neto - 0.01;
    const libLabel = formatLibramientoNumero(libramiento.numero, libramiento.fecha);
    const pagoLabel = formatPagoNumero(numero, data.anio);

    await client.query(
      `UPDATE libramientos SET
         monto_pagado = $1,
         pagado = $2,
         fecha_pago = CASE WHEN $2 THEN $3::date ELSE NULL END,
         usuario_modificacion_id = $4,
         updated_at = NOW()
       WHERE id = $5`,
      [nuevoMontoPagado, fullyPaid, data.fecha_pago, data.usuario_registro_id, data.libramiento_id]
    );

    if (fullyPaid) {
      await client.query(
        `UPDATE expedientes SET estado = 'PAGADO', usuario_modificacion_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [data.usuario_registro_id, data.expediente_id]
      );

      await client.query(
        `INSERT INTO expediente_historial (expediente_id, accion, estado_anterior, estado_nuevo, observacion, usuario_id)
         VALUES ($1, 'PAGO', 'LIBRADO', 'PAGADO', $2, $3)`,
        [
          data.expediente_id,
          `Pago ${pagoLabel} — Libramiento ${libLabel} — ${monto.toFixed(2)} (total)`,
          data.usuario_registro_id,
        ]
      );
    } else {
      await client.query(
        `INSERT INTO expediente_historial (expediente_id, accion, estado_anterior, estado_nuevo, observacion, usuario_id)
         VALUES ($1, 'PAGO_PARCIAL', 'LIBRADO', 'LIBRADO', $2, $3)`,
        [
          data.expediente_id,
          `Pago parcial ${pagoLabel} — Libramiento ${libLabel} — ${monto.toFixed(2)} (acumulado ${nuevoMontoPagado.toFixed(2)} / neto ${neto.toFixed(2)})`,
          data.usuario_registro_id,
        ]
      );
    }

    return pagoId;
  });
}

export async function anular(id: number, motivo: string, usuarioId: number): Promise<void> {
  await withTransaction(async (client) => {
    const pagoResult = await client.query<{
      id: number;
      libramiento_id: number;
      expediente_id: number;
      numero: number;
      anio: number;
      monto: string;
      anulado: boolean;
      deleted_at: Date | null;
    }>(
      `SELECT id, libramiento_id, expediente_id, numero, anio, monto::text, anulado, deleted_at
       FROM pagos WHERE id = $1 FOR UPDATE`,
      [id]
    );

    const pago = pagoResult.rows[0];
    if (!pago || pago.deleted_at) throw new Error('PAGO_NOT_FOUND');
    if (pago.anulado) throw new Error('ALREADY_ANNULLED');

    const expResult = await client.query<{ estado: string }>(
      `SELECT estado FROM expedientes WHERE id = $1 FOR UPDATE`,
      [pago.expediente_id]
    );
    if (expResult.rows[0]?.estado === 'ARCHIVADO') throw new Error('EXPEDIENTE_ARCHIVED');

    const libResult = await client.query<{
      id: number;
      neto: string;
      pagado: boolean;
    }>(
      `SELECT id, neto::text, pagado FROM libramientos WHERE id = $1 FOR UPDATE`,
      [pago.libramiento_id]
    );
    const libramiento = libResult.rows[0];
    if (!libramiento) throw new Error('LIBRAMIENTO_NOT_FOUND');

    await client.query(
      `UPDATE pagos SET anulado = true, motivo_anulacion = $1, fecha_anulacion = NOW(),
              usuario_modificacion_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [motivo, usuarioId, id]
    );

    const sumResult = await client.query<{ monto_pagado: string; ultima_fecha: string | null }>(
      `SELECT COALESCE(SUM(monto), 0)::text AS monto_pagado,
              MAX(fecha_pago)::text AS ultima_fecha
       FROM pagos
       WHERE libramiento_id = $1 AND deleted_at IS NULL AND anulado = false`,
      [pago.libramiento_id]
    );

    const nuevoMontoPagado = parseFloat(sumResult.rows[0]?.monto_pagado ?? '0');
    const neto = parseFloat(libramiento.neto);
    const fullyPaid = nuevoMontoPagado >= neto - 0.01;
    const estabaPagado = libramiento.pagado;
    const ultimaFecha = sumResult.rows[0]?.ultima_fecha ?? null;

    await client.query(
      `UPDATE libramientos SET
         monto_pagado = $1,
         pagado = $2,
         fecha_pago = CASE WHEN $2 THEN $3::date ELSE NULL END,
         usuario_modificacion_id = $4,
         updated_at = NOW()
       WHERE id = $5`,
      [nuevoMontoPagado, fullyPaid, ultimaFecha, usuarioId, pago.libramiento_id]
    );

    if (estabaPagado && !fullyPaid) {
      const otrosPagados = await client.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM libramientos
         WHERE expediente_id = $1 AND deleted_at IS NULL AND anulado = false AND pagado = true`,
        [pago.expediente_id]
      );

      if (parseInt(otrosPagados.rows[0]?.total ?? '0', 10) === 0) {
        await client.query(
          `UPDATE expedientes SET estado = 'LIBRADO', usuario_modificacion_id = $1, updated_at = NOW()
           WHERE id = $2 AND estado = 'PAGADO'`,
          [usuarioId, pago.expediente_id]
        );

        await client.query(
          `INSERT INTO expediente_historial (expediente_id, accion, estado_anterior, estado_nuevo, observacion, usuario_id)
           VALUES ($1, 'ANULACION_PAGO', 'PAGADO', 'LIBRADO', $2, $3)`,
          [pago.expediente_id, `Anulación pago ${formatPagoNumero(pago.numero, pago.anio)}`, usuarioId]
        );
      }
    } else if (!estabaPagado) {
      await client.query(
        `INSERT INTO expediente_historial (expediente_id, accion, estado_anterior, estado_nuevo, observacion, usuario_id)
         VALUES ($1, 'ANULACION_PAGO', 'LIBRADO', 'LIBRADO', $2, $3)`,
        [
          pago.expediente_id,
          `Anulación pago parcial ${formatPagoNumero(pago.numero, pago.anio)} — monto ${parseFloat(pago.monto).toFixed(2)}`,
          usuarioId,
        ]
      );
    }
  });
}

export async function getResumenTotales() {
  const [activos, pendientes] = await Promise.all([
    query<{ total: string; monto: string }>(
      `SELECT COUNT(*)::text AS total, COALESCE(SUM(monto), 0)::text AS monto
       FROM pagos WHERE deleted_at IS NULL AND anulado = false`
    ),
    query<{ total: string; monto: string }>(
      `SELECT COUNT(*)::text AS total,
              COALESCE(SUM(l.neto - COALESCE(l.monto_pagado, 0)), 0)::text AS monto
       FROM libramientos l
       INNER JOIN expedientes e ON e.id = l.expediente_id
       WHERE l.deleted_at IS NULL AND l.anulado = false AND l.pagado = false
         AND e.deleted_at IS NULL AND e.anulado = false AND e.estado = 'LIBRADO'`
    ),
  ]);

  return {
    totalPagados: parseInt(activos.rows[0]?.total ?? '0', 10),
    montoPagado: parseFloat(activos.rows[0]?.monto ?? '0'),
    pendientes: parseInt(pendientes.rows[0]?.total ?? '0', 10),
    montoPendiente: parseFloat(pendientes.rows[0]?.monto ?? '0'),
  };
}
