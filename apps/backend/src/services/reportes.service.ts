import { z } from 'zod';
import * as reportesRepo from '../repositories/reportes.repository.js';
import { AppError } from '../utils/errors.js';
import {
  REPORTE_TIPOS,
  isReporteTipo,
  formatReportePeriodo,
  type ReporteFiltros,
  type ReporteTipo,
} from '../utils/reporte.utils.js';
import { ESTADO_EXPEDIENTE_LABELS } from '../utils/expediente.utils.js';
import { MEDIO_PAGO_LABELS } from '../utils/pago.utils.js';

const filtrosSchema = z.object({
  fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
  estado: z.enum(['INICIADO', 'AFECTADO', 'LIBRADO', 'PAGADO', 'ARCHIVADO']).optional(),
  pagado: z.boolean().optional(),
  medioPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'OTRO']).optional(),
});

function parseFiltros(params: Record<string, unknown>): ReporteFiltros {
  const parsed = filtrosSchema.parse(params);
  return {
    fechaDesde: parsed.fechaDesde,
    fechaHasta: parsed.fechaHasta,
    anio: parsed.anio,
    estado: parsed.estado,
    pagado: parsed.pagado,
    medioPago: parsed.medioPago,
  };
}

export function getTiposReporte() {
  return REPORTE_TIPOS;
}

export async function generarReporte(tipo: string, rawFiltros: Record<string, unknown>) {
  if (!isReporteTipo(tipo)) {
    throw new AppError(400, 'Tipo de reporte inválido', 'INVALID_REPORTE_TIPO');
  }

  const filtros = parseFiltros(rawFiltros);
  const periodo = formatReportePeriodo(filtros);
  const generadoEn = new Date().toISOString();

  let datos: unknown;
  let totales: Record<string, number> = {};

  switch (tipo as ReporteTipo) {
    case 'resumen-ejecutivo': {
      datos = await reportesRepo.getResumenEjecutivo(filtros);
      const d = datos as Awaited<ReturnType<typeof reportesRepo.getResumenEjecutivo>>;
      totales = {
        expedientes: d.expedientes.total,
        afectaciones_monto: d.afectaciones.monto,
        libramientos_neto: d.libramientos.neto,
        pagos_monto: d.pagos.monto,
      };
      break;
    }
    case 'ejecucion-presupuestaria': {
      const rows = await reportesRepo.getReporteEjecucionPresupuestaria(filtros);
      datos = rows;
      totales = {
        presupuesto: rows.reduce((s, r) => s + r.saldo_inicial, 0),
        afectado: rows.reduce((s, r) => s + r.saldo_afectado, 0),
        disponible: rows.reduce((s, r) => s + r.saldo_disponible, 0),
        pagado: rows.reduce((s, r) => s + r.monto_pagado, 0),
      };
      break;
    }
    case 'expedientes': {
      const rows = await reportesRepo.getReporteExpedientes(filtros);
      datos = rows;
      totales = { registros: rows.length };
      break;
    }
    case 'afectaciones': {
      const rows = await reportesRepo.getReporteAfectaciones(filtros);
      datos = rows;
      totales = {
        registros: rows.length,
        monto: rows.filter((r) => !r.anulada).reduce((s, r) => s + r.importe_total, 0),
      };
      break;
    }
    case 'libramientos': {
      const rows = await reportesRepo.getReporteLibramientos(filtros);
      datos = rows;
      totales = {
        registros: rows.length,
        neto: rows.filter((r) => !r.anulado).reduce((s, r) => s + r.neto, 0),
      };
      break;
    }
    case 'pagos': {
      const rows = await reportesRepo.getReportePagos(filtros);
      datos = rows;
      totales = {
        registros: rows.length,
        monto: rows.filter((r) => !r.anulado).reduce((s, r) => s + r.monto, 0),
      };
      break;
    }
  }

  const meta = REPORTE_TIPOS.find((r) => r.id === tipo)!;

  return {
    tipo,
    titulo: meta.nombre,
    descripcion: meta.descripcion,
    periodo,
    filtros,
    generadoEn,
    datos,
    totales,
  };
}

export async function exportReporteCsv(tipo: string, rawFiltros: Record<string, unknown>): Promise<string> {
  const reporte = await generarReporte(tipo, rawFiltros);

  switch (tipo as ReporteTipo) {
    case 'resumen-ejecutivo': {
      const d = reporte.datos as Awaited<ReturnType<typeof reportesRepo.getResumenEjecutivo>>;
      const lines = [
        'Concepto;Cantidad;Monto',
        `Expedientes;${d.expedientes.total};`,
        ...Object.entries(d.expedientes.porEstado).map(([k, v]) => `  ${ESTADO_EXPEDIENTE_LABELS[k as keyof typeof ESTADO_EXPEDIENTE_LABELS] ?? k};${v};`),
        `Afectaciones;${d.afectaciones.total};${d.afectaciones.monto.toFixed(2)}`,
        `Libramientos;${d.libramientos.total};${d.libramientos.neto.toFixed(2)}`,
        `Pagos;${d.pagos.total};${d.pagos.monto.toFixed(2)}`,
      ];
      return lines.join('\n');
    }
    case 'ejecucion-presupuestaria': {
      const rows = reporte.datos as Awaited<ReturnType<typeof reportesRepo.getReporteEjecucionPresupuestaria>>;
      const headers = 'Código;Descripción;Tipo;Presupuesto;Afectado;Disponible;Pagado;% Ejecutado';
      const data = rows.map((r) =>
        [r.codigo, `"${r.descripcion.replace(/"/g, '""')}"`, r.tipo,
         r.saldo_inicial.toFixed(2), r.saldo_afectado.toFixed(2),
         r.saldo_disponible.toFixed(2), r.monto_pagado.toFixed(2),
         r.porcentaje_ejecutado.toFixed(2)].join(';')
      );
      return [headers, ...data].join('\n');
    }
    case 'expedientes': {
      const rows = reporte.datos as Awaited<ReturnType<typeof reportesRepo.getReporteExpedientes>>;
      const headers = 'Número;Proveedor;Detalle;Importe;Fecha ingreso;Estado;Anulado';
      const data = rows.map((r) =>
        [r.numero_completo,
         `"${r.proveedor_nombre.replace(/"/g, '""')}"`,
         `"${r.detalle.replace(/"/g, '""')}"`,
         r.importe.toFixed(2),
         r.fecha_ingreso,
         ESTADO_EXPEDIENTE_LABELS[r.estado as keyof typeof ESTADO_EXPEDIENTE_LABELS] ?? r.estado,
         r.anulado ? 'Sí' : 'No'].join(';')
      );
      return [headers, ...data].join('\n');
    }
    case 'afectaciones': {
      const rows = reporte.datos as Awaited<ReturnType<typeof reportesRepo.getReporteAfectaciones>>;
      const headers = 'Número;Fecha;Expediente;Destinatario;Importe;Anulada';
      const data = rows.map((r) =>
        [r.numero_completo, r.fecha, r.expediente_numero,
         `"${r.destinatario.replace(/"/g, '""')}"`, r.importe_total.toFixed(2),
         r.anulada ? 'Sí' : 'No'].join(';')
      );
      return [headers, ...data].join('\n');
    }
    case 'libramientos': {
      const rows = reporte.datos as Awaited<ReturnType<typeof reportesRepo.getReporteLibramientos>>;
      const headers = 'Número;Fecha;Expediente;Beneficiario;Importe;Retenciones;Neto;Pagado;Anulado';
      const data = rows.map((r) =>
        [r.numero_completo, r.fecha, r.expediente_numero,
         `"${r.beneficiario.replace(/"/g, '""')}"`,
         r.importe.toFixed(2), r.retenciones.toFixed(2), r.neto.toFixed(2),
         r.pagado ? 'Sí' : 'No', r.anulado ? 'Sí' : 'No'].join(';')
      );
      return [headers, ...data].join('\n');
    }
    case 'pagos': {
      const rows = reporte.datos as Awaited<ReturnType<typeof reportesRepo.getReportePagos>>;
      const headers = 'Número;Fecha;Expediente;Libramiento;Beneficiario;Monto;Medio;Anulado';
      const data = rows.map((r) =>
        [r.numero_completo, r.fecha_pago, r.expediente_numero, r.libramiento_numero,
         `"${r.beneficiario.replace(/"/g, '""')}"`, r.monto.toFixed(2),
         MEDIO_PAGO_LABELS[r.medio_pago as keyof typeof MEDIO_PAGO_LABELS] ?? r.medio_pago,
         r.anulado ? 'Sí' : 'No'].join(';')
      );
      return [headers, ...data].join('\n');
    }
    default:
      throw new AppError(400, 'Tipo de reporte no exportable', 'INVALID_REPORTE_TIPO');
  }
}
