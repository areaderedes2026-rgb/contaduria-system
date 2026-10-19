export const REPORTE_TIPOS = [
  {
    id: 'resumen-ejecutivo',
    nombre: 'Resumen ejecutivo',
    descripcion: 'Panorama general de expedientes, montos y estados del período',
    filtros: ['fechaDesde', 'fechaHasta', 'anio'],
  },
  {
    id: 'ejecucion-presupuestaria',
    nombre: 'Ejecución presupuestaria',
    descripcion: 'Presupuesto, afectado, disponible y pagado por cuenta',
    filtros: ['anio'],
  },
  {
    id: 'expedientes',
    nombre: 'Expedientes',
    descripcion: 'Listado de expedientes por estado, proveedor y fecha de ingreso',
    filtros: ['fechaDesde', 'fechaHasta', 'anio', 'estado'],
  },
  {
    id: 'afectaciones',
    nombre: 'Afectaciones presupuestarias',
    descripcion: 'Afectaciones registradas en el período',
    filtros: ['fechaDesde', 'fechaHasta', 'anio'],
  },
  {
    id: 'libramientos',
    nombre: 'Libramientos',
    descripcion: 'Órdenes de pago emitidas en el período',
    filtros: ['fechaDesde', 'fechaHasta', 'anio', 'pagado'],
  },
  {
    id: 'pagos',
    nombre: 'Pagos efectuados',
    descripcion: 'Desembolsos realizados en el período',
    filtros: ['fechaDesde', 'fechaHasta', 'anio', 'medioPago'],
  },
] as const;

export type ReporteTipo = (typeof REPORTE_TIPOS)[number]['id'];

export function isReporteTipo(value: string): value is ReporteTipo {
  return REPORTE_TIPOS.some((r) => r.id === value);
}

export interface ReporteFiltros {
  fechaDesde?: string;
  fechaHasta?: string;
  anio?: number;
  estado?: string;
  pagado?: boolean;
  medioPago?: string;
}

export function formatReportePeriodo(filtros: ReporteFiltros): string {
  if (filtros.fechaDesde && filtros.fechaHasta) {
    return `Del ${filtros.fechaDesde} al ${filtros.fechaHasta}`;
  }
  if (filtros.anio) return `Año ${filtros.anio}`;
  return 'Período completo';
}
