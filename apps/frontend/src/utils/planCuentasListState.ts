/** Persiste los filtros del listado de plan de cuentas al salir al detalle. */
export const PLAN_CUENTAS_LIST_QUERY_KEY = 'plan-cuentas-list-query';

export function getPlanCuentasListPath(): string {
  try {
    const q = sessionStorage.getItem(PLAN_CUENTAS_LIST_QUERY_KEY);
    return q ? `/plan-cuentas?${q}` : '/plan-cuentas';
  } catch {
    return '/plan-cuentas';
  }
}

export function savePlanCuentasListQuery(query: string) {
  try {
    sessionStorage.setItem(PLAN_CUENTAS_LIST_QUERY_KEY, query);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPlanCuentasListQuery() {
  try {
    sessionStorage.removeItem(PLAN_CUENTAS_LIST_QUERY_KEY);
  } catch {
    /* ignore */
  }
}
