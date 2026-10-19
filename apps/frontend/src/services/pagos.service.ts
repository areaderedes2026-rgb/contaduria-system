import { apiRequest } from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  Pago,
  Libramiento,
  LibramientoPendientePago,
  PagosResumen,
  SiguienteNumeroPago,
  MedioPago,
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

export const MEDIO_PAGO_LABELS: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia bancaria',
  CHEQUE: 'Cheque',
  OTRO: 'Otro',
};

export interface ListPagosParams {
  page?: number;
  limit?: number;
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  medioPago?: string;
  expedienteId?: number;
  libramientoId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getPagos(params: ListPagosParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anulado !== undefined) query.set('anulado', String(params.anulado));
  if (params.medioPago) query.set('medioPago', params.medioPago);
  if (params.expedienteId) query.set('expedienteId', String(params.expedienteId));
  if (params.libramientoId) query.set('libramientoId', String(params.libramientoId));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await apiRequest<ApiResponse<PaginatedResponse<Pago>>>(
    `/pagos?${query.toString()}`
  );
  return res.data;
}

export async function getPago(id: number) {
  const res = await apiRequest<ApiResponse<Pago>>(`/pagos/${id}`);
  return res.data;
}

export async function getSiguienteNumeroPago(anio?: number) {
  const query = anio ? `?anio=${anio}` : '';
  const res = await apiRequest<ApiResponse<SiguienteNumeroPago>>(
    `/pagos/siguiente-numero${query}`
  );
  return res.data;
}

export async function getPagosResumen() {
  const res = await apiRequest<ApiResponse<PagosResumen>>('/pagos/resumen');
  return res.data;
}

export async function getLibramientosPendientesPago() {
  const res = await apiRequest<ApiResponse<LibramientoPendientePago[]>>(
    '/pagos/libramientos-pendientes'
  );
  return res.data;
}

export async function getLibramientoParaPago(libramientoId: number) {
  const res = await apiRequest<
    ApiResponse<Libramiento & { saldo_pendiente: number; monto_pagado: number }>
  >(`/pagos/libramiento/${libramientoId}`);
  return res.data;
}

export async function createPago(data: {
  fecha_pago: string;
  libramiento_id: number;
  medio_pago: MedioPago;
  monto?: number;
  numero?: number;
  anio?: number;
  numero_comprobante?: string;
  banco?: string;
  observaciones?: string;
}) {
  const res = await apiRequest<ApiResponse<Pago>>('/pagos', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function anularPago(id: number, motivo: string) {
  const res = await apiRequest<ApiResponse<Pago>>(`/pagos/${id}/anular`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  });
  return res.data;
}

export async function exportPagosCsv(params: ListPagosParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anulado !== undefined) query.set('anulado', String(params.anulado));
  if (params.medioPago) query.set('medioPago', params.medioPago);
  if (params.expedienteId) query.set('expedienteId', String(params.expedienteId));
  if (params.libramientoId) query.set('libramientoId', String(params.libramientoId));

  const token = getToken();
  const response = await fetch(`${API_URL}/pagos/export?${query.toString()}`, {
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
  link.download = `pagos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
