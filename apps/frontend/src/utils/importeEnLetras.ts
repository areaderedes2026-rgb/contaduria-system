/**
 * Convierte un importe a texto en español (Argentina) para comprobantes.
 * Ej: 1501.25 → "MIL QUINIENTOS UNO CON 25/100"
 */

const UNIDADES = [
  '',
  'UNO',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISÉIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
  'VEINTE',
  'VEINTIUNO',
  'VEINTIDÓS',
  'VEINTITRÉS',
  'VEINTICUATRO',
  'VEINTICINCO',
  'VEINTISÉIS',
  'VEINTISIETE',
  'VEINTIOCHO',
  'VEINTINUEVE',
];

const DECENAS = [
  '',
  '',
  'VEINTE',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA',
];

const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
];

function centenas(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  if (n < 30) return UNIDADES[n];

  const c = Math.floor(n / 100);
  const resto = n % 100;
  const d = Math.floor(resto / 10);
  const u = resto % 10;

  const parts: string[] = [];
  if (c > 0) parts.push(CENTENAS[c]);

  if (resto === 0) {
    // ok
  } else if (resto < 30) {
    parts.push(UNIDADES[resto]);
  } else if (u === 0) {
    parts.push(DECENAS[d]);
  } else {
    parts.push(`${DECENAS[d]} Y ${UNIDADES[u]}`);
  }

  return parts.join(' ').trim();
}

function miles(n: number): string {
  if (n === 0) return '';
  if (n < 1000) return centenas(n);

  const m = Math.floor(n / 1000);
  const resto = n % 1000;
  let cabeza: string;
  if (m === 1) cabeza = 'MIL';
  else cabeza = `${centenas(m)} MIL`;

  if (resto === 0) return cabeza;
  return `${cabeza} ${centenas(resto)}`.trim();
}

function millones(n: number): string {
  if (n === 0) return 'CERO';
  if (n < 1_000_000) return miles(n);

  const mill = Math.floor(n / 1_000_000);
  const resto = n % 1_000_000;
  let cabeza: string;
  if (mill === 1) cabeza = 'UN MILLÓN';
  else cabeza = `${miles(mill)} MILLONES`;

  if (resto === 0) return cabeza;
  return `${cabeza} ${miles(resto)}`.trim();
}

/**
 * Importe en letras para documentos oficiales (pesos argentinos).
 */
export function importeEnLetras(valor: number): string {
  if (!Number.isFinite(valor) || valor < 0) return 'CERO CON 00/100';

  const rounded = Math.round(valor * 100) / 100;
  const enteros = Math.floor(rounded);
  const centavos = Math.round((rounded - enteros) * 100);
  const centavosStr = String(centavos).padStart(2, '0');

  const textoEnteros = millones(enteros);
  return `${textoEnteros} CON ${centavosStr}/100`;
}

export function importeEnLetrasPesos(valor: number): string {
  return `SON PESOS ${importeEnLetras(valor)}`;
}
