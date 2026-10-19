#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

function run(command, options = {}) {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: 'inherit', cwd: root, ...options });
}

console.log('=== Configuración inicial — Contaduría Municipal ===\n');

// Copiar .env si no existe
const envExample = join(root, '.env.example');
const backendEnv = join(root, 'apps/backend/.env');
const frontendEnv = join(root, 'apps/frontend/.env');

if (!existsSync(backendEnv) && existsSync(envExample)) {
  copyFileSync(envExample, backendEnv);
  console.log('✓ Creado apps/backend/.env desde .env.example');
}

if (!existsSync(frontendEnv)) {
  writeFileSync(frontendEnv, 'VITE_API_URL=/api\n');
  console.log('✓ Creado apps/frontend/.env');
}

run('npm install');

console.log('\n--- Iniciando PostgreSQL (Docker) ---');
try {
  run('npm run db:up');
  run('node infra/scripts/wait-db.mjs');
} catch {
  console.warn('\n⚠ No se pudo iniciar Docker. Asegúrese de tener Docker Desktop en ejecución.');
  console.warn('  Puede ejecutar manualmente: npm run db:up');
}

try {
  run('npm run db:migrate');
  run('npm run db:seed');
} catch {
  console.warn('\n⚠ Migraciones/seed pendientes. Ejecute cuando la BD esté lista:');
  console.warn('  npm run db:migrate && npm run db:seed');
}

console.log('\n=== Setup completado ===');
console.log('\nComandos útiles:');
console.log('  npm run dev          → Backend + Frontend en desarrollo');
console.log('  npm run db:migrate   → Aplicar migraciones');
console.log('  npm run db:seed      → Datos iniciales');
console.log('  npm run db:reset     → Reiniciar BD desde cero');
console.log('  npm run build        → Compilar para producción');
console.log('\nCredenciales iniciales: admin / Admin123!');
