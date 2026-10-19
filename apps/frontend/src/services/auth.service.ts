import { apiRequest } from './api';
import type { ApiResponse, LoginResponse, User } from '@/types';

export async function login(username: string, password: string) {
  const res = await apiRequest<ApiResponse<LoginResponse>>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return res.data;
}

export async function getMe() {
  const res = await apiRequest<ApiResponse<User>>('/auth/me');
  return res.data;
}
