import { query } from '../database/pool.js';

export interface ConfiguracionRow {
  id: number;
  clave: string;
  valor: string;
  descripcion: string | null;
  updated_at: Date;
}

export async function findByClave(clave: string): Promise<ConfiguracionRow | null> {
  const result = await query<ConfiguracionRow>(
    `SELECT id, clave, valor, descripcion, updated_at
     FROM configuracion
     WHERE clave = $1`,
    [clave]
  );
  return result.rows[0] ?? null;
}

export async function upsert(
  clave: string,
  valor: string,
  descripcion?: string | null
): Promise<ConfiguracionRow> {
  const result = await query<ConfiguracionRow>(
    `INSERT INTO configuracion (clave, valor, descripcion, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (clave) DO UPDATE
       SET valor = EXCLUDED.valor,
           descripcion = COALESCE(EXCLUDED.descripcion, configuracion.descripcion),
           updated_at = NOW()
     RETURNING id, clave, valor, descripcion, updated_at`,
    [clave, valor, descripcion ?? null]
  );
  return result.rows[0];
}
