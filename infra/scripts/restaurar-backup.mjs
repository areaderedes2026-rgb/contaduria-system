#!/usr/bin/env node
/**
 * Restaura un respaldo .sql.gz (o .sql) sobre la base Docker de la PC servidor.
 * REEMPLAZA todos los datos actuales.
 *
 *   npm run db:restore -- C:\Users\...\Downloads\contaduria-respaldo-....sql.gz
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const CONTAINER = 'contaduria-postgres';

const fileArg = process.argv.slice(2).filter((a) => a !== '--')[0];
if (!fileArg) {
  console.error('Uso: npm run db:restore -- ruta\\al\\contaduria-respaldo.sql.gz');
  process.exit(1);
}

if (!existsSync(fileArg)) {
  console.error(`No existe el archivo: ${fileArg}`);
  process.exit(1);
}

function loadDbUser() {
  const envPath = join(root, 'apps/backend/.env');
  let user = 'contaduria';
  let db = 'contaduria';
  if (existsSync(envPath)) {
    const text = readFileSync(envPath, 'utf8');
    const u = text.match(/^DB_USER=(.*)$/m);
    const d = text.match(/^DB_NAME=(.*)$/m);
    if (u) user = u[1].trim();
    if (d) db = d[1].trim();
  }
  return { user, db };
}

const { user, db } = loadDbUser();
const gzip = extname(fileArg).toLowerCase() === '.gz' || fileArg.toLowerCase().endsWith('.sql.gz');

console.log('=== Restaurar respaldo Contaduría ===');
console.log(`Archivo: ${fileArg}`);
console.log(`Destino: Docker ${CONTAINER} / ${db}`);
console.log('');
console.log('ATENCION: esto reemplaza TODOS los datos actuales de la base.');
console.log('');

const psql = spawn(
  'docker',
  ['exec', '-i', CONTAINER, 'psql', '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1'],
  { stdio: ['pipe', 'inherit', 'inherit'], cwd: root }
);

psql.on('error', (error) => {
  console.error('No se pudo ejecutar docker. ¿Docker Desktop está abierto?');
  console.error(error.message);
  process.exit(1);
});

try {
  const input = createReadStream(fileArg);
  if (gzip) {
    await pipeline(input, createGunzip(), psql.stdin);
  } else {
    await pipeline(input, psql.stdin);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const code = await new Promise((resolve) => {
  psql.on('close', resolve);
});

if (code !== 0) {
  console.error(`psql terminó con código ${code}`);
  process.exit(1);
}

console.log('');
console.log('✓ Restauración completada. Reinicie la app: npx pm2 restart contaduria-api');
process.exit(0);
