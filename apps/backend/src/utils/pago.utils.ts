export type MedioPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'OTRO';

export const MEDIOS_PAGO: MedioPago[] = ['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'OTRO'];

export const MEDIO_PAGO_LABELS: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia bancaria',
  CHEQUE: 'Cheque',
  OTRO: 'Otro',
};

export function formatPagoNumero(numero: number, anio: number): string {
  return `${numero}/${anio}`;
}

export function getAnioFromFecha(fecha: string): number {
  const [year] = fecha.split('-');
  return parseInt(year, 10);
}

export function isMedioPago(value: string): value is MedioPago {
  return MEDIOS_PAGO.includes(value as MedioPago);
}
