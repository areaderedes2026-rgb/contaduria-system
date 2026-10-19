import { apiRequest } from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  AuditoriaRegistro,
  AuditoriaResumen,
  AuditoriaFiltros,
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
  proveedores: 'Proveedores',
  afectaciones: 'Afectaciones',
  libramientos: 'Libramientos',
  pagos: 'Pagos',
};

export const ACCION_COLORS: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-700',
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
  ANULAR: 'bg-orange-100 text-orange-700',
  ARCHIVAR: 'bg-slate-100 text-slate-700',
};

export function getEntidadPath(entidad: string, entidadId: number | null): string | null {
  if (!entidadId) return null;
  const paths: Record<string, string> = {
    usuarios: `/usuarios`,
    cuentas: `/plan-cuentas/${entidadId}`,
    expedientes: `/expedientes/${entidadId}`,
    proveedores: `/proveedores/${entidadId}`,
    afectaciones: `/afectaciones/${entidadId}`,
    libramientos: `/libramientos/${entidadId}`,
    pagos: `/pagos/${entidadId}`,
  };
  return paths[entidad] ?? null;
}

export interface ListAuditoriaParams {
  page?: number;
  limit?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  usuarioId?: number;
  accion?: string;
  entidad?: string;
  entidadId?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getAuditoria(params: ListAuditoriaParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.usuarioId) query.set('usuarioId', String(params.usuarioId));
  if (params.accion) query.set('accion', params.accion);
  if (params.entidad) query.set('entidad', params.entidad);
  if (params.entidadId) query.set('entidadId', String(params.entidadId));
  if (params.search) query.set('search', params.search);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await apiRequest<ApiResponse<PaginatedResponse<AuditoriaRegistro>>>(
    `/auditoria?${query.toString()}`
  );
  return res.data;
}

export async function getAuditoriaRegistro(id: number) {
  const res = await apiRequest<ApiResponse<AuditoriaRegistro>>(`/auditoria/${id}`);
  return res.data;
}

export async function getAuditoriaPorEntidad(entidad: string, entidadId: number) {
  const res = await apiRequest<ApiResponse<AuditoriaRegistro[]>>(
    `/auditoria/entidad/${entidad}/${entidadId}`
  );
  return res.data;
}

export async function getAuditoriaResumen() {
  const res = await apiRequest<ApiResponse<AuditoriaResumen>>('/auditoria/resumen');
  return res.data;
}

export async function getAuditoriaFiltros() {
  const res = await apiRequest<ApiResponse<AuditoriaFiltros>>('/auditoria/filtros');
  return res.data;
}

export async function exportAuditoriaCsv(params: ListAuditoriaParams = {}) {
  const query = new URLSearchParams();
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.usuarioId) query.set('usuarioId', String(params.usuarioId));
  if (params.accion) query.set('accion', params.accion);
  if (params.entidad) query.set('entidad', params.entidad);
  if (params.entidadId) query.set('entidadId', String(params.entidadId));
  if (params.search) query.set('search', params.search);

  const token = getToken();
  const response = await fetch(`${API_URL}/auditoria/export?${query.toString()}`, {
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
  link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
