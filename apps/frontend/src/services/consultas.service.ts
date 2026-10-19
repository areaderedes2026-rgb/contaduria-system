import { apiRequest } from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  ExpedienteTrazabilidad,
  MovimientoCuenta,
  BeneficiarioItem,
  MovimientoConsolidado,
  EjecucionCuenta,
  ConsultasResumen,
  EstadoExpediente,
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type ExpedienteTrazabilidadRaw = Omit<ExpedienteTrazabilidad, 'expediente'> & {
  expediente: ExpedienteTrazabilidad['expediente'] & {
    fecha_ingreso?: string;
    fecha?: string;
    destinatario?: string;
    descripcion?: string;
  };
};

function mapExpedienteTrazabilidad(raw: ExpedienteTrazabilidadRaw): ExpedienteTrazabilidad {
  const exp = raw.expediente;
  return {
    ...raw,
    expediente: {
      ...exp,
      proveedor_nombre: exp.proveedor_nombre ?? '',
      detalle: exp.detalle ?? '',
      importe: typeof exp.importe === 'string' ? parseFloat(exp.importe) : (exp.importe ?? 0),
      fechaIngreso: exp.fechaIngreso ?? exp.fecha_ingreso ?? exp.fecha ?? '',
      estado: exp.estado as EstadoExpediente,
    },
  };
}

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

export async function getConsultasResumen() {
  const res = await apiRequest<ApiResponse<ConsultasResumen>>('/consultas/resumen');
  return res.data;
}

export async function buscarExpedienteTrazabilidad(numero: number, anio: number) {
  const res = await apiRequest<ApiResponse<ExpedienteTrazabilidadRaw>>(
    `/consultas/expediente/buscar?numero=${numero}&anio=${anio}`
  );
  return mapExpedienteTrazabilidad(res.data);
}

export async function getExpedienteTrazabilidad(id: number) {
  const res = await apiRequest<ApiResponse<ExpedienteTrazabilidadRaw>>(`/consultas/expediente/${id}`);
  return mapExpedienteTrazabilidad(res.data);
}

export async function getMovimientosPorCuenta(
  cuentaId: number,
  fechaDesde?: string,
  fechaHasta?: string
) {
  const query = new URLSearchParams();
  if (fechaDesde) query.set('fechaDesde', fechaDesde);
  if (fechaHasta) query.set('fechaHasta', fechaHasta);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await apiRequest<ApiResponse<MovimientoCuenta[]>>(
    `/consultas/cuenta/${cuentaId}/movimientos${qs}`
  );
  return res.data;
}

export async function buscarPorBeneficiario(
  search: string,
  page = 1,
  limit = 15,
  tipo?: string
) {
  const query = new URLSearchParams();
  query.set('search', search);
  query.set('page', String(page));
  query.set('limit', String(limit));
  if (tipo) query.set('tipo', tipo);

  const res = await apiRequest<ApiResponse<PaginatedResponse<BeneficiarioItem>>>(
    `/consultas/beneficiario?${query.toString()}`
  );
  return res.data;
}

export interface ListMovimientosParams {
  page?: number;
  limit?: number;
  tipo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  anio?: number;
  search?: string;
}

export async function getMovimientosConsolidados(params: ListMovimientosParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.tipo) query.set('tipo', params.tipo);
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.search) query.set('search', params.search);

  const res = await apiRequest<ApiResponse<PaginatedResponse<MovimientoConsolidado>>>(
    `/consultas/movimientos?${query.toString()}`
  );
  return res.data;
}

export async function getEjecucionPresupuestaria(anio?: number) {
  const query = new URLSearchParams();
  if (anio) query.set('anio', String(anio));
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await apiRequest<ApiResponse<EjecucionCuenta[]>>(
    `/consultas/ejecucion-presupuestaria${qs}`
  );
  return res.data;
}

export async function exportMovimientosCsv(params: ListMovimientosParams = {}) {
  const query = new URLSearchParams();
  if (params.tipo) query.set('tipo', params.tipo);
  if (params.fechaDesde) query.set('fechaDesde', params.fechaDesde);
  if (params.fechaHasta) query.set('fechaHasta', params.fechaHasta);
  if (params.anio) query.set('anio', String(params.anio));
  if (params.search) query.set('search', params.search);

  const token = getToken();
  const response = await fetch(`${API_URL}/consultas/movimientos/export?${query.toString()}`, {
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
  link.download = `movimientos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportEjecucionCsv(anio?: number) {
  const query = new URLSearchParams();
  if (anio) query.set('anio', String(anio));
  const qs = query.toString() ? `?${query.toString()}` : '';

  const token = getToken();
  const response = await fetch(`${API_URL}/consultas/ejecucion-presupuestaria/export${qs}`, {
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
  link.download = `ejecucion-presupuestaria-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
