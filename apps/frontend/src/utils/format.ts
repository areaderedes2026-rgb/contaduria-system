export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Convierte un número a texto de importe argentino (1.234.567,89).
 */
export function toImporteInput(value: number): string {
  if (!Number.isFinite(value)) return '';
  const fixed = (Math.round(value * 100) / 100).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFormatted},${decPart}`;
}

/**
 * Formatea un importe mientras se escribe (formato argentino: 1.234.567,89).
 * Sin coma en la entrada → agrega ",00". Con coma → respeta hasta 2 decimales.
 */
export function formatImporteInput(value: string): string {
  const cleaned = value.replace(/[^\d,]/g, '');
  if (!cleaned) return '';

  const commaIndex = cleaned.indexOf(',');
  const hasComma = commaIndex !== -1;

  let intRaw = (hasComma ? cleaned.slice(0, commaIndex) : cleaned).replace(/\D/g, '');
  let decRaw = hasComma
    ? cleaned.slice(commaIndex + 1).replace(/\D/g, '').slice(0, 2)
    : '00';

  intRaw = intRaw.replace(/^0+(?=\d)/, '');
  if (intRaw === '') intRaw = '0';

  const intFormatted = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (!hasComma) {
    return `${intFormatted},00`;
  }

  return `${intFormatted},${decRaw}`;
}

/** Completa decimales a 2 dígitos (usar en blur). */
export function finalizeImporteInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const parsed = parseImporteAR(trimmed);
  if (Number.isNaN(parsed)) return trimmed;
  return toImporteInput(parsed);
}

/**
 * Posición del cursor tras reformatear, para seguir escribiendo en la parte correcta.
 */
export function getImporteCaretIndex(
  rawValue: string,
  rawCursor: number,
  formatted: string
): number {
  if (!formatted) return 0;

  const prefix = rawValue.slice(0, Math.max(0, rawCursor));
  const commaInPrefix = prefix.indexOf(',') !== -1;
  const formattedComma = formatted.indexOf(',');

  if (commaInPrefix) {
    const decTyped = (prefix.split(',')[1] ?? '').replace(/\D/g, '').length;
    if (formattedComma === -1) return formatted.length;
    return Math.min(formattedComma + 1 + Math.min(decTyped, 2), formatted.length);
  }

  const intDigitsBefore = prefix.replace(/\D/g, '').length;
  if (intDigitsBefore <= 0) {
    return formattedComma === -1 ? 0 : formattedComma;
  }

  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    const ch = formatted[i];
    if (ch === ',') break;
    if (/\d/.test(ch)) {
      seen += 1;
      if (seen === intDigitsBefore) return i + 1;
    }
  }

  return formattedComma === -1 ? formatted.length : formattedComma;
}

/** Convierte un importe en formato argentino a número. */
export function parseImporteAR(formatted: string): number {
  const trimmed = formatted.trim();
  if (!trimmed) return NaN;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized);
}

export const TIPO_CUENTA_LABELS: Record<string, string> = {
  RECURSO: 'Recurso',
  GASTO: 'Gasto',
  PATRIMONIAL: 'Patrimonial',
};

export const ESTADO_CUENTA_LABELS: Record<string, string> = {
  ACTIVA: 'Activa',
  INACTIVA: 'Inactiva',
};

export const ESTADO_EXPEDIENTE_LABELS: Record<string, string> = {
  INICIADO: 'Iniciado',
  AFECTADO: 'Afectado',
  LIBRADO: 'Librado',
  PAGADO: 'Pagado',
  ARCHIVADO: 'Archivado',
};

export function labelTramiteExpediente(circuito?: string): string {
  if (circuito === 'CARGO_A_RENDIR') return 'Anticipo';
  if (circuito === 'NORMAL') return 'Afectación';
  return 'Sin definir';
}

export function labelEstadoExpediente(
  estado: string,
  circuito?: string
): string {
  if (circuito === 'CARGO_A_RENDIR' && estado === 'AFECTADO') return 'Anticipado';
  return ESTADO_EXPEDIENTE_LABELS[estado] ?? estado;
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export function formatExpedienteNumero(numero: number, anio: number): string {
  return `${numero}/${anio}`;
}

function anioDesde(anioOrFecha: number | string): number {
  if (typeof anioOrFecha === 'number') return anioOrFecha;
  const year = parseInt(anioOrFecha.slice(0, 4), 10);
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

/** Formato afectación: {numero}/{año}, correlativo anual. */
export function formatAfectacionNumero(numero: number, anioOrFecha: number | string): string {
  return `${numero}/${anioDesde(anioOrFecha)}`;
}

/** Formato libramiento: {numero}/{año}, correlativo anual. */
export function formatLibramientoNumero(numero: number, anioOrFecha: number | string): string {
  return formatAfectacionNumero(numero, anioOrFecha);
}

/** Formato anticipo: {numero}/{año}, correlativo anual. */
export function formatAnticipoNumero(numero: number, anioOrFecha: number | string): string {
  return formatAfectacionNumero(numero, anioOrFecha);
}

/** Formato pago: {numero}/{anio} correlativo anual. */
export function formatPagoNumero(numero: number, anio: number): string {
  return `${numero}/${anio}`;
}
