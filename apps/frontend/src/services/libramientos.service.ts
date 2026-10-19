import { apiRequest } from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  Libramiento,
  LibramientoConsolidado,
  Afectacion,
  AfectacionDisponibleLibramiento,
  ExpedienteDisponibleLibramiento,
  LibramientosResumen,
  SiguienteNumeroLibramiento,
  CircuitoExpediente,
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

export interface ListLibramientosParams {
  page?: number;
  limit?: number;
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  pagado?: boolean;
  expedienteId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  circuito?: CircuitoExpediente;
}

export async function getLibramientos(params: ListLibramientosParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anulado !== undefined) query.set('anulado', String(params.anulado));
  if (params.pagado !== undefined) query.set('pagado', String(params.pagado));
  if (params.expedienteId) query.set('expedienteId', String(params.expedienteId));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await apiRequest<ApiResponse<PaginatedResponse<Libramiento>>>(
    `/libramientos?${query.toString()}`
  );
  return res.data;
}

export async function getLibramiento(id: number) {
  const res = await apiRequest<ApiResponse<Libramiento>>(`/libramientos/${id}`);
  return res.data;
}

export async function getSiguienteNumeroLibramiento(anio?: number) {
  const query = anio ? `?anio=${anio}` : '';
  const res = await apiRequest<ApiResponse<SiguienteNumeroLibramiento>>(
    `/libramientos/siguiente-numero${query}`
  );
  return res.data;
}

export async function getLibramientosResumen(circuito?: CircuitoExpediente) {
  const query = new URLSearchParams();
  if (circuito) query.set('circuito', circuito);
  const qs = query.toString();
  const res = await apiRequest<ApiResponse<LibramientosResumen>>(
    `/libramientos/resumen${qs ? `?${qs}` : ''}`
  );
  return res.data;
}

export async function getLibramientosConsolidados(params: ListLibramientosParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anulado !== undefined) query.set('anulado', String(params.anulado));
  if (params.circuito) query.set('circuito', params.circuito);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await apiRequest<ApiResponse<PaginatedResponse<LibramientoConsolidado>>>(
    `/libramientos/consolidados?${query.toString()}`
  );
  return res.data;
}

export async function getAfectacionesDisponiblesLibramiento() {
  const res = await apiRequest<ApiResponse<AfectacionDisponibleLibramiento[]>>(
    '/libramientos/afectaciones-disponibles'
  );
  return res.data;
}

export async function getExpedientesDisponiblesLibramiento() {
  const res = await apiRequest<ApiResponse<ExpedienteDisponibleLibramiento[]>>(
    '/libramientos/expedientes-disponibles'
  );
  return res.data;
}

export type AfectacionParaLibramiento = Afectacion & {
  expediente_numero?: string;
  expediente_detalle?: string;
  proveedor_nombre?: string;
};

export async function getAfectacionParaLibramiento(afectacionId: number) {
  const res = await apiRequest<ApiResponse<AfectacionParaLibramiento>>(
    `/libramientos/afectacion/${afectacionId}`
  );
  return res.data;
}

export async function createLibramiento(data: {
  fecha: string;
  afectacion_id: number;
  beneficiario?: string;
  importe: number;
  retenciones?: number;
  numero?: number;
  numero_decreto?: string | null;
  observaciones?: string;
  detalle: Array<{
    afectacion_detalle_id?: number;
    cuenta_id: number;
    descripcion: string;
    importe: number;
  }>;
}) {
  const res = await apiRequest<ApiResponse<Libramiento>>('/libramientos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function anularLibramiento(id: number, motivo: string) {
  const res = await apiRequest<ApiResponse<Libramiento>>(`/libramientos/${id}/anular`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  });
  return res.data;
}

export async function exportLibramientosCsv(params: ListLibramientosParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anulado !== undefined) query.set('anulado', String(params.anulado));
  if (params.pagado !== undefined) query.set('pagado', String(params.pagado));
  if (params.circuito) query.set('circuito', params.circuito);

  const token = getToken();
  const response = await fetch(`${API_URL}/libramientos/consolidados/export?${query.toString()}`, {
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
  link.download = `libramientos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
