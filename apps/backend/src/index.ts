import 'dotenv/config';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { existsSync, readFileSync } from 'node:fs';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './database/pool.js';

const app = createApp();

function resolveHttpsOptions(): { key: Buffer; cert: Buffer } | null {
  const keyPath = env.HTTPS_KEY_PATH;
  const certPath = env.HTTPS_CERT_PATH;
  if (!keyPath || !certPath) return null;

  if (!existsSync(keyPath) || !existsSync(certPath)) {
    console.error('✗ HTTPS_KEY_PATH / HTTPS_CERT_PATH configurados pero el archivo no existe.');
    console.error(`  KEY:  ${keyPath}`);
    console.error(`  CERT: ${certPath}`);
    console.error('  Genere certificados: npm run office:certs');
    process.exit(1);
  }

  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  };
}

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('✓ Conexión a PostgreSQL establecida');
  } catch (error) {
    console.error('✗ No se pudo conectar a PostgreSQL:', error);
    console.error('');
    console.error('  Pasos para resolver:');
    console.error('  1. Inicie Docker Desktop');
    console.error('  2. Ejecute desde la raíz del proyecto: npm run db:up');
    console.error('  3. Espere unos segundos y vuelva a iniciar: npm run dev');
    console.error('');
    console.error(`  Configuración actual: ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
    process.exit(1);
  }

  const httpsOptions = resolveHttpsOptions();
  const server = httpsOptions
    ? createHttpsServer(httpsOptions, app)
    : createHttpServer(app);

  const protocol = httpsOptions ? 'https' : 'http';

  server.listen(env.PORT, '0.0.0.0', () => {
    console.log(`✓ Servidor en ${protocol}://0.0.0.0:${env.PORT}`);
    console.log(`  Entorno: ${env.NODE_ENV}`);
    if (httpsOptions) {
      console.log('  HTTPS activo (PWA instalable en la red local)');
    } else if (env.NODE_ENV === 'production') {
      console.log(
        '  Aviso: sin HTTPS la PWA puede no instalarse en otras PCs. Use: npm run office:certs'
      );
    }
  });
}

start();
