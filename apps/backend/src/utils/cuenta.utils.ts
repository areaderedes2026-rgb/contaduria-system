/** Tipos de cuenta presupuestaria municipal */
export const TIPOS_CUENTA = ['RECURSO', 'GASTO', 'PATRIMONIAL'] as const;
export type TipoCuenta = (typeof TIPOS_CUENTA)[number];

export const ESTADOS_CUENTA = ['ACTIVA', 'INACTIVA'] as const;
export type EstadoCuenta = (typeof ESTADOS_CUENTA)[number];

const CODIGO_REGEX = /^[0-9]+(\.[0-9]+)*$/;

export function getNivelFromCodigo(codigo: string): number {
  return codigo.split('.').length;
}

export function isValidCodigoFormat(codigo: string): boolean {
  return CODIGO_REGEX.test(codigo);
}

export function isValidCodigoHierarchy(codigo: string, padreCodigo: string | null): boolean {
  if (!padreCodigo) return true;
  return codigo.startsWith(`${padreCodigo}.`) && codigo !== padreCodigo;
}

export function calcularSaldoDisponible(saldoInicial: number, saldoAfectado: number): number {
  return Number((saldoInicial - saldoAfectado).toFixed(2));
}
