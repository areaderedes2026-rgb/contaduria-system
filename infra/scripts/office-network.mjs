/**
 * Red de oficina: el nombre estable es siempre contaduria.local.
 * Si cambia la IP, se regeneran certificados y se actualiza el hosts;
 * las PWA instaladas por ese nombre no hay que reinstalarlas.
 */
import { execFileSync, execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const root = join(__dirname, '../..');
export const OFFICE_HOSTNAME = 'contaduria.local';
export const certsDir = join(root, 'infra/certs');
export const kitDir = join(certsDir, 'kit-clientes');

const SKIP_IFACE = /vethernet|wsl|hyper-v|virtualbox|vmware|loopback|docker|bluetooth|hamachi|zerotier|radmin/i;

export function detectLanIps() {
  const nets = networkInterfaces();
  const preferred = [];
  const others = [];
  for (const [name, entries] of Object.entries(nets)) {
    if (!entries) continue;
    if (SKIP_IFACE.test(name)) continue;
    for (const net of entries) {
      const family = String(net.family);
      if (family !== 'IPv4' && family !== '4') continue;
      if (net.internal) continue;
      if (net.address.startsWith('169.254.')) continue;
      // Máscara típica de WSL (192.168.x.x /20)
      if (net.netmask === '255.255.240.0') continue;
      if (net.address.startsWith('192.168.') || net.address.startsWith('10.') || net.address.startsWith('172.')) {
        preferred.push(net.address);
      } else {
        others.push(net.address);
      }
    }
  }
  return [...new Set([...preferred, ...others])];
}

export function isValidIpv4(value) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value);
}

export function hasMkcert() {
  try {
    execSync('mkcert -help', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function mkcertCaroot() {
  try {
    return execSync('mkcert -CAROOT', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function hostsFilePath() {
  if (process.platform === 'win32') {
    const win = process.env.SystemRoot || 'C:\\Windows';
    return join(win, 'System32', 'drivers', 'etc', 'hosts');
  }
  return '/etc/hosts';
}

/** Reemplaza o agrega la línea de contaduria.local. Requiere permisos de administrador. */
export function upsertHosts(ip, hostname = OFFICE_HOSTNAME) {
  const path = hostsFilePath();
  let text = readFileSync(path, 'utf8');
  const line = `${ip}    ${hostname}`;
  const re = new RegExp(
    `^\\s*\\d{1,3}(?:\\.\\d{1,3}){3}\\s+${hostname.replace(/\./g, '\\.')}\\s*$`,
    'gim'
  );
  if (re.test(text)) {
    text = text.replace(re, line);
  } else {
    if (!text.endsWith('\n')) text += '\n';
    text += `${line}\n`;
  }
  writeFileSync(path, text, 'utf8');
}

export function upsertEnvFile(filePath, entries) {
  let text = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  if (text.length && !text.endsWith('\n')) text += '\n';
  for (const [key, value] of Object.entries(entries)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(text)) text = text.replace(re, line);
    else text += `${line}\n`;
  }
  writeFileSync(filePath, text, 'utf8');
}

function writeClientKit({ ip, port, hostname, keyPath, certPath }) {
  mkdirSync(kitDir, { recursive: true });
  writeFileSync(join(kitDir, 'oficina-ip.txt'), `${ip}\n`, 'utf8');
  writeFileSync(
    join(certsDir, 'red.json'),
    `${JSON.stringify(
      {
        hostname,
        ip,
        port,
        url: `https://${hostname}:${port}`,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  for (const name of [
    'configurar-acceso-cliente.bat',
    'configurar-acceso-cliente.ps1',
  ]) {
    const src = join(__dirname, name);
    if (existsSync(src)) copyFileSync(src, join(kitDir, name));
  }

  const caroot = mkcertCaroot();
  const caPem = caroot ? join(caroot, 'rootCA.pem') : '';
  if (caPem && existsSync(caPem)) {
    copyFileSync(caPem, join(kitDir, 'rootCA.pem'));
  }

  const leame = [
    'Kit de acceso — Contaduría Municipal',
    '',
    `URL estable (usar siempre esta, no la IP): https://${hostname}:${port}`,
    `IP actual del servidor: ${ip}`,
    '',
    'En CADA PC de trabajo (una vez, y otra vez si cambia la red):',
    '  1. Copie esta carpeta kit-clientes a un pendrive.',
    '  2. Primera vez: instale rootCA.pem en "Entidades de certificación raíz de confianza".',
    '  3. Clic derecho en configurar-acceso-cliente.bat → Ejecutar como administrador.',
    '  4. Abra Chrome/Edge en https://' + hostname + ':' + port,
    '  5. Instale la PWA. No hace falta reinstalarla si más adelante solo cambia la IP.',
    '',
    'Si cambia la red de la oficina:',
    '  - En el servidor: doble clic en Cambiar red (como administrador).',
    '  - En cada PC: vuelva a ejecutar configurar-acceso-cliente.bat (como administrador).',
    '  - La CA (rootCA.pem) no hace falta instalarla de nuevo.',
    '',
    `Certificados del servidor: ${keyPath} / ${certPath}`,
    '',
  ].join('\n');

  writeFileSync(join(kitDir, 'LEAME.txt'), leame, 'utf8');
  writeFileSync(join(certsDir, 'README.txt'), leame, 'utf8');
}

/**
 * Genera certificados, actualiza .env, hosts del servidor y el kit para las otras PCs.
 */
export function applyOfficeNetwork({ ip, hostname = OFFICE_HOSTNAME, restartPm2 = false } = {}) {
  const lanIps = detectLanIps();
  const primaryIp = ip || lanIps[0];

  if (!primaryIp || !isValidIpv4(primaryIp)) {
    throw new Error(
      'No se detectó una IP de red local. Indíquela: npm run office:red -- 192.168.1.50'
    );
  }

  if (!hasMkcert()) {
    throw new Error(
      'mkcert no está instalado. En PowerShell como administrador: winget install FiloSottile.mkcert && mkcert -install'
    );
  }

  mkdirSync(certsDir, { recursive: true });

  const hosts = Array.from(
    new Set([hostname, 'localhost', '127.0.0.1', primaryIp, ...lanIps])
  );

  const keyPath = join(certsDir, 'contaduria-key.pem');
  const certPath = join(certsDir, 'contaduria-cert.pem');
  const keyForEnv = keyPath.replace(/\\/g, '/');
  const certForEnv = certPath.replace(/\\/g, '/');

  console.log(`Hosts del certificado: ${hosts.join(', ')}`);
  execFileSync('mkcert', ['-key-file', keyPath, '-cert-file', certPath, ...hosts], {
    stdio: 'inherit',
    cwd: root,
  });

  const envPath = join(root, 'apps/backend/.env');
  upsertEnvFile(envPath, {
    HTTPS_KEY_PATH: keyForEnv,
    HTTPS_CERT_PATH: certForEnv,
  });
  console.log(`✓ HTTPS actualizado en ${envPath}`);

  try {
    upsertHosts(primaryIp, hostname);
    console.log(`✓ hosts del servidor: ${primaryIp} → ${hostname}`);
  } catch (error) {
    console.warn('⚠ No se pudo editar el archivo hosts de esta PC (hace falta Administrador).');
    console.warn(`  Agregue a mano: ${primaryIp}    ${hostname}`);
    if (error instanceof Error && error.message) {
      console.warn(`  ${error.message}`);
    }
  }

  const port = 3000;
  writeClientKit({ ip: primaryIp, port, hostname, keyPath: keyForEnv, certPath: certForEnv });
  console.log(`✓ Kit para otras PCs: ${kitDir}`);

  if (restartPm2) {
    try {
      execSync('npx pm2 restart ecosystem.config.cjs --update-env', {
        stdio: 'inherit',
        cwd: root,
      });
      console.log('✓ Aplicación reiniciada (PM2)');
    } catch {
      console.warn('⚠ PM2 no reinició (si aún no lo arrancó, es normal).');
      console.warn('  Luego: npx pm2 start ecosystem.config.cjs   o   npx pm2 restart contaduria-api');
    }
  }

  return {
    ip: primaryIp,
    hostname,
    port,
    url: `https://${hostname}:${port}`,
    kitDir,
  };
}
