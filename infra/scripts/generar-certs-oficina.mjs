#!/usr/bin/env node
/**
 * Genera certificados HTTPS locales con mkcert para la PC servidor de la oficina.
 * Uso:
 *   npm run office:certs
 *   npm run office:certs -- 192.168.1.50
 *   npm run office:certs -- 192.168.1.50 contaduria.local
 */
import { execSync, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const certsDir = join(root, 'infra/certs');

function detectLanIps() {
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

function hasMkcert() {
  try {
    execSync('mkcert -help', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const args = process.argv.slice(2).filter((a) => a !== '--');
const lanIps = detectLanIps();
const primaryIp = args[0] || lanIps[0];
const hostname = args[1] || 'contaduria.local';

if (!primaryIp) {
  console.error('✗ No se detectó una IP de red local.');
  console.error('  Indíquela manualmente: npm run office:certs -- 192.168.1.50');
  process.exit(1);
}

if (!hasMkcert()) {
  console.error('✗ mkcert no está instalado o no está en el PATH.');
  console.error('');
  console.error('  Windows (recomendado):');
  console.error('    1. Instale Chocolatey o scoop, luego: choco install mkcert');
  console.error('    2. En PowerShell como administrador: mkcert -install');
  console.error('    3. Vuelva a ejecutar: npm run office:certs');
  console.error('');
  console.error('  Más info: https://github.com/FiloSottile/mkcert');
  process.exit(1);
}

mkdirSync(certsDir, { recursive: true });

const hosts = Array.from(
  new Set([hostname, 'localhost', '127.0.0.1', primaryIp, ...lanIps])
);

const keyPath = join(certsDir, 'contaduria-key.pem');
const certPath = join(certsDir, 'contaduria-cert.pem');

console.log('=== Certificados HTTPS oficina ===\n');
console.log(`Hosts: ${hosts.join(', ')}`);
console.log(`Salida: ${certsDir}\n`);

try {
  execFileSync(
    'mkcert',
    ['-key-file', keyPath, '-cert-file', certPath, ...hosts],
    { stdio: 'inherit', cwd: root }
  );
} catch {
  console.error('\n✗ mkcert falló al generar los certificados.');
  process.exit(1);
}

const envHintPath = join(certsDir, 'README.txt');
const keyForEnv = keyPath.replace(/\\/g, '/');
const certForEnv = certPath.replace(/\\/g, '/');

writeFileSync(
  envHintPath,
  [
    'Certificados generados para Contaduría Municipal.',
    '',
    'Agregue estas líneas a apps/backend/.env en la PC servidor:',
    '',
    `HTTPS_KEY_PATH=${keyForEnv}`,
    `HTTPS_CERT_PATH=${certForEnv}`,
    '',
    `URL de acceso recomendada: https://${hostname}:3000`,
    `También: https://${primaryIp}:3000`,
    '',
    'En cada PC cliente (una sola vez):',
    '  - Si usó mkcert -install en el servidor, copie e importe la CA raíz de mkcert',
    '    (mkcert -CAROOT) en el almacén de autoridades raíz de confianza de Windows,',
    '    o abra la URL y acepte el certificado según la política de la oficina.',
    '  - Luego instale la PWA desde Chrome/Edge.',
    '',
  ].join('\n'),
  'utf8'
);

console.log('\n✓ Certificados generados.');
console.log('');
console.log('Agregue a apps/backend/.env:');
console.log(`  HTTPS_KEY_PATH=${keyForEnv}`);
console.log(`  HTTPS_CERT_PATH=${certForEnv}`);
console.log('');
console.log(`Acceso: https://${hostname}:3000  o  https://${primaryIp}:3000`);
console.log(`Detalle: ${envHintPath}`);
