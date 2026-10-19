import { apiRequest } from '@/services/api';
import type { ApiResponse } from '@/types';

export interface AppVersionInfo {
  version: string;
  commit: string;
  branch?: string;
  builtAt: string;
}

export function versionFingerprint(info: AppVersionInfo): string {
  return `${info.version}|${info.commit}|${info.builtAt}`;
}

export async function getAppVersion(): Promise<AppVersionInfo> {
  const res = await apiRequest<ApiResponse<AppVersionInfo>>('/version');
  return res.data;
}
