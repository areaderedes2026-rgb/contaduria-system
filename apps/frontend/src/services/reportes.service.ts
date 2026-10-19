import { apiRequest } from './api';
import type { ApiResponse } from '@/types';

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

export interface ReporteTipo {
  id: string;
  nombre: string;
  descripcion: string;
  filtros: string[];
}

export interface ReporteGenerado {
  tipo: string;
  titulo: string;
  descripcion: string;
  periodo: string;
  filtros: Record<string, unknown>;
  generadoEn: string;
  datos: unknown;
  totales: Record<string, number>;
}

export interface ReporteFiltrosParams {
  fechaDesde?: string;
  fechaHasta?: string;
  anio?: number;
  estado?: string;
  pagado?: boolean;
  medioPago?: string;
}

export async function getTiposReporte() {
  const res = await apiRequest<ApiResponse<ReporteTipo[]>>('/reportes/tipos');
  return res.data;
}

export async function generarReporte(tipo: string, params: ReporteFiltrosParams = {}) {
  const query = new URLSearchParams();
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.estado) query.set('estado', params.estado);
  if (params.pagado !== undefined) query.set('pagado', String(params.pagado));
  if (params.medioPago) query.set('medioPago', params.medioPago);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await apiRequest<ApiResponse<ReporteGenerado>>(`/reportes/${tipo}${qs}`);
  return res.data;
}

export async function exportReporteCsv(tipo: string, params: ReporteFiltrosParams = {}) {
  const query = new URLSearchParams();
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.estado) query.set('estado', params.estado);
  if (params.pagado !== undefined) query.set('pagado', String(params.pagado));
  if (params.medioPago) query.set('medioPago', params.medioPago);

  const token = getToken();
  const response = await fetch(`${API_URL}/reportes/${tipo}/export?${query.toString()}`, {
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
  link.download = `reporte-${tipo}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
