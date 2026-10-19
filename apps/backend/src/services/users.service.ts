import { z } from 'zod';
import * as usersRepo from '../repositories/users.repository.js';
import * as rolesRepo from '../repositories/roles.repository.js';
import { registrarAuditoria } from '../repositories/audit.repository.js';
import { hashPassword } from '../utils/password.js';
import { AppError } from '../utils/errors.js';

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100),
  nombre: z.string().min(1).max(100),
  apellido: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('')),
  rol_id: z.number().int().positive(),
});

const updateUserSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  apellido: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  rol_id: z.number().int().positive().optional(),
  activo: z.boolean().optional(),
  password: z.string().min(8).max(100).optional(),
});

export async function listUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  return usersRepo.findAll({
    page: params.page ?? 1,
    limit: Math.min(params.limit ?? 10, 100),
    search: params.search,
    sortBy: params.sortBy ?? 'created_at',
    sortOrder: params.sortOrder ?? 'desc',
  });
}

export async function getUser(id: number) {
  const user = await usersRepo.findById(id);
  if (!user) {
    throw new AppError(404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  }
  return user;
}

export async function createUser(
  data: z.infer<typeof createUserSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = createUserSchema.parse(data);

  if (await usersRepo.usernameExists(parsed.username)) {
    throw new AppError(409, 'El nombre de usuario ya existe', 'USERNAME_EXISTS');
  }

  const rol = await rolesRepo.findById(parsed.rol_id);
  if (!rol) {
    throw new AppError(400, 'Rol inválido', 'INVALID_ROLE');
  }

  const password_hash = await hashPassword(parsed.password);
  const user = await usersRepo.create({
    ...parsed,
    email: parsed.email || undefined,
    password_hash,
  });

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'CREATE',
    entidad: 'usuarios',
    entidad_id: user.id,
    cambios: { username: user.username, rol: rol.nombre },
    ip,
  });

  return user;
}

export async function updateUser(
  id: number,
  data: z.infer<typeof updateUserSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = updateUserSchema.parse(data);

  const existing = await usersRepo.findById(id);
  if (!existing) {
    throw new AppError(404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  }

  if (parsed.rol_id) {
    const rol = await rolesRepo.findById(parsed.rol_id);
    if (!rol) {
      throw new AppError(400, 'Rol inválido', 'INVALID_ROLE');
    }
  }

  const updateData: Parameters<typeof usersRepo.update>[1] = {};

  if (parsed.nombre !== undefined) updateData.nombre = parsed.nombre;
  if (parsed.apellido !== undefined) updateData.apellido = parsed.apellido;
  if (parsed.email !== undefined) updateData.email = parsed.email || null;
  if (parsed.rol_id !== undefined) updateData.rol_id = parsed.rol_id;
  if (parsed.activo !== undefined) updateData.activo = parsed.activo;
  if (parsed.password) {
    updateData.password_hash = await hashPassword(parsed.password);
  }

  const user = await usersRepo.update(id, updateData);

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'UPDATE',
    entidad: 'usuarios',
    entidad_id: id,
    cambios: parsed as Record<string, unknown>,
    ip,
  });

  return user;
}

export async function deleteUser(id: number, actorId: number, ip?: string) {
  if (id === actorId) {
    throw new AppError(400, 'No puede eliminar su propio usuario', 'SELF_DELETE');
  }

  const existing = await usersRepo.findById(id);
  if (!existing) {
    throw new AppError(404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  }

  await usersRepo.softDelete(id);

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'DELETE',
    entidad: 'usuarios',
    entidad_id: id,
    ip,
  });
}

export async function listRoles() {
  return rolesRepo.findAll();
}
