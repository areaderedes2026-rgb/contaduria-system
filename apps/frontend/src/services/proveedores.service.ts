import { apiRequest } from './api';
import type { ApiResponse, PaginatedResponse, Proveedor, ProveedorResumen, AuditoriaRegistro } from '@/types';

export interface ListProveedoresParams {
  page?: number;
  limit?: number;
  search?: string;
  activo?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateProveedorParams {
  nombre: string;
  documento?: string;
  domicilio?: string;
  telefono?: string;
  activo?: boolean;
}

export interface UpdateProveedorParams {
  nombre?: string;
  documento?: string | null;
  domicilio?: string | null;
  telefono?: string | null;
  activo?: boolean;
}

export async function getProveedores(params: ListProveedoresParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.activo !== undefined) query.set('activo', String(params.activo));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await apiRequest<ApiResponse<PaginatedResponse<Proveedor>>>(
    `/proveedores?${query.toString()}`
  );
  return res.data;
}

export async function getProveedoresActivos(search?: string) {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  const qs = query.toString();
  const res = await apiRequest<ApiResponse<Proveedor[]>>(
    `/proveedores/activos${qs ? `?${qs}` : ''}`
  );
  return res.data;
}

export async function getProveedor(id: number) {
  const res = await apiRequest<ApiResponse<Proveedor>>(`/proveedores/${id}`);
  return res.data;
}

export async function getProveedorHistorial(id: number) {
  const res = await apiRequest<ApiResponse<AuditoriaRegistro[]>>(`/proveedores/${id}/historial`);
  return res.data;
}

export async function getProveedorResumen(id: number) {
  const res = await apiRequest<ApiResponse<ProveedorResumen>>(`/proveedores/${id}/resumen`);
  return res.data;
}

export async function createProveedor(data: CreateProveedorParams) {
  const res = await apiRequest<ApiResponse<Proveedor>>('/proveedores', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateProveedor(id: number, data: UpdateProveedorParams) {
  const res = await apiRequest<ApiResponse<Proveedor>>(`/proveedores/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteProveedor(id: number) {
  await apiRequest(`/proveedores/${id}`, { method: 'DELETE' });
}
