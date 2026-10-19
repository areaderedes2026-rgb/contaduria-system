import { apiRequest } from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  Cuenta,
  CuentaTreeNode,
  CuentaPadreOption,
  CuentasResumen,
  CuentaHistorial,
  CuentaAfectacionVinculo,
  CuentaMovimiento,
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('contaduria-auth');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

export interface ListCuentasParams {
  page?: number;
  limit?: number;
  search?: string;
  /** Coincidencia exacta de código */
  codigoExacto?: string;
  tipo?: string;
  estado?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getCuentas(params: ListCuentasParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.codigoExacto) query.set('codigoExacto', params.codigoExacto);
  else if (params.search) query.set('search', params.search);
  if (params.tipo) query.set('tipo', params.tipo);
  if (params.estado) query.set('estado', params.estado);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await apiRequest<ApiResponse<PaginatedResponse<Cuenta>>>(
    `/cuentas?${query.toString()}`
  );
  return res.data;
}

export async function getCuenta(id: number) {
  const res = await apiRequest<ApiResponse<Cuenta>>(`/cuentas/${id}`);
  return res.data;
}

export async function getCuentaHistorial(id: number) {
  const res = await apiRequest<ApiResponse<CuentaHistorial[]>>(`/cuentas/${id}/historial`);
  return res.data;
}

export async function getCuentaHijos(id: number) {
  const res = await apiRequest<ApiResponse<Cuenta[]>>(`/cuentas/${id}/hijos`);
  return res.data;
}

export async function getCuentaAfectaciones(id: number) {
  const res = await apiRequest<ApiResponse<CuentaAfectacionVinculo[]>>(
    `/cuentas/${id}/afectaciones`
  );
  return res.data;
}

export async function getCuentaMovimientos(id: number) {
  const res = await apiRequest<ApiResponse<CuentaMovimiento[]>>(`/cuentas/${id}/movimientos`);
  return res.data;
}

export async function getCuentasArbol(params?: { tipo?: string; estado?: string }) {
  const query = new URLSearchParams();
  if (params?.tipo) query.set('tipo', params.tipo);
  if (params?.estado) query.set('estado', params.estado);

  const res = await apiRequest<ApiResponse<CuentaTreeNode[]>>(
    `/cuentas/arbol?${query.toString()}`
  );
  return res.data;
}

export async function getCuentasPadres() {
  const res = await apiRequest<ApiResponse<CuentaPadreOption[]>>('/cuentas/padres');
  return res.data;
}

export async function getCuentasResumen() {
  const res = await apiRequest<ApiResponse<CuentasResumen>>('/cuentas/resumen');
  return res.data;
}

export async function createCuenta(data: {
  codigo: string;
  descripcion: string;
  tipo: string;
  cuenta_padre_id?: number | null;
  saldo_inicial: number;
}) {
  const res = await apiRequest<ApiResponse<Cuenta>>('/cuentas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateCuenta(
  id: number,
  data: Partial<{
    codigo: string;
    descripcion: string;
    tipo: string;
    cuenta_padre_id: number | null;
    saldo_inicial: number;
    estado: string;
  }>
) {
  const res = await apiRequest<ApiResponse<Cuenta>>(`/cuentas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function ajustarSaldoCuenta(
  id: number,
  data: { saldo_inicial: number; motivo: string }
) {
  const res = await apiRequest<ApiResponse<Cuenta>>(`/cuentas/${id}/ajuste-saldo`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteCuenta(id: number) {
  await apiRequest(`/cuentas/${id}`, { method: 'DELETE' });
}

export async function exportCuentasCsv(params: ListCuentasParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.tipo) query.set('tipo', params.tipo);
  if (params.estado) query.set('estado', params.estado);

  const token = getToken();
  const response = await fetch(`${API_URL}/cuentas/export?${query.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Error al exportar');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `plan-cuentas-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
