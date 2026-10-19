export interface NavigationReturn {
  /** Ruta a la que volver (puede incluir query). */
  to: string;
  /** Texto del enlace principal, ej. "Volver". */
  label: string;
}

export type DetailLocationState = {
  from?: NavigationReturn;
};

export function getNavigationReturn(state: unknown): NavigationReturn | null {
  if (!state || typeof state !== 'object') return null;
  const from = (state as DetailLocationState).from;
  if (!from || typeof from.to !== 'string' || !from.to) return null;
  return {
    to: from.to,
    label: from.label?.trim() || 'Volver',
  };
}

export function buildReturnState(to: string, label = 'Volver'): DetailLocationState {
  return { from: { to, label } };
}
