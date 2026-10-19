import { z } from 'zod';
import * as libramientosRepo from '../repositories/libramientos.repository.js';
import * as afectacionesRepo from '../repositories/afectaciones.repository.js';
import * as expedientesRepo from '../repositories/expedientes.repository.js';
import { query } from '../database/pool.js';
import { registrarAuditoria } from '../repositories/audit.repository.js';
import { AppError } from '../utils/errors.js';
import {
  formatLibramientoNumero,
  getAnioFromFecha,
  calcularNeto,
} from '../utils/libramiento.utils.js';
import { formatAfectacionNumero } from '../utils/afectacion.utils.js';
import type { Libramiento } from '../entities/index.js';

const detalleSchema = z.object({
  afectacion_detalle_id: z.number().int().positive().optional(),
  cuenta_id: z.number().int().positive(),
  descripcion: z.string().min(1).max(255),
  importe: z.number().positive(),
});

const createLibramientoSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  afectacion_id: z.number().int().positive(),
  beneficiario: z.string().min(1).max(255).optional(),
  importe: z.number().positive(),
  retenciones: z.number().min(0).default(0),
  numero_decreto: z.string().max(80).nullable().optional(),
  observaciones: z.string().max(2000).optional(),
  numero: z.number().int().positive().optional(),
  detalle: z.array(detalleSchema).min(1),
});

const anularSchema = z.object({
  motivo: z.string().min(5).max(1000),
});

function mapTransactionError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === 'LIBRAMIENTO_NOT_FOUND') {
      throw new AppError(404, 'Libramiento no encontrado', 'LIBRAMIENTO_NOT_FOUND');
    }
    if (error.message === 'ALREADY_ANNULLED') {
      throw new AppError(400, 'El libramiento ya está anulado', 'ALREADY_ANNULLED');
    }
    if (error.message === 'ALREADY_PAID') {
      throw new AppError(400, 'No se puede anular un libramiento ya pagado', 'ALREADY_PAID');
    }
    if (error.message === 'HAS_PAYMENTS') {
      throw new AppError(
        400,
        'No se puede anular un libramiento con pagos registrados. Anule los pagos primero.',
        'HAS_PAYMENTS'
      );
    }
    if (error.message === 'AFECTACION_NOT_FOUND') {
      throw new AppError(404, 'Afectación no encontrada', 'AFECTACION_NOT_FOUND');
    }
    if (error.message === 'AFECTACION_YA_LIBRADA') {
      throw new AppError(
        409,
        'La afectación ya tiene un libramiento activo (otro usuario puede haberlo emitido)',
        'AFECTACION_YA_LIBRADA'
      );
    }
    if (error.message === 'AFECTACION_EXPEDIENTE_MISMATCH') {
      throw new AppError(400, 'La afectación no corresponde al expediente indicado', 'AFECTACION_EXPEDIENTE_MISMATCH');
    }
    if (error.message === 'EXPEDIENTE_NOT_FOUND') {
      throw new AppError(404, 'Expediente no encontrado', 'EXPEDIENTE_NOT_FOUND');
    }
    if (error.message === 'INVALID_EXPEDIENTE_STATE') {
      throw new AppError(400, 'El expediente debe estar en estado Afectado', 'INVALID_EXPEDIENTE_STATE');
    }
    if (error.message === 'IMPORTE_EXCEEDS_AFECTACION') {
      throw new AppError(400, 'El importe supera el total de la afectación', 'IMPORTE_EXCEEDS_AFECTACION');
    }
    if (error.message === 'DUPLICATE_NUMERO') {
      throw new AppError(409, 'Ya existe un libramiento con ese número para la fecha', 'DUPLICATE_NUMERO');
    }
  }
  throw error;
}

const AFECTACION_DISPONIBLE_SQL = `
  FROM afectaciones a
  INNER JOIN expedientes e ON e.id = a.expediente_id
  LEFT JOIN proveedores p ON p.id = e.proveedor_id
  WHERE a.deleted_at IS NULL AND a.anulada = false
    AND e.deleted_at IS NULL AND e.anulado = false
    AND COALESCE(e.circuito, 'NORMAL') = 'NORMAL'
    AND e.estado = 'AFECTADO'
    AND NOT EXISTS (
      SELECT 1 FROM libramientos l
      WHERE l.afectacion_id = a.id AND l.deleted_at IS NULL AND l.anulado = false
    )
`;

export async function listLibramientos(params: {
  page?: number;
  limit?: number;
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  pagado?: boolean;
  expedienteId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  return libramientosRepo.findAll({
    page: params.page ?? 1,
    limit: Math.min(params.limit ?? 15, 100),
    search: params.search,
    anio: params.anio,
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
    anulado: params.anulado,
    pagado: params.pagado,
    expedienteId: params.expedienteId,
    sortBy: params.sortBy ?? 'created_at',
    sortOrder: params.sortOrder ?? 'desc',
  });
}

export async function getLibramiento(id: number) {
  const libramiento = await libramientosRepo.findById(id, true);
  if (!libramiento) {
    throw new AppError(404, 'Libramiento no encontrado', 'LIBRAMIENTO_NOT_FOUND');
  }
  return libramiento;
}

export async function getSiguienteNumero(anio?: number) {
  const year = anio ?? new Date().getFullYear();
  const siguiente = await libramientosRepo.getNextNumero(year);
  return {
    anio: year,
    siguiente,
    preview: formatLibramientoNumero(siguiente, year),
  };
}

export async function getAfectacionesDisponibles() {
  const result = await query<{
    id: number;
    numero: number;
    fecha: string;
    expediente_id: number;
    expediente_numero: string;
    expediente_detalle: string;
    destinatario: string;
    proveedor_nombre: string | null;
    importe_total: string;
  }>(
    `SELECT a.id, a.numero, a.fecha::text,
            a.expediente_id,
            CONCAT(e.numero, '/', e.anio) AS expediente_numero,
            e.detalle AS expediente_detalle,
            a.destinatario,
            COALESCE(p.nombre, a.destinatario) AS proveedor_nombre,
            a.importe_total::text
     ${AFECTACION_DISPONIBLE_SQL}
     ORDER BY a.fecha DESC, a.numero DESC`
  );

  return result.rows.map((r) => ({
    id: r.id,
    numero: r.numero,
    fecha: r.fecha,
    numero_completo: formatAfectacionNumero(r.numero, r.fecha),
    expediente_id: r.expediente_id,
    expediente_numero: r.expediente_numero,
    expediente_detalle: r.expediente_detalle,
    destinatario: r.destinatario,
    proveedor_nombre: r.proveedor_nombre ?? r.destinatario,
    importe_total: parseFloat(r.importe_total),
  }));
}

export async function getExpedientesDisponiblesLibramiento() {
  const afectaciones = await getAfectacionesDisponibles();
  const byExp = new Map<
    number,
    {
      id: number;
      numero_completo: string;
      detalle: string;
      proveedor_nombre: string;
      afectaciones: typeof afectaciones;
    }
  >();

  for (const af of afectaciones) {
    const existing = byExp.get(af.expediente_id);
    if (existing) {
      existing.afectaciones.push(af);
    } else {
      byExp.set(af.expediente_id, {
        id: af.expediente_id,
        numero_completo: af.expediente_numero,
        detalle: af.expediente_detalle,
        proveedor_nombre: af.proveedor_nombre,
        afectaciones: [af],
      });
    }
  }

  return Array.from(byExp.values()).sort((a, b) =>
    b.numero_completo.localeCompare(a.numero_completo, 'es')
  );
}

export async function getAfectacionParaLibramiento(afectacionId: number) {
  const afectacion = await afectacionesRepo.findById(afectacionId, true);
  if (!afectacion || afectacion.anulada) {
    throw new AppError(404, 'Afectación no encontrada', 'AFECTACION_NOT_FOUND');
  }

  const expediente = await expedientesRepo.findById(afectacion.expediente_id);
  if (!expediente || expediente.estado !== 'AFECTADO' || expediente.anulado) {
    throw new AppError(400, 'El expediente no está en estado Afectado', 'INVALID_EXPEDIENTE_STATE');
  }

  if (await libramientosRepo.hasActiveLibramiento(afectacionId)) {
    throw new AppError(400, 'La afectación ya tiene un libramiento activo', 'LIBRAMIENTO_EXISTS');
  }

  return {
    ...afectacion,
    expediente_numero: `${expediente.numero}/${expediente.anio}`,
    expediente_detalle: expediente.detalle,
    proveedor_nombre: expediente.proveedor_nombre ?? afectacion.destinatario,
  };
}

export async function createLibramiento(
  data: z.infer<typeof createLibramientoSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = createLibramientoSchema.parse(data);
  const anio = getAnioFromFecha(parsed.fecha);

  const afectacion = await getAfectacionParaLibramiento(parsed.afectacion_id);

  if (parsed.importe > afectacion.importe_total + 0.001) {
    throw new AppError(
      400,
      `El importe no puede superar el total de la afectación (${afectacion.importe_total})`,
      'IMPORTE_EXCEEDS_AFECTACION'
    );
  }

  if (parsed.retenciones > parsed.importe) {
    throw new AppError(400, 'Las retenciones no pueden superar el importe', 'INVALID_RETENCIONES');
  }

  const neto = calcularNeto(parsed.importe, parsed.retenciones);
  if (neto < 0) {
    throw new AppError(400, 'El neto no puede ser negativo', 'NEGATIVE_NETO');
  }

  const detalleSum = parsed.detalle.reduce((s, d) => s + d.importe, 0);
  if (Math.abs(detalleSum - parsed.importe) > 0.01) {
    throw new AppError(
      400,
      'La suma del detalle debe coincidir con el importe total',
      'DETALLE_SUM_MISMATCH'
    );
  }

  for (const line of parsed.detalle) {
    const afLine = afectacion.detalle?.find(
      (d) => d.cuenta_id === line.cuenta_id || d.id === line.afectacion_detalle_id
    );
    if (!afLine) {
      throw new AppError(400, 'Una cuenta del detalle no pertenece a la afectación', 'INVALID_CUENTA');
    }
    if (line.importe > afLine.importe + 0.001) {
      throw new AppError(
        400,
        `El importe en cuenta ${afLine.cuenta_codigo} supera el monto afectado`,
        'IMPORTE_EXCEEDS_CUENTA'
      );
    }
  }

  let numeroManual = parsed.numero;
  if (numeroManual != null) {
    if (await libramientosRepo.existsByNumeroAnio(numeroManual, anio)) {
      throw new AppError(
        400,
        `Ya existe un libramiento con el número ${formatLibramientoNumero(numeroManual, parsed.fecha)}`,
        'NUMERO_DUPLICADO'
      );
    }
  }

  const beneficiario = (parsed.beneficiario ?? afectacion.destinatario).trim();
  const numeroDecreto = parsed.numero_decreto?.trim() || null;

  let libramientoId: number;
  try {
    libramientoId = await libramientosRepo.create({
      numero: numeroManual,
      anio,
      fecha: parsed.fecha,
      expediente_id: afectacion.expediente_id,
      afectacion_id: parsed.afectacion_id,
      beneficiario,
      importe: parsed.importe,
      retenciones: parsed.retenciones,
      neto,
      numero_decreto: numeroDecreto,
      observaciones: parsed.observaciones?.trim(),
      usuario_creacion_id: actorId,
      detalle: parsed.detalle.map((d) => ({
        afectacion_detalle_id: d.afectacion_detalle_id,
        cuenta_id: d.cuenta_id,
        descripcion: d.descripcion.trim(),
        importe: d.importe,
      })),
    });
  } catch (error) {
    mapTransactionError(error);
  }

  const libramiento = await libramientosRepo.findById(libramientoId!, true);

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'CREATE',
    entidad: 'libramientos',
    entidad_id: libramientoId!,
    cambios: {
      numero_completo: formatLibramientoNumero(libramiento!.numero, parsed.fecha),
      afectacion_id: parsed.afectacion_id,
      importe: parsed.importe,
      neto,
      numero_decreto: numeroDecreto,
    },
    ip,
  });

  return libramiento!;
}

export async function anularLibramiento(
  id: number,
  data: z.infer<typeof anularSchema>,
  actorId: number,
  ip?: string
) {
  const parsed = anularSchema.parse(data);
  const existing = await getLibramiento(id);

  if (existing.anulado) {
    throw new AppError(400, 'El libramiento ya está anulado', 'ALREADY_ANNULLED');
  }
  if (existing.pagado) {
    throw new AppError(400, 'No se puede anular un libramiento pagado', 'ALREADY_PAID');
  }
  if (Number(existing.monto_pagado ?? 0) > 0.01) {
    throw new AppError(
      400,
      'No se puede anular un libramiento con pagos registrados. Anule los pagos primero.',
      'HAS_PAYMENTS'
    );
  }

  try {
    await libramientosRepo.anular(id, parsed.motivo.trim(), actorId);
  } catch (error) {
    mapTransactionError(error);
  }

  await registrarAuditoria({
    usuario_id: actorId,
    accion: 'ANULAR',
    entidad: 'libramientos',
    entidad_id: id,
    cambios: { motivo: parsed.motivo, neto: existing.neto },
    ip,
  });

  return libramientosRepo.findById(id, true);
}

export async function exportLibramientos(filters: {
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  pagado?: boolean;
}) {
  return libramientosRepo.findAllForExport(filters);
}

export function libramientosToCsv(libramientos: Libramiento[]): string {
  const headers = [
    'Número', 'Fecha', 'Expediente', 'Afectación', 'Beneficiario', 'Decreto',
    'Importe', 'Retenciones', 'Neto', 'Anulado', 'Pagado',
  ];

  const rows = libramientos.map((l) => [
    l.numero_completo,
    l.fecha,
    l.expediente_numero ?? l.expediente_id,
    l.afectacion_numero ?? l.afectacion_id,
    `"${l.beneficiario.replace(/"/g, '""')}"`,
    l.numero_decreto ? `"${l.numero_decreto.replace(/"/g, '""')}"` : '',
    l.importe.toFixed(2),
    l.retenciones.toFixed(2),
    l.neto.toFixed(2),
    l.anulado ? 'Sí' : 'No',
    l.pagado ? 'Sí' : 'No',
  ]);

  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}

export async function getResumen(circuito?: 'NORMAL' | 'CARGO_A_RENDIR') {
  if (circuito === 'CARGO_A_RENDIR') {
    const { getResumenTotales } = await import('../repositories/libramientosAnticipo.repository.js');
    return getResumenTotales();
  }
  if (circuito === 'NORMAL') {
    return libramientosRepo.getResumenTotales();
  }
  const result = await query<{ total: string; importe: string; neto: string }>(
    `SELECT COUNT(*)::text AS total,
            COALESCE(SUM(importe), 0)::text AS importe,
            COALESCE(SUM(neto), 0)::text AS neto
     FROM (
       SELECT importe, neto FROM libramientos WHERE deleted_at IS NULL AND anulado = false
       UNION ALL
       SELECT importe, neto FROM libramientos_anticipo WHERE deleted_at IS NULL AND anulado = false
     ) t`
  );
  return {
    total: parseInt(result.rows[0]?.total ?? '0', 10),
    importeTotal: parseFloat(result.rows[0]?.importe ?? '0'),
    netoTotal: parseFloat(result.rows[0]?.neto ?? '0'),
  };
}

export interface LibramientoConsolidado {
  id: number;
  origen: 'LIBRAMIENTO' | 'LIBRAMIENTO_ANTICIPO';
  circuito: 'NORMAL' | 'CARGO_A_RENDIR';
  numero: number;
  numero_completo: string;
  fecha: string;
  expediente_id: number;
  expediente_numero: string;
  beneficiario: string;
  importe: number;
  retenciones: number;
  neto: number;
  anulado: boolean;
  pagado: boolean;
  documento_origen: string | null;
  created_at: Date;
}

export async function listLibramientosConsolidados(params: {
  page?: number;
  limit?: number;
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  circuito?: 'NORMAL' | 'CARGO_A_RENDIR';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 15, 100);
  const offset = (page - 1) * limit;
  const allowedSort = ['numero', 'fecha', 'beneficiario', 'importe', 'neto', 'created_at'];
  const orderColumn = allowedSort.includes(params.sortBy ?? '') ? params.sortBy! : 'created_at';
  const order = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const values: unknown[] = [];
  const extra: string[] = [];
  if (params.search) {
    values.push(`%${params.search}%`);
    extra.push(`(
      beneficiario ILIKE $${values.length}
      OR CAST(numero AS TEXT) ILIKE $${values.length}
      OR numero_completo ILIKE $${values.length}
      OR expediente_numero ILIKE $${values.length}
      OR COALESCE(documento_origen, '') ILIKE $${values.length}
    )`);
  }
  if (params.anio) {
    values.push(params.anio);
    extra.push(`anio = $${values.length}`);
  }
  if (params.fechaDesde) {
    values.push(params.fechaDesde);
    extra.push(`fecha >= $${values.length}`);
  }
  if (params.fechaHasta) {
    values.push(params.fechaHasta);
    extra.push(`fecha <= $${values.length}`);
  }
  if (params.anulado !== undefined) {
    values.push(params.anulado);
    extra.push(`anulado = $${values.length}`);
  }
  if (params.circuito) {
    values.push(params.circuito);
    extra.push(`circuito = $${values.length}`);
  }
  const where = extra.length ? `WHERE ${extra.join(' AND ')}` : '';

  const unionSql = `
    SELECT l.id, l.numero, l.anio, l.fecha::text AS fecha,
           CONCAT(l.numero, '/', l.anio) AS numero_completo,
           l.expediente_id, CONCAT(e.numero, '/', e.anio) AS expediente_numero,
           l.beneficiario, l.importe, l.retenciones, l.neto,
           l.anulado, l.pagado, l.created_at,
           'NORMAL'::text AS circuito,
           'LIBRAMIENTO'::text AS origen,
           CONCAT(a.numero, '/', a.anio) AS documento_origen
    FROM libramientos l
    INNER JOIN expedientes e ON e.id = l.expediente_id
    INNER JOIN afectaciones a ON a.id = l.afectacion_id
    WHERE l.deleted_at IS NULL
    UNION ALL
    SELECT l.id, l.numero, l.anio, l.fecha::text,
           CONCAT(l.numero, '/', l.anio),
           l.expediente_id, CONCAT(e.numero, '/', e.anio),
           l.beneficiario, l.importe, l.retenciones, l.neto,
           l.anulado, l.pagado, l.created_at,
           'CARGO_A_RENDIR',
           'LIBRAMIENTO_ANTICIPO',
           CONCAT(ant.numero, '/', ant.anio)
    FROM libramientos_anticipo l
    INNER JOIN expedientes e ON e.id = l.expediente_id
    INNER JOIN anticipos ant ON ant.id = l.anticipo_id
    WHERE l.deleted_at IS NULL
  `;

  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM (${unionSql}) sub ${where}`,
    values
  );
  values.push(limit, offset);
  const dataResult = await query<LibramientoConsolidado & {
    importe: string;
    retenciones: string;
    neto: string;
  }>(
    `SELECT * FROM (${unionSql}) sub ${where}
     ORDER BY ${orderColumn} ${order}, id ${order}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return {
    data: dataResult.rows.map((r) => ({
      ...r,
      importe: parseFloat(r.importe as unknown as string),
      retenciones: parseFloat(r.retenciones as unknown as string),
      neto: parseFloat(r.neto as unknown as string),
    })),
    total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    page,
    limit,
  };
}

export async function exportLibramientosConsolidados(filters: {
  search?: string;
  anio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  anulado?: boolean;
  circuito?: 'NORMAL' | 'CARGO_A_RENDIR';
}) {
  const result = await listLibramientosConsolidados({
    ...filters,
    page: 1,
    limit: 100000,
    sortBy: 'fecha',
    sortOrder: 'desc',
  });
  return result.data;
}

export function libramientosConsolidadosToCsv(items: LibramientoConsolidado[]): string {
  const headers = [
    'Tipo', 'Número', 'Fecha', 'Expediente', 'Origen', 'Beneficiario', 'Importe', 'Retenciones', 'Neto', 'Anulado',
  ];
  const rows = items.map((l) => [
    l.circuito === 'CARGO_A_RENDIR' ? 'Cargo a rendir' : 'Normal',
    l.numero_completo,
    l.fecha,
    l.expediente_numero,
    l.documento_origen ?? '',
    `"${l.beneficiario.replace(/"/g, '""')}"`,
    l.importe.toFixed(2),
    l.retenciones.toFixed(2),
    l.neto.toFixed(2),
    l.anulado ? 'Sí' : 'No',
  ]);
  return [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}
