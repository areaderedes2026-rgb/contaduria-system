import { z } from 'zod';
import * as proveedoresRepo from '../repositories/proveedores.repository.js';
import * as auditRepo from '../repositories/audit.repository.js';
import { registrarAuditoria } from '../repositories/audit.repository.js';
import { AppError } from '../utils/errors.js';

const optionalText = z
  .string()
  .max(255)
  .optional()
  .or(z.literal(''))
  .transform((v) => (v && v.trim() ? v.trim() : null));

const createProveedorSchema = z.object({
  nombre: z.string().min(1).max(255),
  documento: optionalText,
  domicilio: optionalText,
  telefono: z
    .string()
    .max(50)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  activo: z.boolean().optional(),
});

const updateProveedorSchema = z.object({
  nombre: z.string().min(1).max(255).optional(),
  documento: optionalText.nullable(),
  domicilio: optionalText.nullable(),
  telefono: z
    .string()
    .max(50)
    .optional()
    .or(z.literal(''))
    .nullable()
    .transform((v) => (v == null || v === '' ? null : v.trim())),
  activo: z.boolean().optional(),
});

export async function listProveedores(params: {
  page?: number;
  limit?: number;
  search?: string;
  activo?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  return proveedoresRepo.findAll({
    page: params.page ?? 1,
    limit: Math.min(params.limit ?? 15, 100),
    search: params.search,
    activo: params.activo,
    sortBy: params.sortBy ?? 'nombre',
    sortOrder: params.sortOrder ?? 'asc',
  });
}

export async function listActivos(search?: string) {
  return proveedoresRepo.findActivos(search, 100);
}

export async function getProveedor(id: number) {
  const proveedor = await proveedoresRepo.findById(id);
  if (!proveedor) {
    throw new AppError(404, 'Proveedor no encontrado', 'PROVEEDOR_NOT_FOUND');
  }
  return proveedor;
}

export async function getHistorial(id: number) {
  await getProveedor(id);
  return auditRepo.findByEntidad('proveedores', id, 100);
}

export async function getResumen(id: number) {
  await getProveedor(id);
  return proveedoresRepo.getResumen(id);
}

export async function createProveedor(
  data: z.infer<typeof createProveedorSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = createProveedorSchema.parse(data);

  const proveedor = await proveedoresRepo.create({
    nombre: parsed.nombre.trim(),
    documento: parsed.documento,
    domicilio: parsed.domicilio,
    telefono: parsed.telefono,
    activo: parsed.activo ?? true,
  });

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'CREATE',
    entidad: 'proveedores',
    entidad_id: proveedor.id,
    cambios: { nombre: proveedor.nombre, documento: proveedor.documento },
    ip,
  });

  return proveedor;
}

export async function updateProveedor(
  id: number,
  data: z.infer<typeof updateProveedorSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = updateProveedorSchema.parse(data);
  await getProveedor(id);

  const updateData: Parameters<typeof proveedoresRepo.update>[1] = {};
  if (parsed.nombre !== undefined) updateData.nombre = parsed.nombre.trim();
  if (parsed.documento !== undefined) updateData.documento = parsed.documento;
  if (parsed.domicilio !== undefined) updateData.domicilio = parsed.domicilio;
  if (parsed.telefono !== undefined) updateData.telefono = parsed.telefono;
  if (parsed.activo !== undefined) updateData.activo = parsed.activo;

  const proveedor = await proveedoresRepo.update(id, updateData);

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'UPDATE',
    entidad: 'proveedores',
    entidad_id: id,
    cambios: parsed as Record<string, unknown>,
    ip,
  });

  return proveedor;
}

export async function deleteProveedor(id: number, actorId: number, ip?: string) {
  const existing = await getProveedor(id);

  if (await proveedoresRepo.hasExpedientes(id)) {
    throw new AppError(
      400,
      'No se puede eliminar un proveedor con expedientes asociados. Desactívelo en su lugar.',
      'PROVEEDOR_IN_USE'
    );
  }

  await proveedoresRepo.softDelete(id);

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'DELETE',
    entidad: 'proveedores',
    entidad_id: id,
    cambios: { nombre: existing.nombre },
    ip,
  });
}
