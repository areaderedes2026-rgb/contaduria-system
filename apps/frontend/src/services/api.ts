import type { ApiError } from '@/types';
import { forceLogout } from '@/lib/session';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public errors?: ApiError['errors']
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
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

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (error) {
    if (isNetworkError(error)) {
      throw new ApiClientError(
        'No se pudo conectar con el servidor. Verifique que el backend y la base de datos estén en ejecución.',
        0,
        'NETWORK_ERROR'
      );
    }
    throw error;
  }

  let data: ApiError & { success?: boolean; message?: string; code?: string };
  try {
    data = await response.json();
  } catch {
    throw new ApiClientError(
      response.ok
        ? 'Respuesta inválida del servidor'
        : 'El servidor no está disponible. Inicie Docker y ejecute: npm run db:up',
      response.status,
      'INVALID_RESPONSE'
    );
  }

  if (!response.ok) {
    // Sesión vencida o inválida: limpiar y volver al login
    if (response.status === 401 && endpoint !== '/auth/login') {
      forceLogout('expired');
    }

    throw new ApiClientError(
      data.message || 'Error en la solicitud',
      response.status,
      data.code,
      data.errors
    );
  }

  return data as T;
}

/** Health check sin autenticación (para reconexión tras reinicio). */
export async function pingApi(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}
