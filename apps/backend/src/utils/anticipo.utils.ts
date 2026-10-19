import { formatAfectacionNumero, getAnioFromFecha } from './afectacion.utils.js';

export function formatAnticipoNumero(numero: number, anioOrFecha: number | string): string {
  return formatAfectacionNumero(numero, anioOrFecha);
}

export { getAnioFromFecha };

export const ANTICIPO_NUMERO_SQL = `CONCAT(a.numero, '/', a.anio)`;
