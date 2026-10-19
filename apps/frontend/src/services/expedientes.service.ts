import { apiRequest } from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  Expediente,
  ExpedienteHistorial,
  ExpedientesResumen,
  SiguienteNumeroExpediente,
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

type ExpedienteRaw = Expediente & {
  fecha_ingreso?: string;
  afectaciones_activas?: number | string;
  anticipos_activos?: number | string;
};

function mapExpediente(raw: ExpedienteRaw): Expediente {
  return {
    ...raw,
    fechaIngreso: raw.fechaIngreso ?? raw.fecha_ingreso ?? '',
    importe: typeof raw.importe === 'string' ? parseFloat(raw.importe) : raw.importe,
    circuito:
      raw.circuito === 'CARGO_A_RENDIR'
        ? 'CARGO_A_RENDIR'
        : raw.circuito === 'PENDIENTE'
          ? 'PENDIENTE'
          : 'NORMAL',
    afectaciones_activas:
      typeof raw.afectaciones_activas === 'string'
        ? parseInt(raw.afectaciones_activas, 10)
        : (raw.afectaciones_activas ?? 0),
    anticipos_activos:
      typeof raw.anticipos_activos === 'string'
        ? parseInt(raw.anticipos_activos, 10)
        : (raw.anticipos_activos ?? 0),
  };
}

export interface ListExpedientesParams {
  page?: number;
  limit?: number;
  search?: string;
  estado?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  proveedorId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  circuito?: CircuitoExpediente;
}

export interface CreateExpedienteParams {
  numero?: number;
  /** Compatibilidad: un solo proveedor. Preferir proveedorIds. */
  proveedorId?: number;
  proveedorIds?: number[];
  importe: number;
  detalle: string;
  fechaIngreso: string;
  anio?: number;
  circuito?: CircuitoExpediente;
}

export interface UpdateExpedienteParams {
  proveedorId?: number;
  proveedorIds?: number[];
  importe?: number;
  detalle?: string;
  fechaIngreso?: string;
  circuito?: CircuitoExpediente;
}

export async function getExpedientes(params: ListExpedientesParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.estado) query.set('estado', params.estado);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anulado !== undefined) query.set('anulado', String(params.anulado));
  if (params.proveedorId) query.set('proveedorId', String(params.proveedorId));
  if (params.circuito) query.set('circuito', params.circuito);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await apiRequest<ApiResponse<PaginatedResponse<ExpedienteRaw>>>(
    `/expedientes?${query.toString()}`
  );
  return {
    ...res.data,
    data: res.data.data.map(mapExpediente),
  };
}

export async function getExpediente(id: number) {
  const res = await apiRequest<ApiResponse<ExpedienteRaw>>(`/expedientes/${id}`);
  return mapExpediente(res.data);
}

export async function getExpedienteHistorial(id: number) {
  const res = await apiRequest<ApiResponse<ExpedienteHistorial[]>>(`/expedientes/${id}/historial`);
  return res.data;
}

export async function getSiguienteNumero(anio?: number) {
  const query = new URLSearchParams();
  if (anio) query.set('anio', String(anio));
  const qs = query.toString();
  const res = await apiRequest<ApiResponse<SiguienteNumeroExpediente>>(
    `/expedientes/siguiente-numero${qs ? `?${qs}` : ''}`
  );
  return res.data;
}

export async function getExpedientesResumen(circuito?: CircuitoExpediente) {
  const query = new URLSearchParams();
  if (circuito) query.set('circuito', circuito);
  const qs = query.toString();
  const res = await apiRequest<ApiResponse<ExpedientesResumen>>(
    `/expedientes/resumen${qs ? `?${qs}` : ''}`
  );
  return res.data;
}

export async function createExpediente(data: CreateExpedienteParams) {
  const res = await apiRequest<ApiResponse<ExpedienteRaw>>('/expedientes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return mapExpediente(res.data);
}

export async function updateExpediente(id: number, data: UpdateExpedienteParams) {
  const res = await apiRequest<ApiResponse<ExpedienteRaw>>(`/expedientes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return mapExpediente(res.data);
}

export async function deleteExpediente(id: number) {
  await apiRequest(`/expedientes/${id}`, { method: 'DELETE' });
}

export async function anularExpediente(id: number, motivo: string) {
  const res = await apiRequest<ApiResponse<ExpedienteRaw>>(`/expedientes/${id}/anular`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  });
  return mapExpediente(res.data);
}

export async function archivarExpediente(id: number, observacion?: string) {
  const res = await apiRequest<ApiResponse<ExpedienteRaw>>(`/expedientes/${id}/archivar`, {
    method: 'POST',
    body: JSON.stringify({ observacion }),
  });
  return mapExpediente(res.data);
}

export async function exportExpedientesCsv(params: ListExpedientesParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.estado) query.set('estado', params.estado);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anulado !== undefined) query.set('anulado', String(params.anulado));
  if (params.circuito) query.set('circuito', params.circuito);

  const token = getToken();
  const response = await fetch(`${API_URL}/expedientes/export?${query.toString()}`, {
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
  link.download = `expedientes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
