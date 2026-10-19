import type { ExpedienteProveedorRef } from '@/types';

/** Une nombres de proveedores para listas / destinatario. */
export function formatProveedoresNombres(
  items: Array<ExpedienteProveedorRef | { nombre: string } | string>,
  separator = ' · '
): string {
  return items
    .map((item) => (typeof item === 'string' ? item : item.nombre).trim())
    .filter(Boolean)
    .join(separator);
}

export const MAX_PROVEEDORES_POR_EXPEDIENTE = 5;
