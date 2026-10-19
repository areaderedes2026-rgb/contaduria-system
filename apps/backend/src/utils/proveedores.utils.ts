/** Une nombres de proveedores para listas / destinatario (máx. práctico ~5). */
export function formatProveedoresNombres(
  items: Array<{ nombre: string } | string>,
  separator = ' · '
): string {
  return items
    .map((item) => (typeof item === 'string' ? item : item.nombre).trim())
    .filter(Boolean)
    .join(separator);
}

export const MAX_PROVEEDORES_POR_EXPEDIENTE = 5;
