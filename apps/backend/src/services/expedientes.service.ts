import { z } from 'zod';
import * as expedientesRepo from '../repositories/expedientes.repository.js';
import * as proveedoresRepo from '../repositories/proveedores.repository.js';
import { registrarAuditoria } from '../repositories/audit.repository.js';
import { AppError } from '../utils/errors.js';
import {
  ESTADOS_EXPEDIENTE,
  getAnioFromFecha,
  puedeEditar,
  puedeEliminar,
  puedeAnular,
  puedeArchivar,
  formatExpedienteNumero,
} from '../utils/expediente.utils.js';
import type { Expediente } from '../entities/index.js';

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)');

const createExpedienteSchema = z
  .object({
    numero: z.number().int().min(1).max(999999).optional(),
    /** Compatibilidad: un solo proveedor. */
    proveedorId: z.number().int().positive().optional(),
    /** 1 a 5 proveedores (el primero es el principal). */
    proveedorIds: z.array(z.number().int().positive()).min(1).max(5).optional(),
    importe: z.number().positive('El importe debe ser mayor a cero'),
    detalle: z.string().min(1).max(5000),
    fechaIngreso: fechaSchema,
    anio: z.number().int().min(2000).max(2100).optional(),
    circuito: z.enum(['PENDIENTE', 'NORMAL', 'CARGO_A_RENDIR']).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.proveedorIds?.length && data.proveedorId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe indicar al menos un proveedor',
        path: ['proveedorIds'],
      });
    }
  });

const updateExpedienteSchema = z.object({
  proveedorId: z.number().int().positive().optional(),
  proveedorIds: z.array(z.number().int().positive()).min(1).max(5).optional(),
  importe: z.number().positive('El importe debe ser mayor a cero').optional(),
  detalle: z.string().min(1).max(5000).optional(),
  fechaIngreso: fechaSchema.optional(),
  circuito: z.enum(['PENDIENTE', 'NORMAL', 'CARGO_A_RENDIR']).optional(),
});

function normalizeProveedorIds(input: {
  proveedorId?: number;
  proveedorIds?: number[];
}): number[] {
  const raw = input.proveedorIds?.length
    ? input.proveedorIds
    : input.proveedorId != null
      ? [input.proveedorId]
      : [];
  const unique: number[] = [];
  for (const id of raw) {
    if (!unique.includes(id)) unique.push(id);
  }
  return unique.slice(0, 5);
}

const anularSchema = z.object({
  motivo: z.string().min(5).max(1000),
});

const archivarSchema = z.object({
  observacion: z.string().max(1000).optional(),
});

export async function listExpedientes(params: {
  page?: number;
  limit?: number;
  search?: string;
  estado?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  proveedorId?: number;
  circuito?: Expediente['circuito'];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  if (params.estado && !ESTADOS_EXPEDIENTE.includes(params.estado as typeof ESTADOS_EXPEDIENTE[number])) {
    throw new AppError(400, 'Estado inválido', 'INVALID_STATUS');
  }

  return expedientesRepo.findAll({
    page: params.page ?? 1,
    limit: Math.min(params.limit ?? 15, 100),
    search: params.search,
    estado: params.estado,
    anio: params.anio,
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
    anulado: params.anulado,
    proveedorId: params.proveedorId,
    circuito: params.circuito,
    sortBy: params.sortBy ?? 'created_at',
    sortOrder: params.sortOrder ?? 'desc',
  });
}

export async function getExpediente(id: number) {
  const expediente = await expedientesRepo.findById(id);
  if (!expediente) {
    throw new AppError(404, 'Expediente no encontrado', 'EXPEDIENTE_NOT_FOUND');
  }
  return expediente;
}

/** Si el expediente aún no tiene trámite, lo fija al crear el primer documento. */
export async function fijarTramiteSiPendiente(
  expediente: Expediente,
  destino: 'NORMAL' | 'CARGO_A_RENDIR',
  actorId: number
): Promise<void> {
  if (expediente.circuito === destino) return;
  if (expediente.circuito === 'PENDIENTE') {
    await expedientesRepo.update(expediente.id, {
      circuito: destino,
      usuario_modificacion_id: actorId,
    });
    await expedientesRepo.registrarHistorial({
      expediente_id: expediente.id,
      accion: 'MODIFICACION',
      observacion:
        destino === 'CARGO_A_RENDIR'
          ? 'Trámite definido: anticipo'
          : 'Trámite definido: afectación',
      usuario_id: actorId,
    });
    return;
  }
  throw new AppError(
    400,
    destino === 'CARGO_A_RENDIR'
      ? 'Este expediente está definido para afectación, no para anticipo'
      : 'Este expediente está definido para anticipo, no para afectación',
    'INVALID_CIRCUITO'
  );
}

export async function getSiguienteNumero(anio?: number) {
  const year = anio ?? new Date().getFullYear();
  const siguiente = await expedientesRepo.getNextNumero(year);
  return {
    anio: year,
    siguiente,
    preview: formatExpedienteNumero(siguiente, year),
  };
}

export async function getHistorial(expedienteId: number) {
  await getExpediente(expedienteId);
  return expedientesRepo.getHistorial(expedienteId);
}

export async function createExpediente(
  data: z.infer<typeof createExpedienteSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = createExpedienteSchema.parse(data);
  const anio = parsed.anio ?? getAnioFromFecha(parsed.fechaIngreso);

  if (getAnioFromFecha(parsed.fechaIngreso) !== anio) {
    throw new AppError(400, 'El año del expediente debe coincidir con la fecha de ingreso', 'YEAR_MISMATCH');
  }

  const proveedorIds = normalizeProveedorIds(parsed);
  if (proveedorIds.length === 0) {
    throw new AppError(400, 'Debe indicar al menos un proveedor', 'PROVEEDORES_REQUIRED');
  }

  for (const proveedorId of proveedorIds) {
    const proveedor = await proveedoresRepo.findById(proveedorId);
    if (!proveedor) {
      throw new AppError(400, 'Proveedor no encontrado', 'PROVEEDOR_NOT_FOUND');
    }
    if (!proveedor.activo) {
      throw new AppError(400, 'El proveedor no está activo', 'PROVEEDOR_INACTIVE');
    }
  }

  const numeroManual = parsed.numero;
  if (numeroManual != null && (await expedientesRepo.existsByNumeroAnio(numeroManual, anio))) {
    throw new AppError(
      409,
      `Ya existe el expediente ${formatExpedienteNumero(numeroManual, anio)}`,
      'DUPLICATE_NUMERO'
    );
  }

  const expediente = await expedientesRepo.create({
    numero: numeroManual,
    anio,
    proveedor_ids: proveedorIds,
    importe: parsed.importe,
    detalle: parsed.detalle.trim(),
    fecha_ingreso: parsed.fechaIngreso,
    circuito: 'PENDIENTE',
    usuario_creacion_id: actorId,
  });

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'CREATE',
    entidad: 'expedientes',
    entidad_id: expediente.id,
    cambios: {
      numero_completo: expediente.numero_completo,
      proveedor_id: expediente.proveedor_id,
      proveedor_ids: proveedorIds,
      importe: expediente.importe,
    },
    ip,
  });

  return expediente;
}

export async function updateExpediente(
  id: number,
  data: z.infer<typeof updateExpedienteSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = updateExpedienteSchema.parse(data);
  const existing = await getExpediente(id);

  if (!puedeEditar(existing.estado, existing.anulado)) {
    throw new AppError(
      400,
      'Solo se pueden editar expedientes en estado Iniciado y no anulados',
      'NOT_EDITABLE'
    );
  }

  if (parsed.circuito && parsed.circuito !== existing.circuito) {
    const hayAfectaciones = (existing.afectaciones_activas ?? 0) > 0;
    const hayAnticipos = (existing.anticipos_activos ?? 0) > 0;
    if ((hayAfectaciones || hayAnticipos) && parsed.circuito === 'PENDIENTE') {
      throw new AppError(
        400,
        'No se puede dejar el trámite sin definir porque el expediente ya tiene documentos',
        'INVALID_CIRCUITO'
      );
    }
    if (hayAfectaciones && parsed.circuito === 'CARGO_A_RENDIR') {
      throw new AppError(
        400,
        'Este expediente ya tiene afectaciones. No puede pasarse a anticipo',
        'INVALID_CIRCUITO'
      );
    }
    if (hayAnticipos && parsed.circuito === 'NORMAL') {
      throw new AppError(
        400,
        'Este expediente ya tiene anticipos. No puede pasarse a afectación',
        'INVALID_CIRCUITO'
      );
    }
  }

  if (parsed.proveedorId !== undefined || parsed.proveedorIds !== undefined) {
    const proveedorIds = normalizeProveedorIds(parsed);
    if (proveedorIds.length === 0) {
      throw new AppError(400, 'Debe indicar al menos un proveedor', 'PROVEEDORES_REQUIRED');
    }
    for (const proveedorId of proveedorIds) {
      const proveedor = await proveedoresRepo.findById(proveedorId);
      if (!proveedor) {
        throw new AppError(400, 'Proveedor no encontrado', 'PROVEEDOR_NOT_FOUND');
      }
      if (!proveedor.activo) {
        throw new AppError(400, 'El proveedor no está activo', 'PROVEEDOR_INACTIVE');
      }
    }

    const expediente = await expedientesRepo.update(id, {
      proveedor_ids: proveedorIds,
      importe: parsed.importe,
      detalle: parsed.detalle?.trim(),
      fecha_ingreso: parsed.fechaIngreso,
      circuito: parsed.circuito,
      usuario_modificacion_id: actorId,
    });

    await expedientesRepo.registrarHistorial({
      expediente_id: id,
      accion: 'MODIFICACION',
      observacion: 'Datos del expediente actualizados',
      usuario_id: actorId,
    });

    await registrarAuditoria({
      usuario_id: actorId,
      accion: 'UPDATE',
      entidad: 'expedientes',
      entidad_id: id,
      cambios: { ...parsed, proveedorIds } as Record<string, unknown>,
      ip,
    });

    return expediente!;
  }

  const expediente = await expedientesRepo.update(id, {
    importe: parsed.importe,
    detalle: parsed.detalle?.trim(),
    fecha_ingreso: parsed.fechaIngreso,
    circuito: parsed.circuito,
    usuario_modificacion_id: actorId,
  });

  await expedientesRepo.registrarHistorial({
    expediente_id: id,
    accion: 'MODIFICACION',
    observacion: 'Datos del expediente actualizados',
    usuario_id: actorId,
  });

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'UPDATE',
    entidad: 'expedientes',
    entidad_id: id,
    cambios: parsed as Record<string, unknown>,
    ip,
  });

  return expediente!;
}

export async function deleteExpediente(id: number, actorId: number, ip?: string) {
  const existing = await getExpediente(id);

  if (!puedeEliminar(existing.estado, existing.anulado)) {
    throw new AppError(
      400,
      'Solo se pueden eliminar expedientes en estado Iniciado y no anulados',
      'NOT_DELETABLE'
    );
  }

  await expedientesRepo.softDelete(id);

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'DELETE',
    entidad: 'expedientes',
    entidad_id: id,
    cambios: { numero_completo: existing.numero_completo },
    ip,
  });
}

export async function anularExpediente(
  id: number,
  data: z.infer<typeof anularSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = anularSchema.parse(data);
  const existing = await getExpediente(id);

  if (!puedeAnular(existing.estado, existing.anulado)) {
    throw new AppError(
      400,
      'Solo se pueden anular expedientes en estado Iniciado',
      'NOT_ANNULLABLE'
    );
  }

  const expediente = await expedientesRepo.update(id, {
    anulado: true,
    motivo_anulacion: parsed.motivo.trim(),
    fecha_anulacion: new Date(),
    usuario_modificacion_id: actorId,
  });

  await expedientesRepo.registrarHistorial({
    expediente_id: id,
    accion: 'ANULACION',
    estado_anterior: existing.estado,
    estado_nuevo: existing.estado,
    observacion: parsed.motivo.trim(),
    usuario_id: actorId,
  });

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'ANULAR',
    entidad: 'expedientes',
    entidad_id: id,
    cambios: { motivo: parsed.motivo },
    ip,
  });

  return expediente;
}

export async function archivarExpediente(
  id: number,
  data: z.infer<typeof archivarSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = archivarSchema.parse(data);
  const existing = await getExpediente(id);

  if (!puedeArchivar(existing.estado, existing.anulado)) {
    throw new AppError(
      400,
      'Solo se pueden archivar expedientes en estado Iniciado o Pagado',
      'NOT_ARCHIVABLE'
    );
  }

  const expediente = await expedientesRepo.update(id, {
    estado: 'ARCHIVADO',
    usuario_modificacion_id: actorId,
  });

  await expedientesRepo.registrarHistorial({
    expediente_id: id,
    accion: 'ARCHIVO',
    estado_anterior: existing.estado,
    estado_nuevo: 'ARCHIVADO',
    observacion: parsed.observacion?.trim() ?? 'Expediente archivado',
    usuario_id: actorId,
  });

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'ARCHIVAR',
    entidad: 'expedientes',
    entidad_id: id,
    cambios: { estado: 'ARCHIVADO' },
    ip,
  });

  return expediente;
}

export async function exportExpedientes(filters: {
  search?: string;
  estado?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  circuito?: Expediente['circuito'];
}) {
  return expedientesRepo.findAllForExport({
    ...filters,
    circuito: filters.circuito,
  });
}

export function expedientesToCsv(expedientes: Expediente[]): string {
  const headers = [
    'Número completo',
    'Número',
    'Año',
    'Fecha ingreso',
    'Proveedor',
    'Importe',
    'Detalle',
    'Estado',
    'Trámite',
    'Anulado',
    'Motivo anulación',
  ];

  const rows = expedientes.map((e) => [
    e.numero_completo,
    e.numero,
    e.anio,
    e.fecha_ingreso,
    `"${(e.proveedor_nombre ?? '').replace(/"/g, '""')}"`,
    e.importe.toFixed(2),
    `"${e.detalle.replace(/"/g, '""')}"`,
    e.estado,
    e.circuito === 'CARGO_A_RENDIR' ? 'Anticipo' : e.circuito === 'NORMAL' ? 'Afectación' : 'Sin definir',
    e.anulado ? 'Sí' : 'No',
    e.motivo_anulacion ? `"${e.motivo_anulacion.replace(/"/g, '""')}"` : '',
  ]);

  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export async function getResumen(circuito?: Expediente['circuito']) {
  const [total, porEstado] = await Promise.all([
    expedientesRepo.countTotal(circuito),
    expedientesRepo.countByEstado(circuito),
  ]);

  return {
    total,
    porEstado,
    activos: total - (porEstado.ARCHIVADO ?? 0),
  };
}
