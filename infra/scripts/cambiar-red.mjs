#!/usr/bin/env node
/**
 * Cuando cambia el WiFi / la IP de la oficina.
 * Regenera certificados, hosts, .env, kit de clientes y reinicia PM2.
 *
 * Uso: npm run office:red
 *      npm run office:red -- 192.168.1.50
 */
import { applyOfficeNetwork } from './office-network.mjs';

const args = process.argv.slice(2).filter((a) => a !== '--');

try {
  console.log('=== Cambiar red de oficina — Contaduría ===\n');
  console.log('El nombre del sistema no cambia: contaduria.local');
  console.log('Las PWA instaladas con esa dirección siguen valiendo.\n');

  const result = applyOfficeNetwork({ ip: args[0], restartPm2: true });

  console.log('\n=== Red actualizada ===');
  console.log(`IP del servidor: ${result.ip}`);
  console.log(`URL (usar siempre): ${result.url}`);
  console.log('');
  console.log('En cada PC de trabajo:');
  console.log(`  1. Copie la carpeta: ${result.kitDir}`);
  console.log('  2. Ejecute configurar-acceso-cliente.bat como administrador');
  console.log('  3. Abra la URL de arriba (no hace falta reinstalar la PWA).');
} catch (error) {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
