import { apiRequest } from './api';
import type { ApiResponse, PaginatedResponse, Rol, User, DashboardStats } from '@/types';

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getUsers(params: ListUsersParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await apiRequest<ApiResponse<PaginatedResponse<User>>>(
    `/usuarios?${query.toString()}`
  );
  return res.data;
}

export async function getRoles() {
  const res = await apiRequest<ApiResponse<Rol[]>>('/usuarios/roles');
  return res.data;
}

export async function createUser(data: {
  username: string;
  password: string;
  nombre: string;
  apellido: string;
  email?: string;
  rol_id: number;
}) {
  const res = await apiRequest<ApiResponse<User>>('/usuarios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateUser(
  id: number,
  data: Partial<{
    nombre: string;
    apellido: string;
    email: string;
    rol_id: number;
    activo: boolean;
    password: string;
  }>
) {
  const res = await apiRequest<ApiResponse<User>>(`/usuarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteUser(id: number) {
  await apiRequest(`/usuarios/${id}`, { method: 'DELETE' });
}

export async function getDashboardStats() {
  const res = await apiRequest<ApiResponse<DashboardStats>>('/dashboard/stats');
  return res.data;
}
