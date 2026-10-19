import { execSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '../..');
export const CERTS_DIR = join(ROOT, 'infra/certs');
export const OFFICE_HOSTNAME = 'contaduria.local';
export const OFFICE_PORT = 3000;

export function detectLanIps() {
  const nets = networkInterfaces();
  const ips = [];
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const net of entries) {
      if (net.family !== 'IPv4' && net.family !== 4) continue;
      if (net.internal) continue;
      ips.push(net.address);
    }
  }
  return ips;
}

export function hasMkcert() {
  try {
    execSync('mkcert -help', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function posixPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

export function upsertEnvKeys(envPath, entries) {
  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const lines = existing.replace(/\r\n/g, '\n').split('\n');
  const keys = Object.keys(entries);
  const seen = new Set();

  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eq = trimmed.indexOf('=');
    if (eq < 0) return line;
    const key = trimmed.slice(0, eq).trim();
    if (!(key in entries)) return line;
    seen.add(key);
    return `${key}=${entries[key]}`;
  });

  for (const key of keys) {
    if (!seen.has(key)) {
      if (next.length && next[next.length - 1] !== '') next.push('');
      next.push(`${key}=${entries[key]}`);
    }
  }

  const body = `${next.join('\n').replace(/\n+$/, '')}\n`;
  mkdirSync(dirname(envPath), { recursive: true });
  writeFileSync(envPath, body, 'utf8');
}

export function writeClientHostsHelper({ ip, hostname = OFFICE_HOSTNAME, port = OFFICE_PORT }) {
  mkdirSync(CERTS_DIR, { recursive: true });
  writeFileSync(join(CERTS_DIR, 'current-ip.txt'), `${ip}\n`, 'utf8');

  const batPath = join(CERTS_DIR, 'agregar-hosts-cliente.bat');
  writeFileSync(
    batPath,
    [
      '@echo off',
      'chcp 65001 >nul',
      'title Contaduria — actualizar nombre de red',
      'net session >nul 2>&1',
      'if errorlevel 1 (',
      '  echo Ejecute este archivo como administrador:',
      '  echo clic derecho → Ejecutar como administrador.',
      '  echo.',
      '  pause',
      '  exit /b 1',
      ')',
      `set "IP=${ip}"`,
      `set "NAME=${hostname}"`,
      'set "HOSTS=%SystemRoot%\\System32\\drivers\\etc\\hosts"',
      'powershell -NoProfile -ExecutionPolicy Bypass -Command ^',
      "  \"$p=$env:HOSTS; $ip=$env:IP; $n=$env:NAME; if (-not (Test-Path $p)) { throw 'No se encontro el archivo hosts' }; $raw = Get-Content -LiteralPath $p -ErrorAction SilentlyContinue; $kept = @($raw | Where-Object { $_ -notmatch '(?i)\\bcontaduria\\.local\\b' }); $kept += \"$ip    $n\"; Set-Content -LiteralPath $p -Value $kept -Encoding ASCII\"",
      'if errorlevel 1 (',
      '  echo No se pudo actualizar el archivo hosts.',
      '  pause',
      '  exit /b 1',
      ')',
      'echo.',
      `echo Listo. Abra Chrome o Edge en: https://${hostname}:${port}`,
      'echo La PWA instalada con ese nombre no hay que reinstalarla.',
      'echo.',
      'pause',
      '',
    ].join('\r\n'),
    'utf8'
  );

  writeFileSync(
    join(CERTS_DIR, 'INSTRUCCIONES-CLIENTES.txt'),
    [
      `Servidor actual: ${ip}`,
      `Nombre fijo: ${hostname}`,
      `URL (siempre la misma): https://${hostname}:${port}`,
      '',
      'En CADA PC de trabajo (y en el servidor, si aún no lo hizo):',
      '  1. Copie este archivo: agregar-hosts-cliente.bat',
      '  2. Clic derecho → Ejecutar como administrador',
      '  3. Abra https://' + hostname + ':' + port,
      '',
      'La primera vez también importe rootCA.pem (mkcert -CAROOT en el servidor).',
      'Si ya lo importó, no hace falta repetirlo al cambiar de red.',
      '',
    ].join('\n'),
    'utf8'
  );

  return batPath;
}

export function generateOfficeCerts({ primaryIp, hostname = OFFICE_HOSTNAME } = {}) {
  const lanIps = detectLanIps();
  const ip = primaryIp || lanIps[0];
  if (!ip) {
    throw new Error(
      'No se detectó una IP de red local. Indíquela: npm run office:certs -- 192.168.1.50'
    );
  }
  if (!hasMkcert()) {
    throw new Error(
      'mkcert no está instalado. En PowerShell como administrador: winget install FiloSottile.mkcert && mkcert -install'
    );
  }

  mkdirSync(CERTS_DIR, { recursive: true });
  const hosts = Array.from(
    new Set([hostname, 'localhost', '127.0.0.1', ip, ...lanIps])
  );
  const keyPath = join(CERTS_DIR, 'contaduria-key.pem');
  const certPath = join(CERTS_DIR, 'contaduria-cert.pem');

  execFileSync('mkcert', ['-key-file', keyPath, '-cert-file', certPath, ...hosts], {
    stdio: 'inherit',
    cwd: ROOT,
  });

  const backendEnv = join(ROOT, 'apps/backend/.env');
  upsertEnvKeys(backendEnv, {
    HTTPS_KEY_PATH: posixPath(keyPath),
    HTTPS_CERT_PATH: posixPath(certPath),
    OFFICE_HOST: hostname,
  });

  writeClientHostsHelper({ ip, hostname });

  writeFileSync(
    join(CERTS_DIR, 'README.txt'),
    [
      'Certificados HTTPS de la oficina.',
      '',
      `URL estable (recomendadas todas las PCs): https://${hostname}:${OFFICE_PORT}`,
      `IP actual del servidor: ${ip}`,
      '',
      `HTTPS_KEY_PATH=${posixPath(keyPath)}`,
      `HTTPS_CERT_PATH=${posixPath(certPath)}`,
      '',
      'Si cambia el WiFi o la IP: en el servidor doble clic en cambiar-red.bat',
      'y luego ejecutar agregar-hosts-cliente.bat como administrador en cada PC.',
      '',
    ].join('\n'),
    'utf8'
  );

  return { ip, hostname, keyPath, certPath, hosts };
}
