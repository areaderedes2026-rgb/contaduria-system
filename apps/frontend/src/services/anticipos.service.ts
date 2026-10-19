import { apiRequest } from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  Anticipo,
  AnticiposResumen,
  ExpedienteDisponibleAnticipo,
  SiguienteNumeroAnticipo,
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

export interface ListAnticiposParams {
  page?: number;
  limit?: number;
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulada?: boolean;
  expedienteId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getAnticipos(params: ListAnticiposParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anulada !== undefined) query.set('anulada', String(params.anulada));
  if (params.expedienteId) query.set('expedienteId', String(params.expedienteId));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await apiRequest<ApiResponse<PaginatedResponse<Anticipo>>>(
    `/anticipos?${query.toString()}`
  );
  return res.data;
}

export async function getAnticipo(id: number) {
  const res = await apiRequest<ApiResponse<Anticipo>>(`/anticipos/${id}`);
  return res.data;
}

export async function getSiguienteNumeroAnticipo(anio?: number) {
  const query = anio ? `?anio=${anio}` : '';
  const res = await apiRequest<ApiResponse<SiguienteNumeroAnticipo>>(
    `/anticipos/siguiente-numero${query}`
  );
  return res.data;
}

export async function getAnticiposResumen() {
  const res = await apiRequest<ApiResponse<AnticiposResumen>>('/anticipos/resumen');
  return res.data;
}

export async function getExpedientesDisponiblesAnticipo() {
  const res = await apiRequest<ApiResponse<ExpedienteDisponibleAnticipo[]>>(
    '/anticipos/expedientes-disponibles'
  );
  return res.data;
}

export async function createAnticipo(data: {
  fecha: string;
  expediente_id: number;
  destinatario?: string;
  numero?: number;
  importe: number;
  observaciones?: string | null;
  numero_comprobante?: string | null;
}) {
  const res = await apiRequest<ApiResponse<Anticipo>>('/anticipos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function anularAnticipo(id: number, motivo: string) {
  const res = await apiRequest<ApiResponse<Anticipo>>(`/anticipos/${id}/anular`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  });
  return res.data;
}

export async function exportAnticiposCsv(params: ListAnticiposParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anulada !== undefined) query.set('anulada', String(params.anulada));
  if (params.expedienteId) query.set('expedienteId', String(params.expedienteId));

  const token = getToken();
  const response = await fetch(`${API_URL}/anticipos/export?${query.toString()}`, {
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
  link.download = `anticipos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
