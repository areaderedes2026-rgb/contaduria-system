/** Formato: {numero}/{año} — correlativo anual. */
export function formatAfectacionNumero(numero: number, anioOrFecha: number | string): string {
  return `${numero}/${anioDesde(anioOrFecha)}`;
}

export function getAnioFromFecha(fecha: string): number {
  const [year] = fecha.split('-');
  return parseInt(year, 10);
}

function anioDesde(anioOrFecha: number | string): number {
  if (typeof anioOrFecha === 'number') return anioOrFecha;
  return getAnioFromFecha(anioOrFecha);
}

export function calcularImporteTotal(detalles: Array<{ importe: number }>): number {
  const total = detalles.reduce((sum, d) => sum + d.importe, 0);
  return Number(total.toFixed(2));
}

/** Expresión SQL: número completo de afectación */
export const AFECTACION_NUMERO_SQL = `CONCAT(a.numero, '/', a.anio)`;
