import { query } from '../database/pool.js';
import { formatExpedienteNumero } from '../utils/expediente.utils.js';
import { formatAfectacionNumero, AFECTACION_NUMERO_SQL } from '../utils/afectacion.utils.js';
import { formatLibramientoNumero, LIBRAMIENTO_NUMERO_SQL } from '../utils/libramiento.utils.js';
import { formatPagoNumero } from '../utils/pago.utils.js';

const EXPEDIENTE_NUMERO_SQL = `CONCAT(e.numero, '/', e.anio)`;
const PAGO_NUMERO_SQL = `CONCAT(p.numero, '/', p.anio)`;

export interface ExpedienteTrazabilidadRow {
  expediente: {
    id: number;
    numero: number;
    anio: number;
    numero_completo: string;
    proveedor_nombre: string;
    detalle: string;
    importe: number;
    fecha_ingreso: string;
    estado: string;
    anulado: boolean;
  };
  afectaciones: Array<{
    id: number;
    numero_completo: string;
    fecha: string;
    destinatario: string;
    importe_total: number;
    anulada: boolean;
    detalle: Array<{
      cuenta_codigo: string;
      cuenta_descripcion: string;
      descripcion: string;
      importe: number;
    }>;
  }>;
  libramientos: Array<{
    id: number;
    numero_completo: string;
    fecha: string;
    beneficiario: string;
    importe: number;
    retenciones: number;
    neto: number;
    pagado: boolean;
    anulado: boolean;
    detalle: Array<{
      cuenta_codigo: string;
      descripcion: string;
      importe: number;
    }>;
  }>;
  pagos: Array<{
    id: number;
    numero_completo: string;
    fecha_pago: string;
    beneficiario: string;
    monto: number;
    medio_pago: string;
    anulado: boolean;
  }>;
  historial: Array<{
    id: number;
    accion: string;
    estado_anterior: string | null;
    estado_nuevo: string | null;
    observacion: string | null;
    usuario_nombre: string | null;
    created_at: Date;
  }>;
}

export async function findExpedienteIdByNumero(numero: number, anio: number): Promise<number | null> {
  const result = await query<{ id: number }>(
    `SELECT id FROM expedientes
     WHERE numero = $1 AND anio = $2 AND deleted_at IS NULL`,
    [numero, anio]
  );
  return result.rows[0]?.id ?? null;
}

export async function getExpedienteTrazabilidad(expedienteId: number): Promise<ExpedienteTrazabilidadRow | null> {
  const expResult = await query<{
    id: number;
    numero: number;
    anio: number;
    proveedor_nombre: string;
    detalle: string;
    importe: string;
    fecha_ingreso: string;
    estado: string;
    anulado: boolean;
  }>(
    `SELECT e.id, e.numero, e.anio, p.nombre AS proveedor_nombre, e.detalle, e.importe::text,
            e.fecha_ingreso::text, e.estado, e.anulado
     FROM expedientes e
     INNER JOIN proveedores p ON p.id = e.proveedor_id
     WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [expedienteId]
  );

  const exp = expResult.rows[0];
  if (!exp) return null;

  const [afectaciones, libramientos, pagos, historial] = await Promise.all([
    query<{
      id: number;
      numero: number;
      fecha: string;
      destinatario: string;
      importe_total: string;
      numero_comprobante: string | null;
      anulada: boolean;
    }>(
      `SELECT id, numero, fecha::text, destinatario, importe_total::text, numero_comprobante, anulada
       FROM afectaciones WHERE expediente_id = $1 AND deleted_at IS NULL
       ORDER BY fecha, numero`,
      [expedienteId]
    ),
    query<{
      id: number;
      numero: number;
      fecha: string;
      beneficiario: string;
      importe: string;
      retenciones: string;
      neto: string;
      pagado: boolean;
      anulado: boolean;
    }>(
      `SELECT id, numero, fecha::text, beneficiario, importe::text, retenciones::text,
              neto::text, pagado, anulado
       FROM libramientos WHERE expediente_id = $1 AND deleted_at IS NULL
       ORDER BY fecha, numero`,
      [expedienteId]
    ),
    query<{
      id: number;
      numero: number;
      anio: number;
      fecha_pago: string;
      beneficiario: string;
      monto: string;
      medio_pago: string;
      anulado: boolean;
    }>(
      `SELECT p.id, p.numero, p.anio, p.fecha_pago::text, p.beneficiario, p.monto::text,
              p.medio_pago, p.anulado
       FROM pagos p
       INNER JOIN libramientos l ON l.id = p.libramiento_id
       WHERE l.expediente_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.anio, p.numero`,
      [expedienteId]
    ),
    query<{
      id: number;
      accion: string;
      estado_anterior: string | null;
      estado_nuevo: string | null;
      observacion: string | null;
      usuario_nombre: string | null;
      created_at: Date;
    }>(
      `SELECT h.id, h.accion, h.estado_anterior, h.estado_nuevo, h.observacion,
              CONCAT(u.nombre, ' ', u.apellido) AS usuario_nombre, h.created_at
       FROM expediente_historial h
       LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.expediente_id = $1
       ORDER BY h.created_at DESC`,
      [expedienteId]
    ),
  ]);

  const afectacionIds = afectaciones.rows.map((a) => a.id);
  const libramientoIds = libramientos.rows.map((l) => l.id);

  let afectacionDetalle: Array<{
    afectacion_id: number;
    cuenta_codigo: string;
    cuenta_descripcion: string;
    descripcion: string;
    importe: string;
  }> = [];

  if (afectacionIds.length > 0) {
    const detResult = await query<{
      afectacion_id: number;
      cuenta_codigo: string;
      cuenta_descripcion: string;
      descripcion: string;
      importe: string;
    }>(
      `SELECT ad.afectacion_id, c.codigo AS cuenta_codigo, c.descripcion AS cuenta_descripcion,
              ad.descripcion, ad.importe::text
       FROM afectacion_detalle ad
       INNER JOIN cuentas c ON c.id = ad.cuenta_id
       WHERE ad.afectacion_id = ANY($1)
       ORDER BY ad.id`,
      [afectacionIds]
    );
    afectacionDetalle = detResult.rows;
  }

  let libramientoDetalle: Array<{
    libramiento_id: number;
    cuenta_codigo: string;
    descripcion: string;
    importe: string;
  }> = [];

  if (libramientoIds.length > 0) {
    const detResult = await query<{
      libramiento_id: number;
      cuenta_codigo: string;
      descripcion: string;
      importe: string;
    }>(
      `SELECT ld.libramiento_id, c.codigo AS cuenta_codigo, ld.descripcion, ld.importe::text
       FROM libramiento_detalle ld
       INNER JOIN cuentas c ON c.id = ld.cuenta_id
       WHERE ld.libramiento_id = ANY($1)
       ORDER BY ld.id`,
      [libramientoIds]
    );
    libramientoDetalle = detResult.rows;
  }

  return {
    expediente: {
      id: exp.id,
      numero: exp.numero,
      anio: exp.anio,
      numero_completo: formatExpedienteNumero(exp.numero, exp.anio),
      proveedor_nombre: exp.proveedor_nombre,
      detalle: exp.detalle,
      importe: parseFloat(exp.importe),
      fecha_ingreso: exp.fecha_ingreso,
      estado: exp.estado,
      anulado: exp.anulado,
    },
    afectaciones: afectaciones.rows.map((a) => ({
      id: a.id,
      numero_completo: formatAfectacionNumero(a.numero, a.fecha),
      fecha: a.fecha,
      destinatario: a.destinatario,
      importe_total: parseFloat(a.importe_total),
      numero_comprobante: a.numero_comprobante,
      anulada: a.anulada,
      detalle: afectacionDetalle
        .filter((d) => d.afectacion_id === a.id)
        .map((d) => ({
          cuenta_codigo: d.cuenta_codigo,
          cuenta_descripcion: d.cuenta_descripcion,
          descripcion: d.descripcion,
          importe: parseFloat(d.importe),
        })),
    })),
    libramientos: libramientos.rows.map((l) => ({
      id: l.id,
      numero_completo: formatLibramientoNumero(l.numero, l.fecha),
      fecha: l.fecha,
      beneficiario: l.beneficiario,
      importe: parseFloat(l.importe),
      retenciones: parseFloat(l.retenciones),
      neto: parseFloat(l.neto),
      pagado: l.pagado,
      anulado: l.anulado,
      detalle: libramientoDetalle
        .filter((d) => d.libramiento_id === l.id)
        .map((d) => ({
          cuenta_codigo: d.cuenta_codigo,
          descripcion: d.descripcion,
          importe: parseFloat(d.importe),
        })),
    })),
    pagos: pagos.rows.map((p) => ({
      id: p.id,
      numero_completo: formatPagoNumero(p.numero, p.anio),
      fecha_pago: p.fecha_pago,
      beneficiario: p.beneficiario,
      monto: parseFloat(p.monto),
      medio_pago: p.medio_pago,
      anulado: p.anulado,
    })),
    historial: historial.rows,
  };
}

export interface MovimientoCuenta {
  tipo: 'AFECTACION' | 'LIBRAMIENTO';
  documento_id: number;
  fecha: string;
  expediente_id: number;
  expediente_numero: string;
  documento_numero: string;
  beneficiario: string;
  descripcion: string;
  importe: number;
  anulado: boolean;
}

export async function getMovimientosPorCuenta(
  cuentaId: number,
  fechaDesde?: string,
  fechaHasta?: string
): Promise<MovimientoCuenta[]> {
  const values: unknown[] = [cuentaId];
  let dateFilterA = '';
  let dateFilterL = '';

  if (fechaDesde) {
    values.push(fechaDesde);
    dateFilterA += ` AND a.fecha >= $${values.length}`;
    dateFilterL += ` AND l.fecha >= $${values.length}`;
  }
  if (fechaHasta) {
    values.push(fechaHasta);
    dateFilterA += ` AND a.fecha <= $${values.length}`;
    dateFilterL += ` AND l.fecha <= $${values.length}`;
  }

  const result = await query<{
    tipo: 'AFECTACION' | 'LIBRAMIENTO';
    documento_id: number;
    fecha: string;
    expediente_id: number;
    expediente_numero: string;
    documento_numero: string;
    beneficiario: string;
    descripcion: string;
    importe: string;
    anulado: boolean;
  }>(
    `SELECT 'AFECTACION' AS tipo, a.id AS documento_id, a.fecha::text AS fecha,
            e.id AS expediente_id, ${EXPEDIENTE_NUMERO_SQL} AS expediente_numero,
            ${AFECTACION_NUMERO_SQL} AS documento_numero,
            a.destinatario AS beneficiario, ad.descripcion,
            ad.importe::text AS importe, a.anulada AS anulado
     FROM afectacion_detalle ad
     INNER JOIN afectaciones a ON a.id = ad.afectacion_id AND a.deleted_at IS NULL
     INNER JOIN expedientes e ON e.id = a.expediente_id
     WHERE ad.cuenta_id = $1 ${dateFilterA}

     UNION ALL

     SELECT 'LIBRAMIENTO', l.id, l.fecha::text,
            e.id, ${EXPEDIENTE_NUMERO_SQL},
            ${LIBRAMIENTO_NUMERO_SQL},
            l.beneficiario, ld.descripcion,
            ld.importe::text, l.anulado
     FROM libramiento_detalle ld
     INNER JOIN libramientos l ON l.id = ld.libramiento_id AND l.deleted_at IS NULL
     INNER JOIN expedientes e ON e.id = l.expediente_id
     WHERE ld.cuenta_id = $1 ${dateFilterL}

     ORDER BY fecha DESC`,
    values
  );

  return result.rows.map((r) => ({
    ...r,
    importe: parseFloat(r.importe),
  }));
}

export interface BeneficiarioItem {
  tipo: string;
  id: number;
  numero_completo: string;
  fecha: string;
  beneficiario: string;
  monto: number;
  estado: string;
  expediente_numero: string;
  expediente_id: number;
}

export async function buscarPorBeneficiario(
  search: string,
  page: number,
  limit: number,
  tipo?: string
) {
  const offset = (page - 1) * limit;
  const term = `%${search}%`;

  const parts: string[] = [];

  if (!tipo || tipo === 'EXPEDIENTE') {
    parts.push(`
       SELECT 'EXPEDIENTE' AS tipo, e.id, ${EXPEDIENTE_NUMERO_SQL} AS numero_completo,
              e.fecha_ingreso::text AS fecha, p.nombre AS beneficiario, e.importe::text AS monto,
              e.estado, ${EXPEDIENTE_NUMERO_SQL} AS expediente_numero, e.id AS expediente_id
       FROM expedientes e
       INNER JOIN proveedores p ON p.id = e.proveedor_id
       WHERE e.deleted_at IS NULL AND COALESCE(e.circuito, 'NORMAL') = 'NORMAL' AND (
         p.nombre ILIKE $1
         OR EXISTS (
           SELECT 1
           FROM expediente_proveedores ep
           INNER JOIN proveedores px ON px.id = ep.proveedor_id
           WHERE ep.expediente_id = e.id AND px.nombre ILIKE $1
         )
         OR EXISTS (
           SELECT 1 FROM afectaciones ax
           WHERE ax.expediente_id = e.id AND ax.deleted_at IS NULL AND ax.destinatario ILIKE $1
         )
         OR EXISTS (
           SELECT 1 FROM libramientos lx
           WHERE lx.expediente_id = e.id AND lx.deleted_at IS NULL AND lx.beneficiario ILIKE $1
         )
       )`);
  }

  if (!tipo || tipo === 'AFECTACION') {
    parts.push(`
       SELECT 'AFECTACION', a.id, ${AFECTACION_NUMERO_SQL}, a.fecha::text,
              a.destinatario, a.importe_total::text,
              CASE WHEN a.anulada THEN 'ANULADA' ELSE 'ACTIVA' END,
              ${EXPEDIENTE_NUMERO_SQL}, e.id
       FROM afectaciones a
       INNER JOIN expedientes e ON e.id = a.expediente_id
       WHERE a.deleted_at IS NULL AND COALESCE(e.circuito, 'NORMAL') = 'NORMAL'
         AND a.destinatario ILIKE $1`);
  }

  if (!tipo || tipo === 'LIBRAMIENTO') {
    parts.push(`
       SELECT 'LIBRAMIENTO', l.id, ${LIBRAMIENTO_NUMERO_SQL}, l.fecha::text,
              l.beneficiario, l.neto::text,
              CASE WHEN l.anulado THEN 'ANULADO' WHEN l.pagado THEN 'PAGADO' ELSE 'ACTIVO' END,
              ${EXPEDIENTE_NUMERO_SQL}, e.id
       FROM libramientos l
       INNER JOIN expedientes e ON e.id = l.expediente_id
       WHERE l.deleted_at IS NULL AND COALESCE(e.circuito, 'NORMAL') = 'NORMAL'
         AND l.beneficiario ILIKE $1`);
  }

  if (!tipo || tipo === 'PAGO') {
    parts.push(`
       SELECT 'PAGO', p.id, ${PAGO_NUMERO_SQL}, p.fecha_pago::text,
              p.beneficiario, p.monto::text,
              CASE WHEN p.anulado THEN 'ANULADO' ELSE 'VIGENTE' END,
              ${EXPEDIENTE_NUMERO_SQL}, e.id
       FROM pagos p
       INNER JOIN libramientos l ON l.id = p.libramiento_id
       INNER JOIN expedientes e ON e.id = l.expediente_id
       WHERE p.deleted_at IS NULL AND COALESCE(e.circuito, 'NORMAL') = 'NORMAL'
         AND p.beneficiario ILIKE $1`);
  }

  if (parts.length === 0) {
    return { data: [], total: 0, page, limit };
  }

  const unionSql = parts.join('\n       UNION ALL\n');

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM (${unionSql}) sub`,
    [term]
  );

  const dataResult = await query<BeneficiarioItem & { monto: string }>(
    `SELECT * FROM (${unionSql}) resultados
     ORDER BY
       CASE tipo
         WHEN 'EXPEDIENTE' THEN 1
         WHEN 'AFECTACION' THEN 2
         WHEN 'LIBRAMIENTO' THEN 3
         WHEN 'PAGO' THEN 4
         ELSE 5
       END,
       fecha DESC,
       id DESC
     LIMIT $2 OFFSET $3`,
    [term, limit, offset]
  );

  return {
    data: dataResult.rows.map((r) => ({
      ...r,
      monto: parseFloat(r.monto as unknown as string),
    })),
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    page,
    limit,
  };
}

export interface MovimientoConsolidado {
  tipo: string;
  id: number;
  numero_completo: string;
  fecha: string;
  beneficiario: string;
  monto: number;
  estado: string;
  expediente_numero: string;
  expediente_id: number;
}

export interface ListMovimientosParams {
  page: number;
  limit: number;
  tipo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  anio?: number;
  search?: string;
}

export async function getMovimientosConsolidados(params: ListMovimientosParams) {
  const { page, limit, tipo, fechaDesde, fechaHasta, anio, search } = params;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (tipo) {
    values.push(tipo);
    conditions.push(`tipo = $${values.length}`);
  }
  if (fechaDesde) {
    values.push(fechaDesde);
    conditions.push(`fecha >= $${values.length}`);
  }
  if (fechaHasta) {
    values.push(fechaHasta);
    conditions.push(`fecha <= $${values.length}`);
  }
  if (anio) {
    values.push(anio);
    conditions.push(`EXTRACT(YEAR FROM fecha::date) = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(beneficiario ILIKE $${values.length} OR numero_completo ILIKE $${values.length} OR expediente_numero ILIKE $${values.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const baseQuery = `
    SELECT * FROM (
      SELECT 'EXPEDIENTE' AS tipo, e.id, ${EXPEDIENTE_NUMERO_SQL} AS numero_completo,
             e.fecha_ingreso::text AS fecha, p.nombre AS beneficiario, e.importe AS monto,
             e.estado, ${EXPEDIENTE_NUMERO_SQL} AS expediente_numero, e.id AS expediente_id
      FROM expedientes e
      INNER JOIN proveedores p ON p.id = e.proveedor_id
      WHERE e.deleted_at IS NULL AND e.anulado = false
        AND COALESCE(e.circuito, 'NORMAL') = 'NORMAL'

      UNION ALL

      SELECT 'AFECTACION', a.id, ${AFECTACION_NUMERO_SQL}, a.fecha::text,
             a.destinatario, a.importe_total,
             CASE WHEN a.anulada THEN 'ANULADA' ELSE 'ACTIVA' END,
             ${EXPEDIENTE_NUMERO_SQL}, e.id
      FROM afectaciones a
      INNER JOIN expedientes e ON e.id = a.expediente_id
      WHERE a.deleted_at IS NULL AND COALESCE(e.circuito, 'NORMAL') = 'NORMAL'

      UNION ALL

      SELECT 'LIBRAMIENTO', l.id, ${LIBRAMIENTO_NUMERO_SQL}, l.fecha::text,
             l.beneficiario, l.neto,
             CASE WHEN l.anulado THEN 'ANULADO' WHEN l.pagado THEN 'PAGADO' ELSE 'ACTIVO' END,
             ${EXPEDIENTE_NUMERO_SQL}, e.id
      FROM libramientos l
      INNER JOIN expedientes e ON e.id = l.expediente_id
      WHERE l.deleted_at IS NULL AND COALESCE(e.circuito, 'NORMAL') = 'NORMAL'

      UNION ALL

      SELECT 'PAGO', p.id, ${PAGO_NUMERO_SQL}, p.fecha_pago::text,
             p.beneficiario, p.monto,
             CASE WHEN p.anulado THEN 'ANULADO' ELSE 'VIGENTE' END,
             ${EXPEDIENTE_NUMERO_SQL}, e.id
      FROM pagos p
      INNER JOIN libramientos l ON l.id = p.libramiento_id
      INNER JOIN expedientes e ON e.id = l.expediente_id
      WHERE p.deleted_at IS NULL AND COALESCE(e.circuito, 'NORMAL') = 'NORMAL'
    ) movimientos
    ${whereClause}
  `;

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM (${baseQuery}) sub`,
    values
  );

  values.push(limit, offset);
  const dataResult = await query<MovimientoConsolidado & { monto: string }>(
    `${baseQuery} ORDER BY fecha DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return {
    data: dataResult.rows.map((r) => ({
      ...r,
      monto: parseFloat(r.monto as unknown as string),
    })),
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    page,
    limit,
  };
}

export interface EjecucionCuenta {
  id: number;
  codigo: string;
  descripcion: string;
  tipo: string;
  saldo_inicial: number;
  saldo_afectado: number;
  saldo_disponible: number;
  monto_pagado: number;
  porcentaje_ejecutado: number;
}

export async function getEjecucionPresupuestaria(anio?: number): Promise<EjecucionCuenta[]> {
  const values: unknown[] = [];
  let pagadoYearFilter = '';
  if (anio) {
    values.push(anio);
    pagadoYearFilter = ` AND EXTRACT(YEAR FROM l.fecha_pago) = $${values.length}`;
  }

  const result = await query<{
    id: number;
    codigo: string;
    descripcion: string;
    tipo: string;
    saldo_inicial: string;
    saldo_afectado: string;
    saldo_disponible: string;
    monto_pagado: string;
  }>(
    `SELECT c.id, c.codigo, c.descripcion, c.tipo,
            c.saldo_inicial::text, c.saldo_afectado::text, c.saldo_disponible::text,
            COALESCE(pag.monto, 0)::text AS monto_pagado
     FROM cuentas c
     LEFT JOIN (
       SELECT ld.cuenta_id, SUM(ld.importe) AS monto
       FROM libramiento_detalle ld
       INNER JOIN libramientos l ON l.id = ld.libramiento_id
         AND l.deleted_at IS NULL AND l.anulado = false AND l.pagado = true
         ${pagadoYearFilter}
       GROUP BY ld.cuenta_id
     ) pag ON pag.cuenta_id = c.id
     WHERE c.deleted_at IS NULL AND c.estado = 'ACTIVA'
     ORDER BY c.codigo`,
    values
  );

  return result.rows.map((r) => {
    const saldoInicial = parseFloat(r.saldo_inicial);
    const montoPagado = parseFloat(r.monto_pagado);
    const porcentaje = saldoInicial > 0 ? (montoPagado / saldoInicial) * 100 : 0;
    return {
      id: r.id,
      codigo: r.codigo,
      descripcion: r.descripcion,
      tipo: r.tipo,
      saldo_inicial: saldoInicial,
      saldo_afectado: parseFloat(r.saldo_afectado),
      saldo_disponible: parseFloat(r.saldo_disponible),
      monto_pagado: montoPagado,
      porcentaje_ejecutado: Math.round(porcentaje * 100) / 100,
    };
  });
}

export async function getResumenConsultas() {
  const result = await query<{
    expedientes_activos: string;
    en_proceso: string;
    pagados: string;
    archivados: string;
    monto_afectado: string;
    monto_pagado: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM expedientes WHERE deleted_at IS NULL AND anulado = false
        AND COALESCE(circuito, 'NORMAL') = 'NORMAL')::text AS expedientes_activos,
       (SELECT COUNT(*) FROM expedientes WHERE deleted_at IS NULL AND anulado = false
        AND COALESCE(circuito, 'NORMAL') = 'NORMAL'
        AND estado IN ('AFECTADO', 'LIBRADO'))::text AS en_proceso,
       (SELECT COUNT(*) FROM expedientes WHERE deleted_at IS NULL AND anulado = false
        AND COALESCE(circuito, 'NORMAL') = 'NORMAL'
        AND estado = 'PAGADO')::text AS pagados,
       (SELECT COUNT(*) FROM expedientes WHERE deleted_at IS NULL AND anulado = false
        AND COALESCE(circuito, 'NORMAL') = 'NORMAL'
        AND estado = 'ARCHIVADO')::text AS archivados,
       (SELECT COALESCE(SUM(importe_total), 0) FROM afectaciones
        WHERE deleted_at IS NULL AND anulada = false)::text AS monto_afectado,
       (SELECT COALESCE(SUM(monto), 0) FROM pagos
        WHERE deleted_at IS NULL AND anulado = false)::text AS monto_pagado`
  );

  const row = result.rows[0];
  return {
    expedientesActivos: parseInt(row?.expedientes_activos ?? '0', 10),
    enProceso: parseInt(row?.en_proceso ?? '0', 10),
    pagados: parseInt(row?.pagados ?? '0', 10),
    archivados: parseInt(row?.archivados ?? '0', 10),
    montoAfectado: parseFloat(row?.monto_afectado ?? '0'),
    montoPagado: parseFloat(row?.monto_pagado ?? '0'),
  };
}

export async function getMovimientosConsolidadosForExport(filters: Omit<ListMovimientosParams, 'page' | 'limit'>) {
  return getMovimientosConsolidados({ ...filters, page: 1, limit: 100000 });
}
