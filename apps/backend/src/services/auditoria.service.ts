import * as auditRepo from '../repositories/audit.repository.js';
import { AppError } from '../utils/errors.js';
import {
  ACCIONES_AUDITORIA,
  ENTIDADES_AUDITORIA,
  getAccionLabel,
  getEntidadLabel,
} from '../utils/auditoria.utils.js';
import type { AuditoriaRegistro } from '../entities/index.js';

export async function listAuditoria(params: {
  page?: number;
  limit?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  usuarioId?: number;
  accion?: string;
  entidad?: string;
  entidadId?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  if (params.accion && !ACCIONES_AUDITORIA.includes(params.accion as typeof ACCIONES_AUDITORIA[number])) {
    const exists = (await auditRepo.getAccionesDistintas()).includes(params.accion);
    if (!exists) {
      throw new AppError(400, 'Acción inválida', 'INVALID_ACCION');
    }
  }

  if (params.entidad && !ENTIDADES_AUDITORIA.includes(params.entidad as typeof ENTIDADES_AUDITORIA[number])) {
    const exists = (await auditRepo.getEntidadesDistintas()).includes(params.entidad);
    if (!exists) {
      throw new AppError(400, 'Entidad inválida', 'INVALID_ENTIDAD');
    }
  }

  return auditRepo.findAll({
    page: params.page ?? 1,
    limit: Math.min(params.limit ?? 20, 100),
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
    usuarioId: params.usuarioId,
    accion: params.accion,
    entidad: params.entidad,
    entidadId: params.entidadId,
    search: params.search,
    sortBy: params.sortBy ?? 'created_at',
    sortOrder: params.sortOrder ?? 'desc',
  });
}

export async function getAuditoriaRegistro(id: number) {
  const registro = await auditRepo.findById(id);
  if (!registro) {
    throw new AppError(404, 'Registro de auditoría no encontrado', 'AUDIT_NOT_FOUND');
  }
  return registro;
}

export async function getAuditoriaPorEntidad(entidad: string, entidadId: number) {
  return auditRepo.findByEntidad(entidad, entidadId);
}

export async function getResumen() {
  return auditRepo.getResumen();
}

export async function getFiltros() {
  const [usuarios, acciones, entidades] = await Promise.all([
    auditRepo.getUsuariosConActividad(),
    auditRepo.getAccionesDistintas(),
    auditRepo.getEntidadesDistintas(),
  ]);

  return {
    usuarios,
    acciones: acciones.map((a) => ({ value: a, label: getAccionLabel(a) })),
    entidades: entidades.map((e) => ({ value: e, label: getEntidadLabel(e) })),
  };
}

export async function exportAuditoria(filters: {
  fechaDesde?: string;
  fechaHasta?: string;
  usuarioId?: number;
  accion?: string;
  entidad?: string;
  entidadId?: number;
  search?: string;
}) {
  return auditRepo.findAllForExport(filters);
}

export function auditoriaToCsv(registros: AuditoriaRegistro[]): string {
  const headers = [
    'ID', 'Fecha', 'Usuario', 'Acción', 'Entidad', 'ID Entidad', 'IP', 'Cambios',
  ];

  const rows = registros.map((r) => [
    r.id,
    new Date(r.created_at).toISOString(),
    r.usuario_username ?? 'Sistema',
    getAccionLabel(r.accion),
    getEntidadLabel(r.entidad),
    r.entidad_id ?? '',
    r.ip ?? '',
    r.cambios ? `"${JSON.stringify(r.cambios).replace(/"/g, '""')}"` : '',
  ]);

  return [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
}

export function getMetadata() {
  return {
    acciones: ACCIONES_AUDITORIA.map((a) => ({ value: a, label: getAccionLabel(a) })),
    entidades: ENTIDADES_AUDITORIA.map((e) => ({ value: e, label: getEntidadLabel(e) })),
  };
}
