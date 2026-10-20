import { spawn } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { env } from '../config/env.js';
import { getAppVersion } from '../utils/appVersion.js';
import { AppError } from '../utils/errors.js';
import { registrarAuditoria } from '../repositories/audit.repository.js';

const DOCKER_CONTAINER = 'contaduria-postgres';

export interface BackupFile {
  filename: string;
  mime: string;
  body: Buffer;
}

function stampFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `contaduria-respaldo-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.sql.gz`;
}

function run(command: string, args: string[], extraEnv: Record<string, string> = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...extraEnv },
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }
      const detail = Buffer.concat(stderr).toString('utf8').trim();
      reject(new Error(detail || `${command} salió con código ${code}`));
    });
  });
}

async function dumpViaDocker(): Promise<Buffer> {
  return run('docker', [
    'exec',
    '-e',
    'PGCLIENTENCODING=UTF8',
    DOCKER_CONTAINER,
    'pg_dump',
    '-U',
    env.DB_USER,
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-acl',
    '--encoding=UTF8',
    env.DB_NAME,
  ]);
}

async function dumpViaLocal(): Promise<Buffer> {
  return run(
    'pg_dump',
    [
      '-h',
      env.DB_HOST,
      '-p',
      String(env.DB_PORT),
      '-U',
      env.DB_USER,
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      '--encoding=UTF8',
      env.DB_NAME,
    ],
    { PGPASSWORD: env.DB_PASSWORD }
  );
}

function withHeader(sql: Buffer): Buffer {
  const info = getAppVersion();
  const header = [
    '-- ============================================================',
    '-- Respaldo Contaduría Municipal',
    `-- Generado: ${new Date().toISOString()}`,
    `-- Aplicación: ${info.version} (${info.commit})`,
    `-- Base: ${env.DB_NAME}`,
    '--',
    '-- Restaurar (PC servidor, Docker):',
    '--   npm run db:restore -- ruta\\al\\archivo.sql.gz',
    '-- o: node infra/scripts/restaurar-backup.mjs ruta\\al\\archivo.sql.gz',
    '-- ============================================================',
    '',
  ].join('\n');
  return Buffer.concat([Buffer.from(header, 'utf8'), sql]);
}

export async function createDatabaseBackup(opts: {
  usuarioId: number;
  ip?: string;
}): Promise<BackupFile> {
  let sql: Buffer;
  try {
    sql = await dumpViaDocker();
  } catch {
    try {
      sql = await dumpViaLocal();
    } catch {
      throw new AppError(
        500,
        'No se pudo generar el respaldo. Compruebe que Docker (contaduria-postgres) esté en marcha.',
        'BACKUP_DUMP_FAILED'
      );
    }
  }

  if (!sql.length) {
    throw new AppError(500, 'El respaldo de la base quedó vacío.', 'BACKUP_EMPTY');
  }

  const body = gzipSync(withHeader(sql), { level: 9 });
  const filename = stampFilename();

  await registrarAuditoria({
    usuario_id: opts.usuarioId,
    accion: 'BACKUP',
    entidad: 'sistema',
    cambios: { archivo: filename, bytes: body.length },
    ip: opts.ip,
  });

  return {
    filename,
    mime: 'application/gzip',
    body,
  };
}
