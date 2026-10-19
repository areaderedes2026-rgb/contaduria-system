#!/usr/bin/env node
/**
 * Escribe version.json tras el build (frontend dist + copia legible por el backend).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

function git(command) {
  try {
    return execSync(command, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const commit = git('git rev-parse --short HEAD') || 'unknown';
const branch = git('git rev-parse --abbrev-ref HEAD') || 'unknown';
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const payload = {
  version: packageJson.version ?? '1.0.0',
  commit,
  branch,
  builtAt: new Date().toISOString(),
};

const targets = [
  join(root, 'apps/frontend/dist/version.json'),
  join(root, 'apps/backend/dist/version.json'),
];

for (const target of targets) {
  const dir = dirname(target);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

console.log(`✓ Versión escrita: ${payload.version} (${payload.commit})`);
