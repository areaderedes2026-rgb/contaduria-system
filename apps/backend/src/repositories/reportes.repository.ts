import { query } from '../database/pool.js';
import type { ReporteFiltros } from '../utils/reporte.utils.js';
import { AFECTACION_NUMERO_SQL } from '../utils/afectacion.utils.js';
import { LIBRAMIENTO_NUMERO_SQL } from '../utils/libramiento.utils.js';
import { getEjecucionPresupuestaria } from './consultas.repository.js';

const EXPEDIENTE_NUMERO_SQL = `CONCAT(e.numero, '/', e.anio)`;
const PAGO_NUMERO_SQL = `CONCAT(p.numero, '/', p.anio)`;

function buildDateFilter(
  column: string,
  filtros: ReporteFiltros,
  values: unknown[]
): string {
  let clause = '';
  if (filtros.fechaDesde) {
    values.push(filtros.fechaDesde);
    clause += ` AND ${column} >= $${values.length}`;
  }
  if (filtros.fechaHasta) {
    values.push(filtros.fechaHasta);
    clause += ` AND ${column} <= $${values.length}`;
  }
  if (filtros.anio && !filtros.fechaDesde && !filtros.fechaHasta) {
    values.push(filtros.anio);
    clause += ` AND EXTRACT(YEAR FROM ${column}) = $${values.length}`;
  }
  return clause;
}

export async function getResumenEjecutivo(filtros: ReporteFiltros) {
  const buildWhere = (tableAlias: string, dateCol: string) => {
    const values: unknown[] = [];
    let where = '';
    if (filtros.fechaDesde) {
      values.push(filtros.fechaDesde);
      where += ` AND ${tableAlias}.${dateCol} >= $${values.length}`;
    }
    if (filtros.fechaHasta) {
      values.push(filtros.fechaHasta);
      where += ` AND ${tableAlias}.${dateCol} <= $${values.length}`;
    }
    if (filtros.anio && !filtros.fechaDesde && !filtros.fechaHasta) {
      values.push(filtros.anio);
      where += ` AND EXTRACT(YEAR FROM ${tableAlias}.${dateCol}) = $${values.length}`;
    }
    return { where, values };
  };

  const expFilter = buildWhere('e', 'fecha_ingreso');
  const afFilter = buildWhere('a', 'fecha');
  const libFilter = buildWhere('l', 'fecha');
  const pagFilter = buildWhere('p', 'fecha_pago');

  const [expedientes, afectaciones, libramientos, pagos] = await Promise.all([
    query<{ estado: string; total: string }>(
      `SELECT estado, COUNT(*)::text AS total FROM expedientes e
       WHERE e.deleted_at IS NULL AND e.anulado = false ${expFilter.where}
       GROUP BY estado`,
      expFilter.values
    ),
    query<{ total: string; monto: string }>(
      `SELECT COUNT(*)::text AS total, COALESCE(SUM(importe_total), 0)::text AS monto
       FROM afectaciones a WHERE a.deleted_at IS NULL AND a.anulada = false ${afFilter.where}`,
      afFilter.values
    ),
    query<{ total: string; neto: string }>(
      `SELECT COUNT(*)::text AS total, COALESCE(SUM(neto), 0)::text AS neto
       FROM libramientos l WHERE l.deleted_at IS NULL AND l.anulado = false ${libFilter.where}`,
      libFilter.values
    ),
    query<{ total: string; monto: string }>(
      `SELECT COUNT(*)::text AS total, COALESCE(SUM(monto), 0)::text AS monto
       FROM pagos p WHERE p.deleted_at IS NULL AND p.anulado = false ${pagFilter.where}`,
      pagFilter.values
    ),
  ]);

  const porEstado: Record<string, number> = {
    INICIADO: 0, AFECTADO: 0, LIBRADO: 0, PAGADO: 0, ARCHIVADO: 0,
  };
  let expTotal = 0;
  for (const row of expedientes.rows) {
    porEstado[row.estado] = parseInt(row.total, 10);
    expTotal += parseInt(row.total, 10);
  }

  return {
    expedientes: { total: expTotal, porEstado },
    afectaciones: {
      total: parseInt(afectaciones.rows[0]?.total ?? '0', 10),
      monto: parseFloat(afectaciones.rows[0]?.monto ?? '0'),
    },
    libramientos: {
      total: parseInt(libramientos.rows[0]?.total ?? '0', 10),
      neto: parseFloat(libramientos.rows[0]?.neto ?? '0'),
    },
    pagos: {
      total: parseInt(pagos.rows[0]?.total ?? '0', 10),
      monto: parseFloat(pagos.rows[0]?.monto ?? '0'),
    },
  };
}

export interface ReporteExpedienteRow {
  id: number;
  numero_completo: string;
  proveedor_nombre: string;
  detalle: string;
  importe: number;
  fecha_ingreso: string;
  estado: string;
  anulado: boolean;
}

export async function getReporteExpedientes(filtros: ReporteFiltros) {
  const values: unknown[] = [];
  let where = 'WHERE e.deleted_at IS NULL';
  where += buildDateFilter('e.fecha_ingreso', filtros, values);

  if (filtros.estado) {
    values.push(filtros.estado);
    where += ` AND e.estado = $${values.length}`;
  }

  const result = await query<ReporteExpedienteRow & { importe: string }>(
    `SELECT e.id, ${EXPEDIENTE_NUMERO_SQL} AS numero_completo,
            p.nombre AS proveedor_nombre, e.detalle, e.importe::text AS importe,
            e.fecha_ingreso::text,
            e.estado, e.anulado
     FROM expedientes e
     INNER JOIN proveedores p ON p.id = e.proveedor_id
     ${where}
     ORDER BY e.anio, e.numero`,
    values
  );

  return result.rows.map((r) => ({
    ...r,
    importe: parseFloat(r.importe),
  }));
}

export interface ReporteAfectacionRow {
  id: number;
  numero_completo: string;
  fecha: string;
  expediente_id: number;
  expediente_numero: string;
  destinatario: string;
  importe_total: number;
  anulada: boolean;
}

export async function getReporteAfectaciones(filtros: ReporteFiltros) {
  const values: unknown[] = [];
  let where = 'WHERE a.deleted_at IS NULL';
  where += buildDateFilter('a.fecha', filtros, values);

  const result = await query<ReporteAfectacionRow & { importe_total: string }>(
    `SELECT a.id, ${AFECTACION_NUMERO_SQL} AS numero_completo, a.fecha::text,
            e.id AS expediente_id, ${EXPEDIENTE_NUMERO_SQL} AS expediente_numero,
            a.destinatario, a.importe_total::text, a.anulada
     FROM afectaciones a
     INNER JOIN expedientes e ON e.id = a.expediente_id
     ${where}
     ORDER BY a.fecha, a.numero`,
    values
  );

  return result.rows.map((r) => ({
    ...r,
    importe_total: parseFloat(r.importe_total),
  }));
}

export interface ReporteLibramientoRow {
  id: number;
  numero_completo: string;
  fecha: string;
  expediente_id: number;
  expediente_numero: string;
  beneficiario: string;
  importe: number;
  retenciones: number;
  neto: number;
  pagado: boolean;
  anulado: boolean;
}

export async function getReporteLibramientos(filtros: ReporteFiltros) {
  const values: unknown[] = [];
  let where = 'WHERE l.deleted_at IS NULL';
  where += buildDateFilter('l.fecha', filtros, values);

  if (filtros.pagado !== undefined) {
    values.push(filtros.pagado);
    where += ` AND l.pagado = $${values.length}`;
  }

  const result = await query<ReporteLibramientoRow & { importe: string; retenciones: string; neto: string }>(
    `SELECT l.id, ${LIBRAMIENTO_NUMERO_SQL} AS numero_completo, l.fecha::text,
            e.id AS expediente_id, ${EXPEDIENTE_NUMERO_SQL} AS expediente_numero,
            l.beneficiario, l.importe::text, l.retenciones::text, l.neto::text,
            l.pagado, l.anulado
     FROM libramientos l
     INNER JOIN expedientes e ON e.id = l.expediente_id
     ${where}
     ORDER BY l.fecha, l.numero`,
    values
  );

  return result.rows.map((r) => ({
    ...r,
    importe: parseFloat(r.importe),
    retenciones: parseFloat(r.retenciones),
    neto: parseFloat(r.neto),
  }));
}

export interface ReportePagoRow {
  id: number;
  numero_completo: string;
  fecha_pago: string;
  expediente_id: number;
  expediente_numero: string;
  libramiento_id: number;
  libramiento_numero: string;
  beneficiario: string;
  monto: number;
  medio_pago: string;
  anulado: boolean;
}

export async function getReportePagos(filtros: ReporteFiltros) {
  const values: unknown[] = [];
  let where = 'WHERE p.deleted_at IS NULL';
  where += buildDateFilter('p.fecha_pago', filtros, values);

  if (filtros.medioPago) {
    values.push(filtros.medioPago);
    where += ` AND p.medio_pago = $${values.length}`;
  }

  const result = await query<ReportePagoRow & { monto: string }>(
    `SELECT p.id, ${PAGO_NUMERO_SQL} AS numero_completo, p.fecha_pago::text,
            e.id AS expediente_id, ${EXPEDIENTE_NUMERO_SQL} AS expediente_numero,
            l.id AS libramiento_id, ${LIBRAMIENTO_NUMERO_SQL} AS libramiento_numero,
            p.beneficiario, p.monto::text, p.medio_pago, p.anulado
     FROM pagos p
     INNER JOIN libramientos l ON l.id = p.libramiento_id
     INNER JOIN expedientes e ON e.id = p.expediente_id
     ${where}
     ORDER BY p.anio, p.numero`,
    values
  );

  return result.rows.map((r) => ({
    ...r,
    monto: parseFloat(r.monto),
  }));
}

export async function getReporteEjecucionPresupuestaria(filtros: ReporteFiltros = {}) {
  return getEjecucionPresupuestaria(filtros.anio);
}
