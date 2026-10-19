import { apiRequest } from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  LibramientoAnticipo,
  LibramientosAnticipoResumen,
  AnticipoDisponibleLibramiento,
  ExpedienteDisponibleLibramientoAnticipo,
  SiguienteNumeroLibramiento,
  Anticipo,
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

export interface ListLibramientosAnticipoParams {
  page?: number;
  limit?: number;
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  expedienteId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getLibramientosAnticipo(params: ListLibramientosAnticipoParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anulado !== undefined) query.set('anulado', String(params.anulado));
  if (params.expedienteId) query.set('expedienteId', String(params.expedienteId));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await apiRequest<ApiResponse<PaginatedResponse<LibramientoAnticipo>>>(
    `/libramientos-anticipo?${query.toString()}`
  );
  return res.data;
}

export async function getLibramientoAnticipo(id: number) {
  const res = await apiRequest<ApiResponse<LibramientoAnticipo>>(`/libramientos-anticipo/${id}`);
  return res.data;
}

export async function getSiguienteNumeroLibramientoAnticipo(anio?: number) {
  const query = anio ? `?anio=${anio}` : '';
  const res = await apiRequest<ApiResponse<SiguienteNumeroLibramiento>>(
    `/libramientos-anticipo/siguiente-numero${query}`
  );
  return res.data;
}

export async function getLibramientosAnticipoResumen() {
  const res = await apiRequest<ApiResponse<LibramientosAnticipoResumen>>(
    '/libramientos-anticipo/resumen'
  );
  return res.data;
}

export async function getAnticiposDisponiblesLibramiento() {
  const res = await apiRequest<ApiResponse<AnticipoDisponibleLibramiento[]>>(
    '/libramientos-anticipo/anticipos-disponibles'
  );
  return res.data;
}

export async function getExpedientesDisponiblesLibramientoAnticipo() {
  const res = await apiRequest<ApiResponse<ExpedienteDisponibleLibramientoAnticipo[]>>(
    '/libramientos-anticipo/expedientes-disponibles'
  );
  return res.data;
}

export async function getAnticipoParaLibramiento(anticipoId: number) {
  const res = await apiRequest<ApiResponse<Anticipo>>(
    `/libramientos-anticipo/anticipo/${anticipoId}`
  );
  return res.data;
}

export async function createLibramientoAnticipo(data: {
  fecha: string;
  expediente_id: number;
  anticipo_id: number;
  beneficiario?: string;
  numero?: number;
  importe?: number;
  retenciones?: number;
  numero_decreto?: string | null;
  observaciones?: string | null;
}) {
  const res = await apiRequest<ApiResponse<LibramientoAnticipo>>('/libramientos-anticipo', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function anularLibramientoAnticipo(id: number, motivo: string) {
  const res = await apiRequest<ApiResponse<LibramientoAnticipo>>(
    `/libramientos-anticipo/${id}/anular`,
    {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    }
  );
  return res.data;
}

export async function exportLibramientosAnticipoCsv(
  params: ListLibramientosAnticipoParams = {}
) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anulado !== undefined) query.set('anulado', String(params.anulado));
  if (params.expedienteId) query.set('expedienteId', String(params.expedienteId));

  const token = getToken();
  const response = await fetch(`${API_URL}/libramientos-anticipo/export?${query.toString()}`, {
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
  link.download = `libramientos-anticipo-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
