export const ACCIONES_AUDITORIA = [
  'LOGIN',
  'CREATE',
  'UPDATE',
  'DELETE',
  'ANULAR',
  'ARCHIVAR',
] as const;

export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];

export const ENTIDADES_AUDITORIA = [
  'usuarios',
  'cuentas',
  'expedientes',
  'afectaciones',
  'libramientos',
  'pagos',
] as const;

export type EntidadAuditoria = (typeof ENTIDADES_AUDITORIA)[number];

export const ACCION_LABELS: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  CREATE: 'Creación',
  UPDATE: 'Modificación',
  DELETE: 'Eliminación',
  ANULAR: 'Anulación',
  ARCHIVAR: 'Archivo',
};

export const ENTIDAD_LABELS: Record<string, string> = {
  usuarios: 'Usuarios',
  cuentas: 'Plan de cuentas',
  expedientes: 'Expedientes',
  afectaciones: 'Afectaciones',
  libramientos: 'Libramientos',
  pagos: 'Pagos',
};

export function getAccionLabel(accion: string): string {
  return ACCION_LABELS[accion] ?? accion;
}

export function getEntidadLabel(entidad: string): string {
  return ENTIDAD_LABELS[entidad] ?? entidad;
}

export function getAccionColor(accion: string): string {
  const colors: Record<string, string> = {
    LOGIN: 'blue',
    CREATE: 'green',
    UPDATE: 'amber',
    DELETE: 'red',
    ANULAR: 'orange',
    ARCHIVAR: 'slate',
  };
  return colors[accion] ?? 'slate';
}
