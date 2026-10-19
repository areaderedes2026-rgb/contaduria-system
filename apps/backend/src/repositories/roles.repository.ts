import { query } from '../database/pool.js';
import type { Rol } from '../entities/index.js';

export async function findAll(): Promise<Rol[]> {
  const result = await query<Rol>(
    'SELECT id, nombre, descripcion FROM roles WHERE deleted_at IS NULL ORDER BY nombre'
  );
  return result.rows;
}

export async function findById(id: number): Promise<Rol | null> {
  const result = await query<Rol>(
    'SELECT id, nombre, descripcion FROM roles WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findByName(nombre: string): Promise<Rol | null> {
  const result = await query<Rol>(
    'SELECT id, nombre, descripcion FROM roles WHERE nombre = $1 AND deleted_at IS NULL',
    [nombre]
  );
  return result.rows[0] ?? null;
}

export async function getPermisosByRolId(rolId: number): Promise<string[]> {
  const result = await query<{ codigo: string }>(
    `SELECT p.codigo FROM permisos p
     INNER JOIN rol_permiso rp ON rp.permiso_id = p.id
     WHERE rp.rol_id = $1`,
    [rolId]
  );
  return result.rows.map((row) => row.codigo);
}
