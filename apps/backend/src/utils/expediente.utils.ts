/** Estados del ciclo de vida del expediente */
export const ESTADOS_EXPEDIENTE = [
  'INICIADO',
  'AFECTADO',
  'LIBRADO',
  'PAGADO',
  'ARCHIVADO',
] as const;

export type EstadoExpediente = (typeof ESTADOS_EXPEDIENTE)[number];

export const ESTADO_EXPEDIENTE_LABELS: Record<EstadoExpediente, string> = {
  INICIADO: 'Iniciado',
  AFECTADO: 'Afectado',
  LIBRADO: 'Librado',
  PAGADO: 'Pagado',
  ARCHIVADO: 'Archivado',
};

export function formatExpedienteNumero(numero: number, anio: number): string {
  return `${numero}/${anio}`;
}

export function getAnioFromFecha(fecha: string): number {
  const [year] = fecha.split('-');
  return parseInt(year, 10);
}

export function puedeEditar(estado: EstadoExpediente, anulado: boolean): boolean {
  return estado === 'INICIADO' && !anulado;
}

export function puedeEliminar(estado: EstadoExpediente, anulado: boolean): boolean {
  return estado === 'INICIADO' && !anulado;
}

export function puedeAnular(estado: EstadoExpediente, anulado: boolean): boolean {
  return estado === 'INICIADO' && !anulado;
}

export function puedeArchivar(estado: EstadoExpediente, anulado: boolean): boolean {
  if (anulado) return false;
  return estado === 'INICIADO' || estado === 'PAGADO';
}
