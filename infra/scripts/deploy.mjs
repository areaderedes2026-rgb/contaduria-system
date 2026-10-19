#!/usr/bin/env node
/**
 * Despliegue seguro en la PC principal de la oficina.
 * Si migraciones o build fallan, NO reinicia PM2 (deja la versión anterior corriendo).
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

function run(command, label) {
  console.log(`\n→ ${label}`);
  console.log(`  $ ${command}`);
  try {
    execSync(command, { stdio: 'inherit', cwd: root });
    return true;
  } catch {
    console.error(`\n✗ Falló: ${label}`);
    return false;
  }
}

function fail(message, hint) {
  console.error(`\n=== Despliegue cancelado ===`);
  console.error(message);
  if (hint) console.error(`\n${hint}`);
  console.error('\nLa versión anterior del sistema sigue en ejecución (si PM2 estaba activo).');
  process.exit(1);
}

console.log('=== Actualizar Contaduría Municipal ===');
console.log('PC principal únicamente. Las demás PCs solo recargan el navegador/PWA.\n');

if (!run('git pull', 'Bajar cambios desde Git')) {
  fail(
    'No se pudieron bajar los cambios.',
    'Compruebe internet, que el repo esté clonado y que no haya cambios locales sin guardar en esta PC.'
  );
}

if (!run('npm install', 'Instalar dependencias')) {
  fail(
    'No se pudieron instalar las dependencias.',
    'Revise Node.js (versión 20+) y el acceso a internet/npm.'
  );
}

if (!run('npm run db:migrate', 'Aplicar migraciones de base de datos')) {
  fail(
    'Fallaron las migraciones. No se reinició el servidor.',
    'Revise que PostgreSQL esté en marcha (npm run db:up) y los logs anteriores.'
  );
}

if (!run('npm run build', 'Compilar backend y frontend (incluye version.json)')) {
  fail(
    'Falló la compilación. No se reinició el servidor.',
    'Corrija los errores de TypeScript/build e intente de nuevo.'
  );
}

const restarted = run(
  'npx pm2 restart ecosystem.config.cjs --update-env',
  'Reiniciar aplicación (PM2)'
);

if (!restarted) {
  console.log('\nPM2 no tenía el proceso: se inicia por primera vez…');
  if (!run('npx pm2 start ecosystem.config.cjs', 'Iniciar aplicación (PM2)')) {
    fail(
      'No se pudo iniciar PM2.',
      'Instale PM2 globalmente: npm install -g pm2\nLuego ejecute de nuevo este actualizador.'
    );
  }
}

console.log('\n=== Despliegue completado ===');
console.log('En las otras PCs aparecerá el aviso “Nueva versión disponible”.');
console.log('Pídales que pulsen “Recargar ahora” (o abran de nuevo la PWA).');
process.exit(0);
