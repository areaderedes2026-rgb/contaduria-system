import { query } from '../database/pool.js';
import type { Usuario, UsuarioConPermisos } from '../entities/index.js';

interface UsuarioRow extends Usuario {
  password_hash: string;
  rol_nombre: string;
}

export async function findByUsername(username: string): Promise<UsuarioRow | null> {
  const result = await query<UsuarioRow>(
    `SELECT u.*, r.nombre AS rol_nombre
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     WHERE u.username = $1 AND u.deleted_at IS NULL`,
    [username]
  );
  return result.rows[0] ?? null;
}

export async function findById(id: number): Promise<UsuarioConPermisos | null> {
  const result = await query<UsuarioConPermisos>(
    `SELECT u.id, u.username, u.nombre, u.apellido, u.email, u.rol_id,
            u.activo, u.debe_cambiar_password, u.created_at, u.updated_at,
            r.nombre AS rol_nombre,
            COALESCE(array_agg(p.codigo) FILTER (WHERE p.codigo IS NOT NULL), '{}') AS permisos
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     LEFT JOIN rol_permiso rp ON rp.rol_id = r.id
     LEFT JOIN permisos p ON p.id = rp.permiso_id
     WHERE u.id = $1 AND u.deleted_at IS NULL
     GROUP BY u.id, r.nombre`,
    [id]
  );

  const user = result.rows[0];
  if (!user) return null;

  return {
    ...user,
    permisos: Array.isArray(user.permisos) ? user.permisos : [],
  };
}

export interface ListUsuariosParams {
  page: number;
  limit: number;
  search?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export async function findAll(params: ListUsuariosParams) {
  const { page, limit, search, sortBy, sortOrder } = params;
  const offset = (page - 1) * limit;

  const allowedSort = ['username', 'nombre', 'apellido', 'created_at', 'rol_nombre'];
  const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

  let whereClause = 'WHERE u.deleted_at IS NULL';
  const values: unknown[] = [];

  if (search) {
    values.push(`%${search}%`);
    whereClause += ` AND (u.username ILIKE $${values.length} OR u.nombre ILIKE $${values.length} OR u.apellido ILIKE $${values.length})`;
  }

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM usuarios u ${whereClause}`,
    values
  );

  values.push(limit, offset);
  const dataResult = await query<Usuario & { rol_nombre: string }>(
    `SELECT u.id, u.username, u.nombre, u.apellido, u.email, u.rol_id,
            u.activo, u.debe_cambiar_password, u.created_at, u.updated_at,
            r.nombre AS rol_nombre
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     ${whereClause}
     ORDER BY ${orderColumn === 'rol_nombre' ? 'r.nombre' : `u.${orderColumn}`} ${order}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return {
    data: dataResult.rows,
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    page,
    limit,
  };
}

export async function create(data: {
  username: string;
  password_hash: string;
  nombre: string;
  apellido: string;
  email?: string;
  rol_id: number;
}): Promise<Usuario & { rol_nombre: string }> {
  const result = await query<Usuario & { rol_nombre: string }>(
    `INSERT INTO usuarios (username, password_hash, nombre, apellido, email, rol_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, username, nombre, apellido, email, rol_id, activo,
               debe_cambiar_password, created_at, updated_at,
               (SELECT nombre FROM roles WHERE id = $6) AS rol_nombre`,
    [data.username, data.password_hash, data.nombre, data.apellido, data.email ?? null, data.rol_id]
  );
  return result.rows[0];
}

export async function update(
  id: number,
  data: Partial<{
    nombre: string;
    apellido: string;
    email: string | null;
    rol_id: number;
    activo: boolean;
    password_hash: string;
    debe_cambiar_password: boolean;
  }>
): Promise<(Usuario & { rol_nombre: string }) | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) return findById(id) as Promise<(Usuario & { rol_nombre: string }) | null>;

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<Usuario & { rol_nombre: string }>(
    `UPDATE usuarios SET ${fields.join(', ')}
     WHERE id = $${paramIndex} AND deleted_at IS NULL
     RETURNING id, username, nombre, apellido, email, rol_id, activo,
               debe_cambiar_password, created_at, updated_at,
               (SELECT nombre FROM roles WHERE id = usuarios.rol_id) AS rol_nombre`,
    values
  );
  return result.rows[0] ?? null;
}

export async function softDelete(id: number): Promise<boolean> {
  const result = await query(
    `UPDATE usuarios SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return result.rowCount > 0;
}

export async function usernameExists(username: string, excludeId?: number): Promise<boolean> {
  const values: unknown[] = [username];
  let sql = 'SELECT 1 FROM usuarios WHERE username = $1 AND deleted_at IS NULL';
  if (excludeId) {
    values.push(excludeId);
    sql += ' AND id != $2';
  }
  const result = await query(sql, values);
  return result.rowCount > 0;
}
