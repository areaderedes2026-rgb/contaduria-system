import type { PoolClient } from 'pg';

type YearlyTable =
  | 'expediente_numeracion'
  | 'pago_numeracion'
  | 'afectacion_numeracion'
  | 'libramiento_numeracion'
  | 'anticipo_numeracion'
  | 'libramiento_anticipo_numeracion';

/**
 * Reserva el siguiente número correlativo anual de forma atómica.
 * Debe ejecutarse dentro de la misma transacción que el INSERT del documento.
 */
export async function allocateYearlyNumero(
  client: PoolClient,
  table: YearlyTable,
  anio: number
): Promise<number> {
  const result = await client.query<{ ultimo_numero: number }>(
    `INSERT INTO ${table} (anio, ultimo_numero)
     VALUES ($1, 1)
     ON CONFLICT (anio) DO UPDATE
       SET ultimo_numero = ${table}.ultimo_numero + 1
     RETURNING ultimo_numero`,
    [anio]
  );
  return result.rows[0].ultimo_numero;
}

/** Actualiza el contador cuando el usuario elige un número manual. */
export async function bumpYearlyNumero(
  client: PoolClient,
  table: YearlyTable,
  anio: number,
  numero: number
): Promise<void> {
  await client.query(
    `INSERT INTO ${table} (anio, ultimo_numero)
     VALUES ($1, $2)
     ON CONFLICT (anio) DO UPDATE
       SET ultimo_numero = GREATEST(${table}.ultimo_numero, EXCLUDED.ultimo_numero)`,
    [anio, numero]
  );
}

export function isPgUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}
