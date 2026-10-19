#!/usr/bin/env node
/**
 * Primera generación de certificados / red de oficina.
 * Uso: npm run office:certs -- [IP]
 */
import { applyOfficeNetwork } from './office-network.mjs';

const args = process.argv.slice(2).filter((a) => a !== '--');

try {
  console.log('=== Certificados HTTPS oficina ===\n');
  const result = applyOfficeNetwork({ ip: args[0], restartPm2: false });
  console.log('\n✓ Listo.');
  console.log(`  Entre siempre por: ${result.url}`);
  console.log(`  Kit para las otras PCs: ${result.kitDir}`);
} catch (error) {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
