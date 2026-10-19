#!/usr/bin/env node
import { execSync } from 'node:child_process';

const MAX_ATTEMPTS = 30;
const DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDb() {
  console.log('Esperando a que PostgreSQL esté listo...');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      execSync(
        'docker exec contaduria-postgres pg_isready -U contaduria -d contaduria',
        { stdio: 'pipe' }
      );
      console.log('✓ PostgreSQL listo');
      process.exit(0);
    } catch {
      if (attempt === MAX_ATTEMPTS) {
        console.error('✗ PostgreSQL no respondió a tiempo');
        process.exit(1);
      }
      await sleep(DELAY_MS);
    }
  }
}

waitForDb();
