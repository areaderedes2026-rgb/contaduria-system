import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface OfficeAccessInfo {
  hostname: string;
  ip: string;
  port: number;
  url: string;
}

export interface AppVersionInfo {
  version: string;
  commit: string;
  branch?: string;
  builtAt: string;
  access?: OfficeAccessInfo;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const CANDIDATES = [
  join(__dirname, '../version.json'),
  join(__dirname, '../../frontend/dist/version.json'),
  join(__dirname, '../../../frontend/dist/version.json'),
];

const RED_CANDIDATES = [
  join(__dirname, '../../../../infra/certs/red.json'),
  join(__dirname, '../../../infra/certs/red.json'),
];

function readOfficeAccess(): OfficeAccessInfo | undefined {
  for (const path of RED_CANDIDATES) {
    try {
      if (!existsSync(path)) continue;
      const data = JSON.parse(readFileSync(path, 'utf8')) as Partial<OfficeAccessInfo>;
      if (!data.hostname || !data.ip || !data.url || !data.port) continue;
      return {
        hostname: data.hostname,
        ip: data.ip,
        port: data.port,
        url: data.url,
      };
    } catch {
      continue;
    }
  }
  return undefined;
}

let cached: AppVersionInfo | null = null;

function readVersionFile(path: string): AppVersionInfo | null {
  try {
    if (!existsSync(path)) return null;
    const data = JSON.parse(readFileSync(path, 'utf8')) as Partial<AppVersionInfo>;
    if (!data.version || !data.commit || !data.builtAt) return null;
    return {
      version: data.version,
      commit: data.commit,
      branch: data.branch,
      builtAt: data.builtAt,
      access: readOfficeAccess(),
    };
  } catch {
    return null;
  }
}

export function getAppVersion(): AppVersionInfo {
  if (cached) return cached;

  for (const path of CANDIDATES) {
    const info = readVersionFile(path);
    if (info) {
      cached = info;
      return info;
    }
  }

  cached = {
    version: '1.0.0',
    commit: 'dev',
    builtAt: new Date(0).toISOString(),
    access: readOfficeAccess(),
  };
  return cached;
}

/** Invalida caché (útil tras hot-reload en desarrollo). */
export function resetAppVersionCache() {
  cached = null;
}
