import { getAnioFromFecha } from './afectacion.utils.js';

/** Formato: {numero}/{año} — correlativo anual. */
export function formatLibramientoNumero(numero: number, anioOrFecha: number | string): string {
  const anio = typeof anioOrFecha === 'number' ? anioOrFecha : getAnioFromFecha(anioOrFecha);
  return `${numero}/${anio}`;
}

export { getAnioFromFecha };

export function calcularNeto(importe: number, retenciones: number): number {
  return Number((importe - retenciones).toFixed(2));
}

export function validarNeto(importe: number, retenciones: number, neto: number): boolean {
  return Math.abs(calcularNeto(importe, retenciones) - neto) < 0.01;
}

/** Expresión SQL: número completo de libramiento */
export const LIBRAMIENTO_NUMERO_SQL = `CONCAT(l.numero, '/', l.anio)`;
