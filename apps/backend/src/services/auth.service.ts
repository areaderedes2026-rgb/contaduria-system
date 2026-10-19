import * as rolesRepo from '../repositories/roles.repository.js';
import * as usersRepo from '../repositories/users.repository.js';
import { registrarAuditoria } from '../repositories/audit.repository.js';
import { verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';

export async function login(username: string, password: string, ip?: string) {
  const user = await usersRepo.findByUsername(username);

  if (!user || !user.activo) {
    throw new AppError(401, 'Credenciales inválidas', 'INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new AppError(401, 'Credenciales inválidas', 'INVALID_CREDENTIALS');
  }

  const permisos = await rolesRepo.getPermisosByRolId(user.rol_id);

  const token = signToken({
    userId: user.id,
    username: user.username,
    rol: user.rol_nombre,
    permisos,
  });

  await registrarAuditoria({
    usuario_id: user.id,
    accion: 'LOGIN',
    entidad: 'usuarios',
    entidad_id: user.id,
    ip,
  });

  const { password_hash: _, ...userWithoutPassword } = user;

  return {
    token,
    user: {
      ...userWithoutPassword,
      permisos,
    },
  };
}

export async function getMe(userId: number) {
  const user = await usersRepo.findById(userId);
  if (!user) {
    throw new AppError(404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  }
  return user;
}
