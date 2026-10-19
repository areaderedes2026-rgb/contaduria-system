import { pool } from './pool.js';

async function showStatus(): Promise<void> {
  const migrations = await pool.query(
    'SELECT filename, applied_at FROM schema_migrations ORDER BY id'
  );

  console.log('\n=== Estado de migraciones ===\n');

  if (migrations.rowCount === 0) {
    console.log('No hay migraciones aplicadas.');
  } else {
    for (const row of migrations.rows) {
      console.log(`  ✓ ${row.filename} — ${row.applied_at}`);
    }
  }

  console.log('');
}

showStatus()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
